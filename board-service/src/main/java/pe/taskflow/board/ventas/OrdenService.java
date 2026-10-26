package pe.taskflow.board.ventas;

import lombok.RequiredArgsConstructor;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.taskflow.board.auth.UsuarioActual;
import pe.taskflow.board.demo.DemoStatsService;
import pe.taskflow.board.gestion.Errores;
import pe.taskflow.board.gestion.FiltroDeTexto;
import pe.taskflow.board.gestion.Inventario;
import pe.taskflow.board.gestion.InventarioService;
import pe.taskflow.board.gestion.Sql;
import pe.taskflow.board.gestion.TareasAutomaticas;
import pe.taskflow.board.gestion.Tienda;
import pe.taskflow.board.gestion.TiendaRepository;
import pe.taskflow.board.gestion.TurnoService;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.store.Product;
import pe.taskflow.board.store.ProductRepository;
import pe.taskflow.board.store.Purchase;
import pe.taskflow.board.store.PurchaseRepository;
import pe.taskflow.board.ventas.SolicitudesOrden.LineaVista;
import pe.taskflow.board.ventas.SolicitudesOrden.NuevaOrden;
import pe.taskflow.board.ventas.SolicitudesOrden.OrdenVista;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pedidos de la tienda online. El cobro es una sola transacción: si falta stock
 * de una línea, no se descuenta nada. Cada pedido crea su tarea en la tienda y
 * avanza por estados hasta la entrega; el cliente lo sigue con su código.
 */
@Service
@RequiredArgsConstructor
public class OrdenService {

    private static final String ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom AZAR = new SecureRandom();
    /** Radio de reparto desde la sede (el frontend usa el mismo). */
    static final double COBERTURA_KM = 15;

    /** Transiciones válidas según la modalidad. */
    private static final Map<String, Set<String>> SIGUIENTE_RECOJO = Map.of(
            Orden.RECIBIDA, Set.of(Orden.PREPARANDO),
            Orden.PREPARANDO, Set.of(Orden.LISTA),
            Orden.LISTA, Set.of(Orden.ENTREGADA));
    private static final Map<String, Set<String>> SIGUIENTE_ENVIO = Map.of(
            Orden.RECIBIDA, Set.of(Orden.PREPARANDO),
            Orden.PREPARANDO, Set.of(Orden.EN_CAMINO),
            Orden.EN_CAMINO, Set.of(Orden.ENTREGADA));

    private final OrdenRepository repository;
    private final ProductRepository productRepository;
    private final PurchaseRepository purchaseRepository;
    private final TiendaRepository tiendaRepository;
    private final InventarioService inventario;
    private final TurnoService turnos;
    private final TareasAutomaticas tareas;
    private final DemoStatsService stats;
    private final FiltroDeTexto filtro;
    private final DatabaseClient db;
    private final R2dbcEntityTemplate template;

    private record LineaCobrada(Product producto, int cantidad, BigDecimal total) {
    }

    @Transactional
    public Mono<OrdenVista> crear(NuevaOrden req) {
        boolean envio = Orden.ENVIO.equals(req.modalidad());
        if (envio && (req.latitud() == null || req.longitud() == null)) {
            return Mono.error(Errores.invalido("Para el envío a domicilio, marca la dirección en el mapa."));
        }
        filtro.revisar(req.clienteNombre(), req.direccion());
        Optional<BigDecimal> descuento = Cupones.descuentoDe(req.cupon());
        if (req.cupon() != null && !req.cupon().isBlank() && descuento.isEmpty()) {
            return Mono.error(Errores.invalido("El cupón \"" + req.cupon().trim() + "\" no existe."));
        }

        return tiendaRepository.findById(req.tiendaId())
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Tienda no encontrada")))
                .flatMap(tienda -> Flux.fromIterable(req.lineas())
                        .concatMap(l -> cobrarLinea(tienda.getId(), l.productoId(), l.cantidad()))
                        .collectList()
                        .flatMap(lineas -> guardar(req, tienda, lineas, descuento.orElse(BigDecimal.ZERO), envio)));
    }

    /** Con 2×1, por cada par de unidades se paga una: con 3 se pagan 2; con 4, 2. */
    static int unidadesPagadas(Product p, int cantidad) {
        return "2X1".equals(p.getPromo()) ? cantidad - cantidad / 2 : cantidad;
    }

