package pe.taskflow.board.model;

public record TaskEvent(TaskEventType type, Task task) {

    public enum TaskEventType {
        CREATED, UPDATED, DELETED
    }
}
