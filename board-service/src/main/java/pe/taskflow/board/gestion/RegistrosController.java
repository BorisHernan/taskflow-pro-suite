package pe.taskflow.board.gestion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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

/** Mermas, incidencias y pedidos de reposición: lo que se registra en el día a día de la tienda. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Registros de tienda", description = "Mermas, incidencias y pedidos de reposición")
public class RegistrosController {

    private final MermaService mermas;
    private final IncidenciaService incidencias;
    private final PedidoService pedidos;

    @Operation(summary = "Mermas registradas, de la más nueva a la más antigua")
    @GetMapping("/mermas")
    public Flux<Merma> mermas(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        return mermas.listar(UsuarioActual.de(jwt), tienda);
    }

    @Operation(summary = "Registra una merma: descuenta stock y, si es robo, abre una incidencia")
    @PostMapping("/mermas")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Merma> nuevaMerma(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Solicitudes.NuevaMerma req) {
        return mermas.registrar(UsuarioActual.de(jwt), req);
    }

    @Operation(summary = "Incidencias: abiertas y graves primero")
    @GetMapping("/incidencias")
    public Flux<Incidencia> incidencias(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        return incidencias.listar(UsuarioActual.de(jwt), tienda);
    }

    @Operation(summary = "Reporta una incidencia; las graves crean una tarea en el tablero")
    @PostMapping("/incidencias")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Incidencia> nuevaIncidencia(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Solicitudes.NuevaIncidencia req) {
        return incidencias.crear(UsuarioActual.de(jwt), req);
    }

    @Operation(summary = "Cambia el estado de una incidencia (y mueve su tarea)")
    @PatchMapping("/incidencias/{id}")
    public Mono<Incidencia> estadoIncidencia(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                                             @Valid @RequestBody Solicitudes.CambioIncidencia req) {
        return incidencias.cambiarEstado(UsuarioActual.de(jwt), id, req);
    }

    @Operation(summary = "Pedidos de reposición: pendientes primero")
    @GetMapping("/pedidos")
    public Flux<Pedido> pedidos(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        return pedidos.listar(UsuarioActual.de(jwt), tienda);
    }

    @Operation(summary = "Pide reposición al almacén central")
    @PostMapping("/pedidos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Pedido> nuevoPedido(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Solicitudes.NuevoPedido req) {
        return pedidos.crear(UsuarioActual.de(jwt), req);
    }

    @Operation(summary = "Aprueba un pedido (solo admin)")
    @PostMapping("/pedidos/{id}/aprobar")
    public Mono<Pedido> aprobar(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return pedidos.aprobar(UsuarioActual.de(jwt), id);
    }

    @Operation(summary = "Rechaza un pedido (solo admin)")
    @PostMapping("/pedidos/{id}/rechazar")
    public Mono<Pedido> rechazar(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                                 @Valid @RequestBody Solicitudes.RevisionPedido req) {
        return pedidos.rechazar(UsuarioActual.de(jwt), id, req);
    }

    @Operation(summary = "Marca el pedido como recibido y suma el stock")
    @PostMapping("/pedidos/{id}/recibir")
    public Mono<Pedido> recibir(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return pedidos.recibir(UsuarioActual.de(jwt), id);
    }
}
