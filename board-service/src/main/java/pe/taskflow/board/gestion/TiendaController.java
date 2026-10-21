package pe.taskflow.board.gestion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/tiendas")
@RequiredArgsConstructor
@Tag(name = "Tiendas", description = "Sedes de la cadena")
public class TiendaController {

    private final TiendaRepository repository;

    @Operation(summary = "Lista las tiendas (pública: la usa el selector de la tienda online)")
    @GetMapping
    public Flux<Tienda> listar() {
        return repository.findAllByOrderByCodigoAsc();
    }
}
