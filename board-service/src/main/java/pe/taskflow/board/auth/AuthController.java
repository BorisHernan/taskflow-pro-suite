package pe.taskflow.board.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import pe.taskflow.board.gestion.Tienda;
import pe.taskflow.board.gestion.TiendaRepository;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Login con JWT y perfil del usuario")
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final TiendaRepository tiendaRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Operation(summary = "Inicia sesión y devuelve un JWT válido por 12 horas")
    @PostMapping("/login")
    public Mono<SesionResponse> login(@Valid @RequestBody LoginRequest request) {
        return usuarioRepository.findByUsuario(request.usuario().trim().toLowerCase())
                .filter(u -> Boolean.TRUE.equals(u.getActivo()) && passwordEncoder.matches(request.clave(), u.getClaveHash()))
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario o clave incorrectos.")))
                .flatMap(u -> nombreTienda(u.getTiendaId()).map(nombre -> jwtService.emitir(u, nombre)));
    }

    @Operation(summary = "Perfil del usuario de la sesión")
    @GetMapping("/yo")
    public Mono<SesionResponse.Perfil> yo(@AuthenticationPrincipal Jwt jwt) {
        UsuarioActual u = UsuarioActual.de(jwt);
        return nombreTienda(u.tiendaId())
                .map(nombre -> new SesionResponse.Perfil(u.usuario(), u.nombre(), u.rol(), u.tiendaId(), nombre));
    }

    private Mono<String> nombreTienda(Long tiendaId) {
        if (tiendaId == null) {
            return Mono.just("Todas las tiendas");
        }
        return tiendaRepository.findById(tiendaId).map(Tienda::getNombre).defaultIfEmpty("");
    }
}
