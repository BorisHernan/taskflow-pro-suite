package pe.taskflow.board.demo;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import pe.taskflow.board.config.TaskEventPublisher;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import pe.taskflow.board.repository.TaskRepository;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Este board es un demo público sin login: cualquiera puede crear/mover/borrar tareas.
 * Para que siempre se vea presentable, esta tarea programada borra todo y vuelve a dejar
 * las 4 tareas semilla originales, ademas de darle borrón y cuenta nueva a los visitantes
 * bloqueados por lenguaje ofensivo.
 */
@Component
@RequiredArgsConstructor
public class DemoResetScheduler {

    private static final Logger log = LoggerFactory.getLogger(DemoResetScheduler.class);

    private final TaskRepository taskRepository;
    private final TaskEventPublisher eventPublisher;
    private final ContentModerationService moderationService;

    @Scheduled(cron = "${app.demo.reset-cron:0 0 3 * * *}")
    public void resetDemoData() {
        taskRepository.deleteAll()
                .thenMany(Flux.fromIterable(seedTasks()))
                .flatMap(taskRepository::save)
                .doOnComplete(() -> {
                    moderationService.resetViolations();
                    eventPublisher.publish(TaskEventType.RESET, null);
                    log.info("Demo data reset to seed tasks");
                })
                .doOnError(err -> log.error("Failed to reset demo data", err))
                .subscribe();
    }

    private List<Task> seedTasks() {
        LocalDateTime now = LocalDateTime.now();
        return List.of(
                Task.builder()
                        .title("Diseñar el modelo de datos")
                        .description("Definir tablas y relaciones iniciales")
                        .status("DONE").position(1).createdAt(now).updatedAt(now).build(),
                Task.builder()
                        .title("Crear board-service")
                        .description("Endpoints CRUD reactivos con WebFlux")
                        .status("IN_PROGRESS").position(1).createdAt(now).updatedAt(now).build(),
                Task.builder()
                        .title("Conectar Angular con la API")
                        .description("Consumir /api/tasks desde el frontend")
                        .status("TODO").position(1).createdAt(now).updatedAt(now).build(),
                Task.builder()
                        .title("Agregar autenticación con Keycloak")
                        .description("Proteger endpoints con JWT")
                        .status("TODO").position(2).createdAt(now).updatedAt(now).build()
        );
    }
}
