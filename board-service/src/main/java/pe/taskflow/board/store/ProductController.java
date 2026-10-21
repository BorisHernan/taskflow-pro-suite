package pe.taskflow.board.store;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.http.server.reactive.ServerHttpRequest;
import pe.taskflow.board.demo.ContentModerationService;
import pe.taskflow.board.demo.DemoStatsService;
import pe.taskflow.board.gestion.Inventario;
import pe.taskflow.board.gestion.InventarioService;
import pe.taskflow.board.gestion.TurnoService;
import pe.taskflow.board.util.ClientIpResolver;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Tienda simulada del portafolio: carrito, cupones y boleta viven en el frontend,
 * pero el stock es real y compartido (baja en vivo para todos), cada compra queda
 * en el historial y las reseñas se moderan.
 */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Tag(name = "Store", description = "Catálogo con stock real y compartido en vivo (SSE)")
public class ProductController {

    private final ProductRepository productRepository;
    private final ProductEventPublisher eventPublisher;
    private final DemoStatsService statsService;
    private final ProductReviewRepository reviewRepository;
    private final ContentModerationService moderationService;
    private final PurchaseRepository purchaseRepository;
    private final InventarioService inventario;
    private final TurnoService turnos;

    static final int MAX_RESENAS_POR_IP_AL_DIA = 5;
    /** Sede que usa la tienda online si el cliente no elige otra. */
    public static final long TIENDA_PRINCIPAL = 1;

    @Operation(summary = "Lista el catálogo con el stock de la tienda elegida")
    @GetMapping
    public Flux<Product> findAll(@RequestParam(required = false) Long tienda) {
        long sede = sede(tienda);
        return productRepository.conStockDe(sede).doOnNext(p -> p.setTiendaId(sede));
    }

    /**
     * Al conectar, se reenvía el catálogo completo como eventos normales (no solo
     * un comentario de heartbeat) para que el cliente sepa de inmediato que el
     * stream está vivo, sin esperar a que alguien compre algo.
     */
    @Operation(summary = "Stream en vivo (SSE) de cambios de stock")
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<Product>> stream(ServerWebExchange exchange, @RequestParam(required = false) Long tienda) {
        long sede = sede(tienda);
        exchange.getResponse().getHeaders().add("X-Accel-Buffering", "no");
        exchange.getResponse().getHeaders().add("Cache-Control", "no-cache, no-transform");

        statsService.recordVisitor();
        statsService.recordVisitorPersisted(ClientIpResolver.resolve(exchange.getRequest())).subscribe();

        Flux<ServerSentEvent<Product>> initialSnapshot = productRepository.conStockDe(sede)
                .doOnNext(p -> p.setTiendaId(sede))
                .map(product -> ServerSentEvent.builder(product).build());

        // Solo los cambios de stock de esta sede.
        Flux<ServerSentEvent<Product>> events = eventPublisher.stream()
                .filter(product -> product.getTiendaId() != null && product.getTiendaId() == sede)
                .map(product -> ServerSentEvent.builder(product).build());

        Flux<ServerSentEvent<Product>> heartbeat = Flux.interval(Duration.ofSeconds(15))
                .map(tick -> ServerSentEvent.<Product>builder().comment("keep-alive").build());

        return Flux.merge(initialSnapshot, events, heartbeat);
    }

    @Operation(summary = "Compra en una sede: descuenta su stock de forma atómica y lo transmite a todos")
    @PostMapping("/{id}/purchase")
    public Mono<Product> purchase(@PathVariable Long id, @Valid @RequestBody PurchaseRequest request) {
        long sede = sede(request.tiendaId());
        return productRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado")))
                .flatMap(product -> inventario.descontar(sede, id, request.quantity())
                        .switchIfEmpty(Mono.defer(() -> inventario.stockActual(sede, id).flatMap(stock -> Mono.<Inventario>error(
                                new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Solo quedan " + stock + " unidades de \"" + product.getName() + "\"")))))
                        .flatMap(inv -> turnos.idAbierto(sede).map(Optional::of).defaultIfEmpty(Optional.empty())
                                .flatMap(turno -> purchaseRepository.save(Purchase.builder()
                                        .productId(product.getId())
                                        .productName(product.getName())
                                        .category(product.getCategory())
                                        .quantity(request.quantity())
                                        .total(product.getPrice().multiply(BigDecimal.valueOf(request.quantity())))
                                        .tiendaId(sede)
                                        .turnoId(turno.orElse(null))
                                        .createdAt(LocalDateTime.now())
                                        .build()))
                                .doOnNext(compra -> statsService.recordPurchase(compra.getQuantity(), compra.getTotal()))
                                .thenReturn(InventarioService.conStockDe(product, inv))));
    }

    @Operation(summary = "Promedio y cantidad de reseñas de cada producto")
    @GetMapping("/ratings")
    public Flux<RatingSummary> ratings() {
        return reviewRepository.resumenPorProducto();
    }

    @Operation(summary = "Detalle de un producto")
    @GetMapping("/{id}")
    public Mono<Product> findOne(@PathVariable Long id, @RequestParam(required = false) Long tienda) {
        long sede = sede(tienda);
        return productRepository.unoConStockDe(id, sede)
                .doOnNext(p -> p.setTiendaId(sede))
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado")));
    }

    @Operation(summary = "Reseñas de un producto, de la más nueva a la más antigua")
    @GetMapping("/{id}/reviews")
    public Flux<ProductReview> reviews(@PathVariable Long id) {
        return reviewRepository.findByProductIdOrderByCreatedAtDesc(id);
    }

    @Operation(summary = "Publica una reseña (moderada: lenguaje ofensivo y límite por IP)")
    @PostMapping("/{id}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<ProductReview> addReview(@PathVariable Long id, @Valid @RequestBody ReviewRequest request,
                                         ServerHttpRequest httpRequest) {
        String ip = ClientIpResolver.resolve(httpRequest);

        if (moderationService.isBlocked(ip)) {
            return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tu IP quedó bloqueada por lenguaje ofensivo repetido. Este es un demo público compartido, sé respetuoso."));
        }
        if (moderationService.findBlockedWord(request.author(), request.comment()).isPresent()) {
            int avisos = moderationService.recordViolation(ip);
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Evita lenguaje ofensivo en las reseñas. Aviso " + avisos + "/" + ContentModerationService.MAX_VIOLATIONS + "."));
        }

        return productRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado")))
                .flatMap(product -> reviewRepository.countByCreatedByIpAndCreatedAtAfter(ip, LocalDateTime.now().minusDays(1)))
                .flatMap(cantidad -> {
                    if (cantidad >= MAX_RESENAS_POR_IP_AL_DIA) {
                        return Mono.error(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                                "Ya publicaste " + MAX_RESENAS_POR_IP_AL_DIA + " reseñas hoy. Vuelve mañana."));
                    }
                    return reviewRepository.save(ProductReview.builder()
                            .productId(id)
                            .author(request.author().trim())
                            .rating(request.rating())
                            .comment(request.comment().trim())
                            .createdAt(LocalDateTime.now())
                            .createdByIp(ip)
                            .seed(false)
                            .build());
                });
    }

    private static long sede(Long tienda) {
        return tienda == null ? TIENDA_PRINCIPAL : tienda;
    }
}
