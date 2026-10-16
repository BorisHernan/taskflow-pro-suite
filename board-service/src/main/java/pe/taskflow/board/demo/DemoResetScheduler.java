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
import pe.taskflow.board.store.ProductEventPublisher;
import pe.taskflow.board.store.ProductRepository;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Mantenimiento diario del demo público. No borra nada de lo que hicieron los
 * visitantes (tareas, reseñas, visitas): el historial se conserva. Solo repone
 * el stock de la tienda, vuelve a sembrar el tablero si quedó vacío y le da
 * borrón y cuenta nueva a los visitantes bloqueados por lenguaje ofensivo.
 */
@Component
@RequiredArgsConstructor
public class DemoResetScheduler {

    private static final Logger log = LoggerFactory.getLogger(DemoResetScheduler.class);

    private final TaskRepository taskRepository;
    private final TaskEventPublisher eventPublisher;
    private final ContentModerationService moderationService;
    private final ProductRepository productRepository;
    private final ProductEventPublisher productEventPublisher;

    @Scheduled(cron = "${app.demo.reset-cron:0 0 3 * * *}")
    public void resetDemoData() {
        moderationService.resetViolations();

        // Solo si alguien vació el tablero se vuelven a poner las tareas iniciales.
        taskRepository.count()
                .filter(total -> total == 0)
                .flatMapMany(vacio -> Flux.fromIterable(seedTasks()).flatMap(taskRepository::save))
                .doOnComplete(() -> eventPublisher.publish(TaskEventType.RESET, null))
                .doOnError(err -> log.error("Failed to reseed empty board", err))
                .subscribe();

        // Cada producto vuelve a su initial_stock (columna de la tabla) y se avisa por SSE.
        productRepository.reponerStock()
                .thenMany(productRepository.findAllByOrderByIdAsc())
                .doOnNext(productEventPublisher::publish)
                .doOnComplete(() -> log.info("Store stock restocked to seed levels"))
                .doOnError(err -> log.error("Failed to restock products", err))
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
