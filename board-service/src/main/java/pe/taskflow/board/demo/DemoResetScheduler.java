package pe.taskflow.board.demo;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import pe.taskflow.board.gestion.InventarioService;

/**
 * Mantenimiento nocturno. No borra nada de lo que hicieron los visitantes:
 * el historial se conserva. Solo repone lo que quedó agotado (las alertas
 * de stock bajo siguen esperando su pedido) y levanta los bloqueos por
 * lenguaje ofensivo.
 */
@Component
@RequiredArgsConstructor
public class DemoResetScheduler {

    private static final Logger log = LoggerFactory.getLogger(DemoResetScheduler.class);

    private final ContentModerationService moderationService;
    private final InventarioService inventario;

    @Scheduled(cron = "${app.demo.reset-cron:0 0 3 * * *}")
    public void resetDemoData() {
        moderationService.resetViolations();

        inventario.reponerAgotados()
                .count()
                .doOnNext(n -> log.info("Reposición nocturna: {} productos agotados repuestos", n))
                .doOnError(err -> log.error("Falló la reposición nocturna", err))
                .onErrorComplete()
                .subscribe();
    }
}
