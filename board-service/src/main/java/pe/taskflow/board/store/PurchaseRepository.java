package pe.taskflow.board.store;

import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface PurchaseRepository extends ReactiveCrudRepository<Purchase, Long> {

    @Query("SELECT COUNT(*) AS compras, COALESCE(SUM(quantity), 0) AS unidades, COALESCE(SUM(total), 0) AS ingresos FROM purchases")
    Mono<PurchaseTotals> totales();
}
