package pe.taskflow.board.demo;

import java.math.BigDecimal;

/** Contadores acumulados desde el último despliegue (no persisten entre reinicios). */
public record StatsSnapshot(
        long tasksCreated,
        long purchases,
        long unitsSold,
        BigDecimal revenue,
        long totalVisitors
) {
}
