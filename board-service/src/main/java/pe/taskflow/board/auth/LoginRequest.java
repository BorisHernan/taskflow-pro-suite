package pe.taskflow.board.auth;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank String usuario, @NotBlank String clave) {
}
