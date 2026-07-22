package pe.taskflow.board.model;

/** task es null cuando type es RESET: el frontend debe recargar la lista completa en ese caso. */
public record TaskEvent(TaskEventType type, Task task) {

    public enum TaskEventType {
        CREATED, UPDATED, DELETED, RESET
    }
}
