package pe.taskflow.board.config;

import org.springframework.stereotype.Component;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Publica cada cambio de tarea (crear, actualizar, mover, borrar) a todos los
 * clientes conectados por Server-Sent Events. Esto es lo que hace que el
 * tablero se actualice en vivo en todos los navegadores abiertos, sin refrescar.
 */
@Component
public class TaskEventPublisher {

    private final Sinks.Many<TaskEvent> sink = Sinks.many().multicast().onBackpressureBuffer();
    private final AtomicInteger activeViewers = new AtomicInteger(0);

    public void publish(TaskEventType type, Task task) {
        publish(type, task, null);
    }

    public void publish(TaskEventType type, Task task, Integer viewerCount) {
        sink.tryEmitNext(new TaskEvent(type, task, viewerCount));
    }

    public Flux<TaskEvent> stream() {
        return sink.asFlux();
    }

    /** @return el nuevo total de visitantes conectados, tras sumar este. */
    public int registerViewer() {
        int count = activeViewers.incrementAndGet();
        publish(TaskEventType.PRESENCE, null, count);
        return count;
    }

    /** @return el nuevo total de visitantes conectados, tras restar este. */
    public int unregisterViewer() {
        int count = activeViewers.updateAndGet(current -> Math.max(0, current - 1));
        publish(TaskEventType.PRESENCE, null, count);
        return count;
    }
}
