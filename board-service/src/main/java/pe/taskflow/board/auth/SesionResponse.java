package pe.taskflow.board.auth;

import java.time.Instant;

public record SesionResponse(String token, Instant expira, Perfil usuario) {

    public record Perfil(String usuario, String nombre, String rol, Long tiendaId, String tiendaNombre) {
    }
}
