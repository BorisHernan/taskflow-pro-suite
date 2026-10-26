package pe.taskflow.board.gestion;

import lombok.RequiredArgsConstructor;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.data.relational.core.query.Criteria;
import org.springframework.data.relational.core.query.Query;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import pe.taskflow.board.store.Product;
import pe.taskflow.board.store.ProductEventPublisher;
import pe.taskflow.board.store.ProductRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;

/**
 * Stock por tienda. Cada movimiento es un UPDATE atómico (nunca leer, restar y
 * guardar), así dos compras simultáneas no pueden vender la misma unidad.
 * Después de cada cambio se avisa a la tienda online y se abre o cierra la
 * alerta de reposición en el tablero.
 */
@Service
@RequiredArgsConstructor
public class InventarioService {

    private final DatabaseClient db;
    private final R2dbcEntityTemplate template;
    private final ProductRepository productRepository;
    private final ProductEventPublisher productEvents;
    private final TareasAutomaticas tareas;

    /** Vacío si no hay stock suficiente. */
    public Mono<Inventario> descontar(long tiendaId, long productoId, int cantidad) {
        return mover("""
                UPDATE inventario SET stock = stock - :cantidad, actualizado_en = now()
                WHERE tienda_id = :tienda AND producto_id = :producto AND stock >= :cantidad
                RETURNING *""", tiendaId, productoId, cantidad);
    }

    public Mono<Inventario> sumar(long tiendaId, long productoId, int cantidad) {
        return mover("""
                UPDATE inventario SET stock = stock + :cantidad, actualizado_en = now()
                WHERE tienda_id = :tienda AND producto_id = :producto
                RETURNING *""", tiendaId, productoId, cantidad);
    }

    public Mono<Integer> stockActual(long tiendaId, long productoId) {
        return db.sql("SELECT stock FROM inventario WHERE tienda_id = :tienda AND producto_id = :producto")
                .bind("tienda", tiendaId)
                .bind("producto", productoId)
                .map((row, meta) -> row.get("stock", Integer.class))
                .one()
                .defaultIfEmpty(0);
    }

    /** Solo el administrador ajusta los niveles; la alerta se recalcula con los nuevos valores. */
    public Mono<Inventario> cambiarNiveles(long id, int minimo, int objetivo) {
        return db.sql("""
                        UPDATE inventario SET stock_minimo = :minimo, stock_objetivo = :objetivo, actualizado_en = now()
                        WHERE id = :id RETURNING *""")
                .bind("minimo", minimo)
                .bind("objetivo", objetivo)
                .bind("id", id)
                .map((row, meta) -> template.getConverter().read(Inventario.class, row, meta))
                .one()
                .flatMap(this::despuesDelCambio);
    }

    public Mono<Inventario> buscar(long id) {
        return template.selectOne(Query.query(Criteria.where("id").is(id)), Inventario.class);
    }

    public Flux<InventarioVista> listar(Long tiendaId) {
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                        SELECT i.id, i.tienda_id, i.producto_id, p.name, p.category, p.icon, p.price,
                               i.stock, i.stock_minimo, i.stock_objetivo, i.almacen,
                               EXISTS (SELECT 1 FROM pedidos pe WHERE pe.tienda_id = i.tienda_id AND pe.producto_id = i.producto_id
                                       AND pe.estado IN ('SOLICITADO', 'APROBADO')) AS pedido_en_curso
                        FROM inventario i JOIN products p ON p.id = i.producto_id
                        WHERE i.tienda_id = COALESCE(:tienda, i.tienda_id)
                        ORDER BY (i.stock::float / GREATEST(i.stock_minimo, 1)), p.name""");
        return Sql.bindOrNull(consulta, "tienda", tiendaId, Long.class)
                .map((row, meta) -> {
                    int stock = row.get("stock", Integer.class);
                    int minimo = row.get("stock_minimo", Integer.class);
                    return new InventarioVista(
                            row.get("id", Long.class), row.get("tienda_id", Long.class), row.get("producto_id", Long.class),
                            row.get("name", String.class), row.get("category", String.class), row.get("icon", String.class),
                            row.get("price", BigDecimal.class), stock, minimo, row.get("stock_objetivo", Integer.class), row.get("almacen", Integer.class),
                            InventarioVista.estadoDe(stock, minimo), Boolean.TRUE.equals(row.get("pedido_en_curso", Boolean.class)));
                })
                .all();
    }

    /** Reposición nocturna de lo agotado, para que la tienda online nunca quede vacía. */
    public Flux<Inventario> reponerAgotados() {
        return db.sql("""
                        UPDATE inventario SET stock = stock_objetivo, actualizado_en = now()
                        WHERE stock = 0 RETURNING *""")
                .map((row, meta) -> template.getConverter().read(Inventario.class, row, meta))
                .all()
                .concatMap(this::despuesDelCambio);
    }

    private Mono<Inventario> mover(String sql, long tiendaId, long productoId, int cantidad) {
        return db.sql(sql)
                .bind("cantidad", cantidad)
                .bind("tienda", tiendaId)
                .bind("producto", productoId)
                .map((row, meta) -> template.getConverter().read(Inventario.class, row, meta))
                .one()
                .flatMap(this::despuesDelCambio);
    }

    private Mono<Inventario> despuesDelCambio(Inventario inv) {
        return productRepository.findById(inv.getProductoId())
                .doOnNext(p -> productEvents.publish(conStockDe(p, inv)))
                .flatMap(p -> inv.bajoMinimo()
                        ? tareas.alertaDeStock(inv, p.getName())
                        : tareas.cerrarAlerta(inv.getTiendaId(), inv.getProductoId(), "Stock repuesto: " + inv.getStock() + " unidades."))
                .thenReturn(inv);
    }

    public static Product conStockDe(Product p, Inventario inv) {
        p.setStock(inv.getStock());
        p.setTiendaId(inv.getTiendaId());
        return p;
    }
}
