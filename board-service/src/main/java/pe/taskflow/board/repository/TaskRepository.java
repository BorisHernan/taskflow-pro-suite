package pe.taskflow.board.repository;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import pe.taskflow.board.model.Task;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface TaskRepository extends ReactiveCrudRepository<Task, Long> {

    Flux<Task> findByStatusOrderByPositionAsc(String status);

    Flux<Task> findAllByOrderByStatusAscPositionAsc();

    Mono<Long> countByCreatedByIp(String createdByIp);

    Mono<Void> deleteByCreatedByIp(String createdByIp);
}
