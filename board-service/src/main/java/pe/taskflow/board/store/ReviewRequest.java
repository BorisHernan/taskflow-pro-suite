package pe.taskflow.board.store;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReviewRequest(
        @NotBlank(message = "Escribe tu nombre") @Size(max = 40, message = "El nombre admite hasta 40 caracteres") String author,
        @NotNull @Min(value = 1, message = "La calificación va de 1 a 5") @Max(value = 5, message = "La calificación va de 1 a 5") Integer rating,
        @NotBlank(message = "Escribe un comentario") @Size(max = 500, message = "El comentario admite hasta 500 caracteres") String comment
) {
}
