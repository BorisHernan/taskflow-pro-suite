package pe.taskflow.board.demo;

import java.math.BigDecimal;

/** tasksCreated y totalVisitors viven en memoria; el resto se lee de Postgres. */
public record StatsSnapshot(
        long tasksCreated,
        long purchases,
        long unitsSold,
        BigDecimal revenue,
        long totalVisitors,
        long totalVisitsAllTime
) {
}
