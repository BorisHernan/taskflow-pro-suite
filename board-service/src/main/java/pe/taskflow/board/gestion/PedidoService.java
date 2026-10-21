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

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Pedidos de reposición: la tienda pide, el administrador aprueba o rechaza y
 * la tienda recibe. Cada paso es un UPDATE condicionado al estado anterior,
 * así un pedido no puede recibirse dos veces aunque se pulse el botón doble.
 */
@Service
@RequiredArgsConstructor
public class PedidoService {

    private final PedidoRepository repository;
    private final ProductRepository productRepository;
    private final InventarioService inventario;
    private final TareasAutomaticas tareas;
    private final FiltroDeTexto filtro;
    private final DatabaseClient db;
    private final R2dbcEntityTemplate template;

    public Mono<Pedido> crear(UsuarioActual u, Solicitudes.NuevoPedido req) {
        long tienda = u.tiendaParaRegistrar(req.tiendaId());
        filtro.revisar(req.nota());
        Mono<Boolean> enCurso = db.sql("""
                        SELECT EXISTS (SELECT 1 FROM pedidos WHERE tienda_id = :tienda AND producto_id = :producto
                                       AND estado IN ('SOLICITADO', 'APROBADO')) AS hay""")
                .bind("tienda", tienda)
                .bind("producto", req.productoId())
                .map((row, meta) -> Boolean.TRUE.equals(row.get("hay", Boolean.class)))
                .one();
        Mono<Long> alerta = db.sql("""
                        SELECT id FROM tasks WHERE tipo = 'REPOSICION' AND tienda_id = :tienda AND producto_id = :producto
                        AND status <> 'DONE'""")
                .bind("tienda", tienda)
                .bind("producto", req.productoId())
                .map((row, meta) -> row.get("id", Long.class))
                .one();

        return productRepository.findById(req.productoId())
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Producto no encontrado")))
                .flatMap(producto -> enCurso.flatMap(hay -> hay
                        ? Mono.<Pedido>error(Errores.conflicto("Ya hay un pedido en curso de \"" + producto.getName() + "\"."))
                        : alerta.map(Optional::of).defaultIfEmpty(Optional.empty())
                                .flatMap(tarea -> repository.save(Pedido.builder()
                                        .tiendaId(tienda)
                                        .productoId(producto.getId())
                                        .productoNombre(producto.getName())
                                        .cantidad(req.cantidad())
                                        .costo(MermaService.costoDe(producto.getPrice(), req.cantidad()))
                                        .estado(Pedido.SOLICITADO)
                                        .nota(req.nota())
                                        .tareaId(tarea.orElse(null))
                                        .solicitadoPor(u.usuario())
                                        .creadoEn(LocalDateTime.now())
                                        .actualizadoEn(LocalDateTime.now())
                                        .build()))))
                .flatMap(p -> tareas.mover(p.getTareaId(), "IN_PROGRESS", "Pedido #" + p.getId() + " solicitado.").thenReturn(p));
    }

    public Mono<Pedido> aprobar(UsuarioActual u, long id) {
        u.exigirAdmin();
        return transicion(id, Pedido.SOLICITADO, Pedido.APROBADO, u.usuario(), null,
                "Solo se aprueban pedidos solicitados.");
    }

    public Mono<Pedido> rechazar(UsuarioActual u, long id, Solicitudes.RevisionPedido req) {
        u.exigirAdmin();
        filtro.revisar(req.nota());
        return transicion(id, Pedido.SOLICITADO, Pedido.RECHAZADO, u.usuario(), req.nota(),
                "Solo se rechazan pedidos solicitados.")
                .flatMap(p -> tareas.mover(p.getTareaId(), "TODO", "Pedido #" + p.getId() + " rechazado.").thenReturn(p));
    }

    /** La tienda confirma que llegó: suma el stock y, si ya pasa el mínimo, la alerta se cierra sola. */
    @Transactional
    public Mono<Pedido> recibir(UsuarioActual u, long id) {
        return repository.findById(id)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Pedido no encontrado")))
                .doOnNext(p -> u.exigirAcceso(p.getTiendaId()))
                .flatMap(p -> transicion(id, Pedido.APROBADO, Pedido.RECIBIDO, u.usuario(), null,
                        "Solo se reciben pedidos aprobados."))
                .flatMap(p -> inventario.sumar(p.getTiendaId(), p.getProductoId(), p.getCantidad())
                        .flatMap(inv -> inv.bajoMinimo()
                                ? tareas.mover(p.getTareaId(), "TODO", "Llegó el pedido #" + p.getId() + ", pero sigue bajo el mínimo.")
                                : Mono.empty())
                        .thenReturn(p));
    }

    public Flux<Pedido> listar(UsuarioActual u, Long tiendaPedida) {
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                SELECT * FROM pedidos WHERE tienda_id = COALESCE(:tienda, tienda_id)
                ORDER BY CASE estado WHEN 'SOLICITADO' THEN 0 WHEN 'APROBADO' THEN 1 ELSE 2 END, actualizado_en DESC
                LIMIT 200""");
        return Sql.bindOrNull(consulta, "tienda", u.tiendaVisible(tiendaPedida), Long.class)
                .map((row, meta) -> template.getConverter().read(Pedido.class, row, meta))
                .all();
    }

    private Mono<Pedido> transicion(long id, String desde, String hacia, String usuario, String nota, String error) {
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                        UPDATE pedidos SET estado = :hacia, actualizado_en = now(),
                               revisado_por = CASE WHEN :hacia = 'RECIBIDO' THEN revisado_por ELSE :usuario END,
                               nota = COALESCE(:nota, nota)
                        WHERE id = :id AND estado = :desde
                        RETURNING *""")
                .bind("hacia", hacia)
                .bind("usuario", usuario)
                .bind("id", id)
                .bind("desde", desde);
        return Sql.bindOrNull(consulta, "nota", nota, String.class)
                .map((row, meta) -> template.getConverter().read(Pedido.class, row, meta))
                .one()
                .switchIfEmpty(Mono.error(Errores.conflicto(error)));
    }
}
