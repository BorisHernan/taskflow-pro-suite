package pe.taskflow.board.ventas;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface OrdenRepository extends ReactiveCrudRepository<Orden, Long> {

    Mono<Orden> findByCodigo(String codigo);
}
