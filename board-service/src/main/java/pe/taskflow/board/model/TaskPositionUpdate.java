package pe.taskflow.board.model;

import jakarta.validation.constraints.NotNull;

public record TaskPositionUpdate(
        @NotNull Long id,
        @NotNull String status,
        @NotNull Integer position
) {
}
