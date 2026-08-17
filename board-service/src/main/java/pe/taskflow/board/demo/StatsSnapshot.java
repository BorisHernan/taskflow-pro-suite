package pe.taskflow.board.demo;

import java.math.BigDecimal;

/**
 * tasksCreated/purchases/unitsSold/revenue/totalVisitors viven en memoria y se
 * reinician con cada despliegue. totalVisitsAllTime es la única cifra que
 * persiste en Postgres y sobrevive a reinicios/deploys.
 */
public record StatsSnapshot(
        long tasksCreated,
        long purchases,
        long unitsSold,
        BigDecimal revenue,
        long totalVisitors,
        long totalVisitsAllTime
) {
}
