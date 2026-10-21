package pe.taskflow.board.gestion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pe.taskflow.board.auth.UsuarioActual;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/turnos")
@RequiredArgsConstructor
@Tag(name = "Turnos", description = "Apertura y cierre de turnos con checklist y resumen")
public class TurnoController {

    private final TurnoService service;

    @Operation(summary = "Turno abierto de la tienda (204 si no hay)")
    @GetMapping("/actual")
    public Mono<ResponseEntity<Turno>> actual(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        return service.actual(UsuarioActual.de(jwt), tienda)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.noContent().build());
    }

    @Operation(summary = "Últimos 30 turnos")
    @GetMapping
    public Flux<Turno> historial(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        return service.historial(UsuarioActual.de(jwt), tienda);
    }

    @Operation(summary = "Abre un turno y genera su checklist en el tablero")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Turno> abrir(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Solicitudes.AbrirTurno req) {
        return service.abrir(UsuarioActual.de(jwt), req);
    }

    @Operation(summary = "Cierra el turno y devuelve su resumen")
    @PostMapping("/{id}/cerrar")
    public Mono<TurnoService.Resumen> cerrar(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                                             @Valid @RequestBody Solicitudes.CerrarTurno req) {
        return service.cerrar(UsuarioActual.de(jwt), id, req);
    }

    @Operation(summary = "Ventas, mermas, incidencias y tareas del turno")
    @GetMapping("/{id}/resumen")
    public Mono<TurnoService.Resumen> resumen(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.resumen(UsuarioActual.de(jwt), id);
    }
}
