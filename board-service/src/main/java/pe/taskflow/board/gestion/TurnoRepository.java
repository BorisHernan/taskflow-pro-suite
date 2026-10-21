package pe.taskflow.board.gestion;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface TurnoRepository extends ReactiveCrudRepository<Turno, Long> {

    Mono<Turno> findFirstByTiendaIdAndEstado(Long tiendaId, String estado);

    Flux<Turno> findTop30ByTiendaIdOrderByInicioDesc(Long tiendaId);

    Flux<Turno> findTop30ByOrderByInicioDesc();
}