    private Mono<LineaCobrada> cobrarLinea(long tiendaId, long productoId, int cantidad) {
        return productRepository.findById(productoId)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Producto no encontrado: " + productoId)))
                .flatMap(p -> inventario.descontar(tiendaId, productoId, cantidad)
                        .switchIfEmpty(Mono.defer(() -> inventario.stockActual(tiendaId, productoId)
                                .flatMap(stock -> Mono.<Inventario>error(Errores.conflicto(
                                        "Solo quedan " + stock + " unidades de \"" + p.getName() + "\" en esta sede.")))))
                        .thenReturn(new LineaCobrada(p, cantidad, p.getPrice().multiply(BigDecimal.valueOf(unidadesPagadas(p, cantidad))))));
    }

    private Mono<OrdenVista> guardar(NuevaOrden req, Tienda tienda, List<LineaCobrada> lineas, BigDecimal tasaDescuento,
                                     boolean envio) {
        BigDecimal subtotal = lineas.stream().map(LineaCobrada::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal descuento = subtotal.multiply(tasaDescuento).setScale(2, RoundingMode.HALF_UP);
        BigDecimal distancia = envio && tienda.getLatitud() != null
                ? BigDecimal.valueOf(distanciaKm(tienda.getLatitud().doubleValue(), tienda.getLongitud().doubleValue(),
                req.latitud(), req.longitud())).setScale(2, RoundingMode.HALF_UP)
                : null;
        if (distancia != null && distancia.doubleValue() > COBERTURA_KM) {
            return Mono.error(Errores.invalido("Esa dirección está a " + distancia + " km de " + tienda.getNombre()
                    + ". Solo repartimos hasta " + (int) COBERTURA_KM + " km de la sede."));
        }
        LocalDateTime ahora = LocalDateTime.now();
        Orden orden = Orden.builder()
                .codigo(nuevoCodigo())
                .tiendaId(tienda.getId())
                .clienteNombre(req.clienteNombre().trim())
                .modalidad(req.modalidad())
                .direccion(req.direccion() == null || req.direccion().isBlank() ? null : req.direccion().trim())
                .latitud(envio ? BigDecimal.valueOf(req.latitud()) : null)
                .longitud(envio ? BigDecimal.valueOf(req.longitud()) : null)
                .distanciaKm(distancia)
                .subtotal(subtotal)
                .descuento(descuento)
                .total(subtotal.subtract(descuento))
                .cupon(tasaDescuento.signum() > 0 ? req.cupon().trim().toUpperCase() : null)
                .estado(Orden.RECIBIDA)
                .creadaEn(ahora)
                .actualizadaEn(ahora)
                .build();

        return turnos.idAbierto(tienda.getId()).map(Optional::of).defaultIfEmpty(Optional.empty())
                .flatMap(turno -> repository.save(orden)
                        .flatMap(guardada -> Flux.fromIterable(lineas)
                                .concatMap(l -> purchaseRepository.save(Purchase.builder()
                                        .productId(l.producto().getId())
                                        .productName(l.producto().getName())
                                        .category(l.producto().getCategory())
                                        .quantity(l.cantidad())
                                        .total(l.total())
                                        .tiendaId(tienda.getId())
                                        .turnoId(turno.orElse(null))
                                        .ordenId(guardada.getId())
                                        .createdAt(ahora)
                                        .build()))
                                .doOnNext(c -> stats.recordPurchase(c.getQuantity(), c.getTotal()))
                                .then(crearTarea(guardada, lineas))
                                .flatMap(tarea -> {
                                    guardada.setTareaId(tarea.getId());
                                    return repository.save(guardada);
                                })))
                .flatMap(guardada -> vista(guardada, tienda));
    }

    private Mono<Task> crearTarea(Orden o, List<LineaCobrada> lineas) {
        boolean envio = Orden.ENVIO.equals(o.getModalidad());
        String detalle = lineas.stream().map(l -> l.cantidad() + " × " + l.producto().getName()).collect(Collectors.joining(", "))
                + ". Cliente: " + o.getClienteNombre()
                + (envio ? ". Envío a " + (o.getDireccion() != null ? o.getDireccion() : "la ubicación marcada")
                + " (" + o.getDistanciaKm() + " km)." : ". Recoge en tienda.");
        return tareas.crear(Task.builder()
                .title("Preparar pedido " + o.getCodigo() + (envio ? " · envío" : " · recojo"))
                .description(detalle)
                .tiendaId(o.getTiendaId())
                .tipo("PEDIDO")
                .prioridad(envio ? "ALTA" : "MEDIA")
                .referenciaId(o.getId())
                .creadoPor("tienda online")
                .build());
    }

    public Mono<OrdenVista> seguimiento(String codigo) {
        return repository.findByCodigo(codigo.trim().toUpperCase())
                .switchIfEmpty(Mono.error(Errores.noEncontrado("No encontramos un pedido con ese código.")))
                .flatMap(o -> tiendaRepository.findById(o.getTiendaId()).flatMap(t -> vista(o, t)));
    }

    public Flux<OrdenVista> listar(UsuarioActual u, Long tiendaPedida) {
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                SELECT * FROM ordenes WHERE tienda_id = COALESCE(:tienda, tienda_id)
                ORDER BY CASE estado WHEN 'ENTREGADA' THEN 1 ELSE 0 END, creada_en DESC LIMIT 100""");
        return Sql.bindOrNull(consulta, "tienda", u.tiendaVisible(tiendaPedida), Long.class)
                .map((row, meta) -> template.getConverter().read(Orden.class, row, meta))
                .all()
                .concatMap(o -> tiendaRepository.findById(o.getTiendaId()).flatMap(t -> vista(o, t)));
    }

    /** Avanza el pedido un paso (solo transiciones válidas para su modalidad) y mueve su tarea. */
    public Mono<OrdenVista> avanzar(UsuarioActual u, long id, String nuevo) {
        return repository.findById(id)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Pedido no encontrado")))
                .doOnNext(o -> u.exigirAcceso(o.getTiendaId()))
                .flatMap(o -> {
                    Map<String, Set<String>> flujo = Orden.ENVIO.equals(o.getModalidad()) ? SIGUIENTE_ENVIO : SIGUIENTE_RECOJO;
                    if (!flujo.getOrDefault(o.getEstado(), Set.of()).contains(nuevo)) {
                        return Mono.error(Errores.conflicto("El pedido está en " + o.getEstado().toLowerCase().replace('_', ' ')
                                + " y no puede pasar a " + nuevo.toLowerCase().replace('_', ' ') + "."));
                    }
                    return transicion(id, o.getEstado(), nuevo);
                })
                .flatMap(o -> moverTarea(o).thenReturn(o))
                .flatMap(o -> tiendaRepository.findById(o.getTiendaId()).flatMap(t -> vista(o, t)));
    }

    /** Si la tarea del pedido se cierra desde el tablero, el pedido queda entregado. */
    public Mono<Void> alCerrarTarea(Task t) {
        if (!"PEDIDO".equals(t.getTipo()) || t.getReferenciaId() == null || !"DONE".equals(t.getStatus())) {
            return Mono.empty();
        }
        return db.sql("UPDATE ordenes SET estado = 'ENTREGADA', actualizada_en = now() WHERE id = :id AND estado <> 'ENTREGADA'")
                .bind("id", t.getReferenciaId())
                .then();
    }

    private Mono<Orden> transicion(long id, String desde, String hacia) {
        return db.sql("""
                        UPDATE ordenes SET estado = :hacia, actualizada_en = now()
                        WHERE id = :id AND estado = :desde RETURNING *""")
                .bind("hacia", hacia)
                .bind("id", id)
                .bind("desde", desde)
                .map((row, meta) -> template.getConverter().read(Orden.class, row, meta))
                .one()
                .switchIfEmpty(Mono.error(Errores.conflicto("El pedido cambió mientras tanto. Recarga la lista.")));
    }

    private Mono<Task> moverTarea(Orden o) {
        return switch (o.getEstado()) {
            case Orden.PREPARANDO -> tareas.mover(o.getTareaId(), "IN_PROGRESS", null);
            case Orden.ENTREGADA -> tareas.mover(o.getTareaId(), "DONE", "Pedido entregado al cliente.");
            default -> Mono.empty();
        };
    }

    private Mono<OrdenVista> vista(Orden o, Tienda t) {
        return db.sql("SELECT product_name, quantity, total, created_at FROM purchases WHERE orden_id = :id ORDER BY id")
                .bind("id", o.getId())
                .map((row, meta) -> new LineaVista(row.get("product_name", String.class), row.get("quantity", Integer.class),
                        row.get("total", BigDecimal.class), row.get("created_at", LocalDateTime.class)))
                .all()
                .collectList()
                .map(lineas -> new OrdenVista(o, new ArrayList<>(lineas), t.getNombre(), t.getDireccion(), t.getLatitud(),
                        t.getLongitud()));
    }

    private static String nuevoCodigo() {
        StringBuilder sb = new StringBuilder("TF-");
        for (int i = 0; i < 6; i++) {
            sb.append(ALFABETO.charAt(AZAR.nextInt(ALFABETO.length())));
        }
        return sb.toString();
    }

    static double distanciaKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double h = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
        return 2 * 6371 * Math.asin(Math.sqrt(h));
    }
}
