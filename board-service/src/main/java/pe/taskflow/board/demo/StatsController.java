package pe.taskflow.board.demo;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
@Tag(name = "Stats", description = "Contadores del demo e historial agregado para los gráficos")
public class StatsController {

    private final DemoStatsService statsService;
    private final HistorialStatsService historialService;

    @Operation(summary = "Contadores acumulados del demo")
    @GetMapping
    public Mono<StatsSnapshot> stats() {
        return statsService.snapshot();
    }

    @Operation(summary = "Series y agrupaciones para los gráficos (visitas, ventas, tareas, reseñas, stock)")
    @GetMapping("/historial")
    public Mono<HistorialStats> historial() {
        return historialService.historial();
    }
}
