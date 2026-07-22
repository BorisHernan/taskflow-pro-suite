package pe.taskflow.board.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import pe.taskflow.board.config.TaskEventPublisher;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import pe.taskflow.board.model.TaskPositionUpdate;
import pe.taskflow.board.repository.TaskRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskRepository taskRepository;
    private final TaskEventPublisher eventPublisher;

    @GetMapping
    public Flux<Task> findAll() {
        return taskRepository.findAllByOrderByStatusAscPositionAsc();
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<pe.taskflow.board.model.TaskEvent> stream() {
        return eventPublisher.stream();
    }

    @PostMapping
    public Mono<Task> create(@Valid @RequestBody Task task) {
        task.setId(null);
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        if (task.getStatus() == null) {
            task.setStatus("TODO");
        }
        return taskRepository.save(task)
                .doOnSuccess(saved -> eventPublisher.publish(TaskEventType.CREATED, saved));
    }

    @PutMapping("/{id}")
    public Mono<Task> update(@PathVariable Long id, @Valid @RequestBody Task incoming) {
        return taskRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea no encontrada: " + id)))
                .flatMap(existing -> {
                    existing.setTitle(incoming.getTitle());
                    existing.setDescription(incoming.getDescription());
                    existing.setStatus(incoming.getStatus());
                    existing.setPosition(incoming.getPosition());
                    existing.setUpdatedAt(LocalDateTime.now());
                    return taskRepository.save(existing);
                })
                .doOnSuccess(saved -> eventPublisher.publish(TaskEventType.UPDATED, saved));
    }

    /**
     * Reordena/mueve varias tareas de una sola vez (p. ej. tras un drag & drop),
     * para que todas las posiciones afectadas queden consistentes en una sola llamada.
     */
    @PutMapping("/reorder")
    public Flux<Task> reorder(@RequestBody List<TaskPositionUpdate> updates) {
        return Flux.fromIterable(updates)
                .concatMap(update -> taskRepository.findById(update.id())
                        .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea no encontrada: " + update.id())))
                        .flatMap(existing -> {
                            existing.setStatus(update.status());
                            existing.setPosition(update.position());
                            existing.setUpdatedAt(LocalDateTime.now());
                            return taskRepository.save(existing);
                        }))
                .doOnNext(saved -> eventPublisher.publish(TaskEventType.UPDATED, saved));
    }

    @DeleteMapping("/{id}")
    public Mono<Void> delete(@PathVariable Long id) {
        return taskRepository.existsById(id)
                .flatMap(exists -> {
                    if (!exists) {
                        return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea no encontrada: " + id));
                    }
                    return taskRepository.deleteById(id)
                            .doOnSuccess(v -> eventPublisher.publish(TaskEventType.DELETED, Task.builder().id(id).build()));
                });
    }
}
