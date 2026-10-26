package pe.taskflow.board.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import pe.taskflow.board.auth.UsuarioActual;
import pe.taskflow.board.config.TaskEventPublisher;
import pe.taskflow.board.gestion.IncidenciaService;
import pe.taskflow.board.ventas.OrdenService;
import pe.taskflow.board.demo.ContentModerationService;
import pe.taskflow.board.demo.DemoStatsService;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import pe.taskflow.board.model.TaskPositionUpdate;
import pe.taskflow.board.repository.TaskRepository;
import pe.taskflow.board.util.ClientIpResolver;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
@Tag(name = "Tasks", description = "CRUD del tablero + stream en tiempo real por Server-Sent Events")
public class TaskController {

    private final TaskRepository taskRepository;
    private final TaskEventPublisher eventPublisher;
    private final ContentModerationService moderationService;
    private final DemoStatsService statsService;
    private final IncidenciaService incidenciaService;
    private final OrdenService ordenService;

    @Value("${app.demo.max-tasks-per-ip}")
    private int maxTasksPerIp;

    @Operation(summary = "Tareas de la tienda del usuario; el admin ve todas o filtra con ?tienda=")
    @GetMapping
    public Flux<Task> findAll(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        Long sede = UsuarioActual.de(jwt).tiendaVisible(tienda);
        return sede == null ? taskRepository.findAllByOrderByStatusAscPositionAsc()
                : taskRepository.findByTiendaIdOrderByStatusAscPositionAsc(sede);
    }

    /**
     * Algunos proxies/CDNs (p. ej. delante de Render) hacen buffering de respuestas
     * en streaming, lo que retrasa o bloquea la entrega de eventos SSE en vivo.
     * Los headers de abajo lo desactivan explícitamente, y el heartbeat cada 15s
     * mantiene el flujo activo aunque no haya cambios de tareas.
     */
    @Operation(summary = "Stream de eventos en vivo (SSE): creación, edición, borrado, reset y presencia de visitantes")
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<TaskEvent>> stream(ServerWebExchange exchange, @AuthenticationPrincipal Jwt jwt) {
        UsuarioActual usuario = UsuarioActual.de(jwt);
        exchange.getResponse().getHeaders().add("X-Accel-Buffering", "no");
        exchange.getResponse().getHeaders().add("Cache-Control", "no-cache, no-transform");

        statsService.recordVisitor();
        statsService.recordVisitorPersisted(ClientIpResolver.resolve(exchange.getRequest())).subscribe();
        int currentViewers = eventPublisher.registerViewer();

        Flux<ServerSentEvent<TaskEvent>> initialPresence = Flux.just(
                ServerSentEvent.builder(new TaskEvent(TaskEventType.PRESENCE, null, currentViewers)).build());

        // Cada usuario recibe solo los cambios de las tareas que puede ver.
        Flux<ServerSentEvent<TaskEvent>> events = eventPublisher.stream()
                .filter(event -> event.task() == null || usuario.puedeVer(event.task().getTiendaId()))
                .map(event -> ServerSentEvent.builder(event).build());

        Flux<ServerSentEvent<TaskEvent>> heartbeat = Flux.interval(Duration.ofSeconds(15))
                .map(tick -> ServerSentEvent.<TaskEvent>builder().comment("keep-alive").build());

        return Flux.merge(initialPresence, events, heartbeat)
                .doFinally(signal -> eventPublisher.unregisterViewer());
    }

