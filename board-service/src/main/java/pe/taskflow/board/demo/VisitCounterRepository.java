package pe.taskflow.board.demo;

import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface VisitCounterRepository extends ReactiveCrudRepository<VisitCounter, Integer> {

    // UPDATE atómico en la base de datos, para no perder incrementos si dos
    // visitantes se conectan al mismo tiempo (a diferencia de leer + sumar +
    // guardar en Java, que sí tendría condición de carrera).
    @Modifying
    @Query("UPDATE visit_counter SET total_visits = total_visits + 1, last_visit_at = now() WHERE id = 1")
    Mono<Integer> increment();
}
