package pe.taskflow.board.ventas;

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
import pe.taskflow.board.ventas.SolicitudesOrden.CambioEstado;
import pe.taskflow.board.ventas.SolicitudesOrden.NuevaOrden;
import pe.taskflow.board.ventas.SolicitudesOrden.OrdenVista;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/ordenes")
@RequiredArgsConstructor
@Tag(name = "Pedidos de clientes", description = "Compra de la tienda online, seguimiento y despacho")
public class OrdenController {

    private final OrdenService service;

    @Operation(summary = "Compra completa (pública): descuenta el stock de la sede en una sola transacción y crea el pedido")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<OrdenVista> crear(@Valid @RequestBody NuevaOrden req) {
        return service.crear(req);
    }

    @Operation(summary = "Seguimiento público de un pedido por su código")
    @GetMapping("/seguimiento/{codigo}")
    public Mono<OrdenVista> seguimiento(@PathVariable String codigo) {
        return service.seguimiento(codigo);
    }

    @Operation(summary = "Pedidos de clientes de la tienda (pendientes primero)")
    @GetMapping
    public Flux<OrdenVista> listar(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        return service.listar(UsuarioActual.de(jwt), tienda);
    }

    @Operation(summary = "Avanza el pedido al siguiente estado de su modalidad")
    @PatchMapping("/{id}/estado")
    public Mono<OrdenVista> avanzar(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody CambioEstado req) {
        return service.avanzar(UsuarioActual.de(jwt), id, req.estado());
    }
}
