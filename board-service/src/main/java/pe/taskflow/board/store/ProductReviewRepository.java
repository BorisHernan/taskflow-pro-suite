package pe.taskflow.board.store;

import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

public interface ProductReviewRepository extends ReactiveCrudRepository<ProductReview, Long> {

    Flux<ProductReview> findByProductIdOrderByCreatedAtDesc(Long productId);

    Mono<Long> countByCreatedByIpAndCreatedAtAfter(String createdByIp, LocalDateTime desde);

    @Query("SELECT product_id, AVG(rating)::float8 AS average, COUNT(*) AS count FROM product_reviews GROUP BY product_id")
    Flux<RatingSummary> resumenPorProducto();
}
