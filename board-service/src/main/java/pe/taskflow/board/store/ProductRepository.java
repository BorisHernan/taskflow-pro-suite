package pe.taskflow.board.store;

import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface ProductRepository extends ReactiveCrudRepository<Product, Long> {

    String CON_STOCK = """
            SELECT p.id, p.name, p.description, p.price, i.stock, p.icon, p.category, p.subcategory, p.brand, p.list_price, p.promo, p.details, p.initial_stock
            FROM products p JOIN inventario i ON i.producto_id = p.id WHERE i.tienda_id = :tienda""";

    Flux<Product> findAllByOrderByIdAsc();

    /** Catálogo con el stock de una sede. */
    @Query(CON_STOCK + " ORDER BY p.id")
    Flux<Product> conStockDe(Long tienda);

    @Query(CON_STOCK + " AND p.id = :id")
    Mono<Product> unoConStockDe(Long id, Long tienda);
}
