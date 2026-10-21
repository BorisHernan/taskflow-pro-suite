package pe.taskflow.board.gestion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.taskflow.board.auth.UsuarioActual;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/inventario")
@RequiredArgsConstructor
@Tag(name = "Inventario", description = "Stock por tienda con alertas de reposición")
public class InventarioController {

    private final InventarioService service;

    @Operation(summary = "Stock de la tienda, lo más urgente primero (el admin puede pedir ?tienda= o todas)")
    @GetMapping
    public Flux<InventarioVista> listar(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        return service.listar(UsuarioActual.de(jwt).tiendaVisible(tienda));
    }

    @Operation(summary = "Cambia el stock mínimo y el objetivo de un producto en una tienda (solo admin)")
    @PutMapping("/{id}/niveles")
    public Mono<Inventario> niveles(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                                    @Valid @RequestBody Solicitudes.NivelesInventario req) {
        UsuarioActual.de(jwt).exigirAdmin();
        if (req.stockObjetivo() <= req.stockMinimo()) {
            return Mono.error(Errores.invalido("El stock objetivo debe ser mayor que el mínimo."));
        }
        return service.buscar(id)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Fila de inventario no encontrada")))
                .then(service.cambiarNiveles(id, req.stockMinimo(), req.stockObjetivo()));
    }
}
