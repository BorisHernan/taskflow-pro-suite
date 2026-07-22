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
import java.util.Map;

/**
 * Este board es un demo público sin login: cualquiera puede crear/mover/borrar tareas
 * y comprar del catálogo de la tienda simulada. Para que siempre se vea presentable,
 * esta tarea programada borra las tareas y vuelve a dejar las 4 semilla originales,
 * repone el stock de la tienda a sus valores iniciales, y le da borrón y cuenta nueva
 * a los visitantes bloqueados por lenguaje ofensivo.
 */
@Component
@RequiredArgsConstructor
public class DemoResetScheduler {

    private static final Logger log = LoggerFactory.getLogger(DemoResetScheduler.class);

    private static final Map<String, Integer> SEED_STOCK = Map.of(
            "Taza \"Bug Free\"", 20,
            "Sticker pack \"console.log\"", 50,
            "Polo \"It works on my machine\"", 15,
            "Llavero USB decorativo", 30,
            "Mousepad \"git commit -m fix\"", 10,
            "Termo \"Café o muerte\"", 12
    );

    private final TaskRepository taskRepository;
    private final TaskEventPublisher eventPublisher;
    private final ContentModerationService moderationService;
    private final ProductRepository productRepository;
    private final ProductEventPublisher productEventPublisher;

    @Scheduled(cron = "${app.demo.reset-cron:0 0 3 * * *}")
    public void resetDemoData() {
        taskRepository.deleteAll()
                .thenMany(Flux.fromIterable(seedTasks()))
                .flatMap(taskRepository::save)
                .doOnComplete(() -> {
                    moderationService.resetViolations();
                    eventPublisher.publish(TaskEventType.RESET, null);
                    log.info("Demo tasks reset to seed data");
                })
                .doOnError(err -> log.error("Failed to reset demo tasks", err))
                .subscribe();

        productRepository.findAll()
                .flatMap(product -> {
                    Integer seedStock = SEED_STOCK.get(product.getName());
                    if (seedStock != null) {
                        product.setStock(seedStock);
                    }
                    return productRepository.save(product);
                })
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
