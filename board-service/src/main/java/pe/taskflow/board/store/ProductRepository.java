package pe.taskflow.board.store;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface ProductRepository extends ReactiveCrudRepository<Product, Long> {

    Flux<Product> findAllByOrderByIdAsc();

    @Modifying
    @Query("UPDATE products SET stock = initial_stock")
    Mono<Integer> reponerStock();
}
