package pe.taskflow.board.model;

/**
 * task es null cuando type es RESET o PRESENCE (el frontend debe recargar la lista
 * completa para RESET). viewerCount solo se usa para PRESENCE: cuántos visitantes
 * están conectados al stream SSE en este momento.
 */
public record TaskEvent(TaskEventType type, Task task, Integer viewerCount) {

    public enum TaskEventType {
        CREATED, UPDATED, DELETED, RESET, PRESENCE
    }
}
