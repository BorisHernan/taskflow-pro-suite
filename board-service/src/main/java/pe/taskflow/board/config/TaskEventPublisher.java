package pe.taskflow.board.config;

import org.springframework.stereotype.Component;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

/**
 * Publica cada cambio de tarea (crear, actualizar, mover, borrar) a todos los
 * clientes conectados por Server-Sent Events. Esto es lo que hace que el
 * tablero se actualice en vivo en todos los navegadores abiertos, sin refrescar.
 */
@Component
public class TaskEventPublisher {

    private final Sinks.Many<TaskEvent> sink = Sinks.many().multicast().onBackpressureBuffer();

    public void publish(TaskEventType type, Task task) {
        sink.tryEmitNext(new TaskEvent(type, task));
    }

    public Flux<TaskEvent> stream() {
        return sink.asFlux();
    }
}
