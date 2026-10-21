package pe.taskflow.board.gestion;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface TiendaRepository extends ReactiveCrudRepository<Tienda, Long> {

    Flux<Tienda> findAllByOrderByCodigoAsc();
}
