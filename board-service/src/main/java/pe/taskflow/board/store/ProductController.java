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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import pe.taskflow.board.demo.DemoStatsService;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.Duration;

/**
 * Tienda simulada del portafolio: el catálogo, carrito, cupones y boleta son
 * de mentira (viven en el frontend), pero el stock es real y compartido —
 * varios visitantes viendo la tienda a la vez ven el mismo stock bajar en vivo.
 */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Tag(name = "Store", description = "Catálogo con stock real y compartido en vivo (SSE)")
public class ProductController {

    private final ProductRepository productRepository;
    private final ProductEventPublisher eventPublisher;
    private final DemoStatsService statsService;

    @Operation(summary = "Lista el catálogo con el stock actual")
    @GetMapping
    public Flux<Product> findAll() {
        return productRepository.findAllByOrderByIdAsc();
    }

    /**
     * Al conectar, se reenvía el catálogo completo como eventos normales (no solo
     * un comentario de heartbeat) para que el cliente sepa de inmediato que el
     * stream está vivo, sin esperar a que alguien compre algo.
     */
    @Operation(summary = "Stream en vivo (SSE) de cambios de stock")
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<Product>> stream(ServerWebExchange exchange) {
        exchange.getResponse().getHeaders().add("X-Accel-Buffering", "no");
        exchange.getResponse().getHeaders().add("Cache-Control", "no-cache, no-transform");

        statsService.recordVisitor();

        Flux<ServerSentEvent<Product>> initialSnapshot = productRepository.findAllByOrderByIdAsc()
                .map(product -> ServerSentEvent.builder(product).build());

        Flux<ServerSentEvent<Product>> events = eventPublisher.stream()
                .map(product -> ServerSentEvent.builder(product).build());

        Flux<ServerSentEvent<Product>> heartbeat = Flux.interval(Duration.ofSeconds(15))
                .map(tick -> ServerSentEvent.<Product>builder().comment("keep-alive").build());

        return Flux.merge(initialSnapshot, events, heartbeat);
    }

    @Operation(summary = "Compra unidades de un producto: descuenta el stock real y lo transmite a todos")
    @PostMapping("/{id}/purchase")
    public Mono<Product> purchase(@PathVariable Long id, @Valid @RequestBody PurchaseRequest request) {
        return productRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado")))
                .flatMap(product -> {
                    if (product.getStock() < request.quantity()) {
                        return Mono.error(new ResponseStatusException(HttpStatus.CONFLICT,
                                "Solo quedan " + product.getStock() + " unidades de \"" + product.getName() + "\""));
                    }
                    product.setStock(product.getStock() - request.quantity());
                    return productRepository.save(product);
                })
                .doOnSuccess(saved -> {
                    eventPublisher.publish(saved);
                    BigDecimal lineTotal = saved.getPrice().multiply(BigDecimal.valueOf(request.quantity()));
                    statsService.recordPurchase(request.quantity(), lineTotal);
                });
    }
}
