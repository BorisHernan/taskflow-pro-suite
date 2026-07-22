package pe.taskflow.board.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import pe.taskflow.board.config.TaskEventPublisher;
import pe.taskflow.board.demo.ContentModerationService;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import pe.taskflow.board.model.TaskPositionUpdate;
import pe.taskflow.board.repository.TaskRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskRepository taskRepository;
    private final TaskEventPublisher eventPublisher;
    private final ContentModerationService moderationService;

    @Value("${app.demo.max-tasks-per-ip}")
    private int maxTasksPerIp;

    @GetMapping
    public Flux<Task> findAll() {
        return taskRepository.findAllByOrderByStatusAscPositionAsc();
    }

    /**
     * Algunos proxies/CDNs (p. ej. delante de Render) hacen buffering de respuestas
     * en streaming, lo que retrasa o bloquea la entrega de eventos SSE en vivo.
     * Los headers de abajo lo desactivan explícitamente, y el heartbeat cada 15s
     * mantiene el flujo activo aunque no haya cambios de tareas.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<TaskEvent>> stream(ServerWebExchange exchange) {
        exchange.getResponse().getHeaders().add("X-Accel-Buffering", "no");
        exchange.getResponse().getHeaders().add("Cache-Control", "no-cache, no-transform");

        Flux<ServerSentEvent<TaskEvent>> events = eventPublisher.stream()
                .map(event -> ServerSentEvent.builder(event).build());

        Flux<ServerSentEvent<TaskEvent>> heartbeat = Flux.interval(Duration.ofSeconds(15))
                .map(tick -> ServerSentEvent.<TaskEvent>builder().comment("keep-alive").build());

        return Flux.merge(events, heartbeat);
    }

    @PostMapping
    public Mono<Task> create(@Valid @RequestBody Task task, ServerHttpRequest request) {
        String clientIp = resolveClientIp(request);

        if (moderationService.isBlocked(clientIp)) {
            return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tu IP quedó bloqueada por lenguaje ofensivo repetido. Este es un demo público compartido, sé respetuoso."));
        }

        return moderationService.findBlockedWord(task.getTitle(), task.getDescription())
                .map(word -> Mono.<Task>error(new ResponseStatusException(HttpStatus.BAD_REQUEST, violationMessage(clientIp))))
                .orElseGet(() -> taskRepository.countByCreatedByIp(clientIp)
                        .flatMap(count -> {
                            if (count >= maxTasksPerIp) {
                                return taskRepository.deleteByCreatedByIp(clientIp)
                                        .then(Mono.<Task>error(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                                                "Creaste demasiadas tareas (" + maxTasksPerIp + "+). Se eliminaron todas las tuyas — no te pases, es un demo compartido con más visitantes.")))
                                        .doOnSuccess(v -> eventPublisher.publish(TaskEventType.RESET, null));
                            }

                            task.setId(null);
                            task.setCreatedByIp(clientIp);
                            task.setCreatedAt(LocalDateTime.now());
                            task.setUpdatedAt(LocalDateTime.now());
                            if (task.getStatus() == null) {
                                task.setStatus("TODO");
                            }
                            return taskRepository.save(task)
                                    .doOnSuccess(saved -> eventPublisher.publish(TaskEventType.CREATED, saved));
                        }));
    }

    @PutMapping("/{id}")
    public Mono<Task> update(@PathVariable Long id, @Valid @RequestBody Task incoming, ServerHttpRequest request) {
        String clientIp = resolveClientIp(request);

        if (moderationService.isBlocked(clientIp)) {
            return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tu IP quedó bloqueada por lenguaje ofensivo repetido. Este es un demo público compartido, sé respetuoso."));
        }

        Optional<String> blockedWord = moderationService.findBlockedWord(incoming.getTitle(), incoming.getDescription());
        if (blockedWord.isPresent()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, violationMessage(clientIp)));
        }

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

    private String violationMessage(String clientIp) {
        int violations = moderationService.recordViolation(clientIp);
        if (violations >= ContentModerationService.MAX_VIOLATIONS) {
            return "Evita lenguaje ofensivo. Alcanzaste el límite de avisos (" + violations + "/"
                    + ContentModerationService.MAX_VIOLATIONS + "): ya no podrás crear ni editar tareas.";
        }
        return "Evita lenguaje ofensivo en las tareas. Aviso " + violations + "/" + ContentModerationService.MAX_VIOLATIONS + ".";
    }

    private String resolveClientIp(ServerHttpRequest request) {
        String cfConnectingIp = request.getHeaders().getFirst("CF-Connecting-IP");
        if (cfConnectingIp != null && !cfConnectingIp.isBlank()) {
            return cfConnectingIp;
        }
        String forwardedFor = request.getHeaders().getFirst("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddress() != null
                ? request.getRemoteAddress().getAddress().getHostAddress()
                : "unknown";
    }
}
