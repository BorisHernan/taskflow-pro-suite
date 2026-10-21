package pe.taskflow.board.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

/**
 * Quién hace la petición, leído del JWT. Un usuario de tienda solo ve y toca
 * su sede; el administrador ve todas (o la que pida con ?tienda=).
 */
public record UsuarioActual(String usuario, String nombre, String rol, Long tiendaId) {

    public static UsuarioActual de(Jwt jwt) {
        Number tienda = jwt.getClaim("tiendaId");
        return new UsuarioActual(jwt.getSubject(), jwt.getClaimAsString("nombre"), jwt.getClaimAsString("rol"),
                tienda == null ? null : tienda.longValue());
    }

    public boolean esAdmin() {
        return Usuario.ADMIN.equals(rol);
    }

    /** La propia para un usuario de tienda; la pedida (o todas, si es null) para el admin. */
    public Long tiendaVisible(Long pedida) {
        return esAdmin() ? pedida : tiendaId;
    }

    /** Donde se registra algo nuevo: el admin debe indicarla, la tienda usa la suya. */
    public long tiendaParaRegistrar(Long pedida) {
        Long tienda = esAdmin() ? pedida : tiendaId;
        if (tienda == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica la tienda.");
        }
        return tienda;
    }

    public void exigirAcceso(Long tienda) {
        if (!puedeVer(tienda)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes acceso a otra tienda.");
        }
    }

    public boolean puedeVer(Long tienda) {
        return esAdmin() || (tienda != null && tienda.equals(tiendaId));
    }

    public void exigirAdmin() {
        if (!esAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el administrador puede hacer esto.");
        }
    }
}
