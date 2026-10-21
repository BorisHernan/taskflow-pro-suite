package pe.taskflow.board.gestion;

import lombok.RequiredArgsConstructor;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.taskflow.board.auth.UsuarioActual;
import pe.taskflow.board.store.ProductRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Mermas: producto dañado, vencido, robado o perdido por error de conteo.
 * Descuenta el stock como una venta (y puede disparar la alerta de
 * reposición); un robo abre además una incidencia de seguridad.
 */
@Service
@RequiredArgsConstructor
public class MermaService {

    /** Costo estimado de compra: 60 % del precio de venta. */
    public static final BigDecimal COSTO_SOBRE_PRECIO = new BigDecimal("0.60");

    private final MermaRepository repository;
    private final ProductRepository productRepository;
    private final InventarioService inventario;
    private final IncidenciaService incidencias;
    private final TurnoService turnos;
    private final FiltroDeTexto filtro;
    private final DatabaseClient db;
    private final R2dbcEntityTemplate template;

    @Transactional
    public Mono<Merma> registrar(UsuarioActual u, Solicitudes.NuevaMerma req) {
        long tienda = u.tiendaParaRegistrar(req.tiendaId());
        filtro.revisar(req.nota());
        return productRepository.findById(req.productoId())
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Producto no encontrado")))
                .flatMap(producto -> inventario.descontar(tienda, producto.getId(), req.cantidad())
                        .switchIfEmpty(Mono.defer(() -> inventario.stockActual(tienda, producto.getId())
                                .flatMap(stock -> Mono.<Inventario>error(Errores.conflicto(
                                        "Solo hay " + stock + " unidades en stock: la merma no puede ser mayor.")))))
                        .then(turnos.idAbierto(tienda).map(Optional::of).defaultIfEmpty(Optional.empty()))
                        .flatMap(turno -> repository.save(Merma.builder()
                                .tiendaId(tienda)
                                .productoId(producto.getId())
                                .productoNombre(producto.getName())
                                .cantidad(req.cantidad())
                                .motivo(req.motivo())
                                .costo(costoDe(producto.getPrice(), req.cantidad()))
                                .nota(req.nota())
                                .turnoId(turno.orElse(null))
                                .registradoPor(u.usuario())
                                .creadaEn(LocalDateTime.now())
                                .build())))
                .flatMap(merma -> "ROBO".equals(merma.getMotivo())
                        ? incidencias.registrar(tienda, "Robo de " + merma.getCantidad() + " × " + merma.getProductoNombre(),
                                "Registrado como merma #" + merma.getId() + ".", "SEGURIDAD", "ALTA", u.usuario()).thenReturn(merma)
                        : Mono.just(merma));
    }

    public Flux<Merma> listar(UsuarioActual u, Long tiendaPedida) {
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                SELECT * FROM mermas WHERE tienda_id = COALESCE(:tienda, tienda_id)
                ORDER BY creada_en DESC LIMIT 200""");
        return Sql.bindOrNull(consulta, "tienda", u.tiendaVisible(tiendaPedida), Long.class)
                .map((row, meta) -> template.getConverter().read(Merma.class, row, meta))
                .all();
    }

    public static BigDecimal costoDe(BigDecimal precio, int cantidad) {
        return precio.multiply(COSTO_SOBRE_PRECIO).multiply(BigDecimal.valueOf(cantidad)).setScale(2, RoundingMode.HALF_UP);
    }
}
