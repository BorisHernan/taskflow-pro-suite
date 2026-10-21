package pe.taskflow.board.auth;

import org.springframework.security.oauth2.jwt.Jwt;

/** JWT ya validados, para llamar a los controladores en tests unitarios. */
public final class Sesiones {

    private Sesiones() {
    }

    public static Jwt admin() {
        return Jwt.withTokenValue("t").header("alg", "HS256").subject("admin")
                .claim("nombre", "Ana Torres").claim("rol", Usuario.ADMIN).build();
    }

    public static Jwt tienda(long tiendaId) {
        return Jwt.withTokenValue("t").header("alg", "HS256").subject("tienda" + tiendaId)
                .claim("nombre", "Encargado").claim("rol", Usuario.TIENDA).claim("tiendaId", tiendaId).build();
    }
}
