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
@Tag(name = "Stats", description = "Contadores del demo (tareas, ventas, visitantes) desde el último despliegue")
public class StatsController {

    private final DemoStatsService statsService;

    @Operation(summary = "Contadores acumulados del demo")
    @GetMapping
    public Mono<StatsSnapshot> stats() {
        return Mono.just(statsService.snapshot());
    }
}