    @Operation(summary = "Crea una tarea (moderada: bloquea lenguaje ofensivo y limita tareas por IP)")
    @PostMapping
    public Mono<Task> create(@Valid @RequestBody Task task, ServerHttpRequest request, @AuthenticationPrincipal Jwt jwt) {
        UsuarioActual usuario = UsuarioActual.de(jwt);
        String clientIp = ClientIpResolver.resolve(request);

        if (moderationService.isBlocked(clientIp)) {
            return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tu IP quedó bloqueada por lenguaje ofensivo repetido. Este es un demo público compartido, sé respetuoso."));
        }

        return moderationService.findBlockedWord(task.getTitle(), task.getDescription())
                .map(word -> Mono.<Task>error(new ResponseStatusException(HttpStatus.BAD_REQUEST, violationMessage(clientIp))))
                .orElseGet(() -> taskRepository.countByCreatedByIp(clientIp)
                        .flatMap(count -> {
                            // Al llegar al límite solo se deja de crear: lo que ya existe se conserva.
                            if (count >= maxTasksPerIp) {
                                return Mono.<Task>error(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                                        "Llegaste al máximo de " + maxTasksPerIp + " tareas por visitante. Mueve o termina las que ya creaste."));
                            }

                            task.setId(null);
                            task.setCreatedByIp(clientIp);
                            // El admin puede crear tareas generales (sin tienda); la tienda, solo en la suya.
                            task.setTiendaId(usuario.esAdmin() ? task.getTiendaId() : usuario.tiendaId());
                            task.setTipo("MANUAL");
                            task.setPrioridad(task.getPrioridad() == null ? "MEDIA" : task.getPrioridad());
                            task.setCreadoPor(usuario.usuario());
                            task.setProductoId(null);
                            task.setReferenciaId(null);
                            task.setTurnoId(null);
                            task.setEmpleadoId(null);
                            task.setAsignadaEn(null);
                            task.setMinutosEstimados(null);
                            task.setCreatedAt(LocalDateTime.now());
                            task.setUpdatedAt(LocalDateTime.now());
                            if (task.getStatus() == null) {
                                task.setStatus("TODO");
                            }
                            return taskRepository.save(task)
                                    .doOnSuccess(saved -> {
                                        eventPublisher.publish(TaskEventType.CREATED, saved);
                                        statsService.recordTaskCreated();
                                    });
                        }));
    }

    @Operation(summary = "Actualiza una tarea existente (título, descripción, columna, posición)")
    @PutMapping("/{id}")
    public Mono<Task> update(@PathVariable Long id, @Valid @RequestBody Task incoming, ServerHttpRequest request,
                             @AuthenticationPrincipal Jwt jwt) {
        UsuarioActual usuario = UsuarioActual.de(jwt);
        String clientIp = ClientIpResolver.resolve(request);

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
                .doOnNext(existing -> usuario.exigirAcceso(existing.getTiendaId()))
                .flatMap(existing -> {
                    existing.setTitle(incoming.getTitle());
                    existing.setDescription(incoming.getDescription());
                    existing.setPosition(incoming.getPosition());
                    if (incoming.getPrioridad() != null) {
                        existing.setPrioridad(incoming.getPrioridad());
                    }
                    existing.setAsignadoA(incoming.getAsignadoA());
                    cambiarEstado(existing, incoming.getStatus());
                    return taskRepository.save(existing);
                })
                .flatMap(this::despuesDeGuardar);
    }

    /**
     * Reordena/mueve varias tareas de una sola vez (p. ej. tras un drag & drop),
     * para que todas las posiciones afectadas queden consistentes en una sola llamada.
     */
    @Operation(summary = "Reordena/mueve varias tareas en una sola llamada (usado por el drag & drop)")
    @PutMapping("/reorder")
    public Flux<Task> reorder(@RequestBody List<TaskPositionUpdate> updates, @AuthenticationPrincipal Jwt jwt) {
        UsuarioActual usuario = UsuarioActual.de(jwt);
        return Flux.fromIterable(updates)
                .concatMap(update -> taskRepository.findById(update.id())
                        .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea no encontrada: " + update.id())))
                        .doOnNext(existing -> usuario.exigirAcceso(existing.getTiendaId()))
                        .flatMap(existing -> {
                            cambiarEstado(existing, update.status());
                            existing.setPosition(update.position());
                            return taskRepository.save(existing);
                        })
                        .flatMap(this::despuesDeGuardar));
    }

    /** Al llegar a Hecho se guarda cuándo; si vuelve atrás, se limpia. */
    private static void cambiarEstado(Task tarea, String nuevo) {
        if ("DONE".equals(nuevo) && !"DONE".equals(tarea.getStatus())) {
            tarea.setCerradaEn(LocalDateTime.now());
        } else if (!"DONE".equals(nuevo)) {
            tarea.setCerradaEn(null);
        }
        // Vuelve a "Por hacer": queda sin asignar.
        if ("TODO".equals(nuevo) && !"TODO".equals(tarea.getStatus())) {
            tarea.setEmpleadoId(null);
            tarea.setAsignadaEn(null);
            tarea.setMinutosEstimados(null);
        }
        tarea.setStatus(nuevo);
        tarea.setUpdatedAt(LocalDateTime.now());
    }

    private Mono<Task> despuesDeGuardar(Task saved) {
        eventPublisher.publish(TaskEventType.UPDATED, saved);
        return incidenciaService.alCerrarTarea(saved).then(ordenService.alCerrarTarea(saved)).thenReturn(saved);
    }

    @Operation(summary = "Elimina una tarea por id")
    @DeleteMapping("/{id}")
    public Mono<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        UsuarioActual usuario = UsuarioActual.de(jwt);
        return taskRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea no encontrada: " + id)))
                .doOnNext(tarea -> {
                    usuario.exigirAcceso(tarea.getTiendaId());
                    // Las automáticas (alertas, incidencias, checklist) se cierran, no se borran.
                    if (!usuario.esAdmin() && tarea.getTipo() != null && !"MANUAL".equals(tarea.getTipo())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Las tareas automáticas no se borran: muévelas a Hecho.");
                    }
                })
                .flatMap(tarea -> taskRepository.deleteById(id)
                        .doOnSuccess(v -> eventPublisher.publish(TaskEventType.DELETED,
                                Task.builder().id(id).tiendaId(tarea.getTiendaId()).build())));
    }

    private String violationMessage(String clientIp) {
        int violations = moderationService.recordViolation(clientIp);
        if (violations >= ContentModerationService.MAX_VIOLATIONS) {
            return "Evita lenguaje ofensivo. Alcanzaste el límite de avisos (" + violations + "/"
                    + ContentModerationService.MAX_VIOLATIONS + "): ya no podrás crear ni editar tareas.";
        }
        return "Evita lenguaje ofensivo en las tareas. Aviso " + violations + "/" + ContentModerationService.MAX_VIOLATIONS + ".";
    }
}
