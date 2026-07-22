package pe.taskflow.board.demo;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.DoubleAdder;

/**
 * Contadores del demo para el dashboard de estadísticas. Viven en memoria
 * (no en la base de datos): se reinician con cada despliegue, algo que se
 * deja claro en el frontend en vez de pretender que son datos históricos.
 * También se registran como métricas de Micrometer, visibles en /actuator/metrics.
 */
@Component
public class DemoStatsService {

    private final AtomicLong tasksCreated = new AtomicLong();
    private final AtomicLong purchases = new AtomicLong();
    private final AtomicLong unitsSold = new AtomicLong();
    private final DoubleAdder revenue = new DoubleAdder();
    private final AtomicLong totalVisitors = new AtomicLong();

    public DemoStatsService(MeterRegistry registry) {
        registry.gauge("demo.tasks.created", tasksCreated);
        registry.gauge("demo.store.purchases", purchases);
        registry.gauge("demo.store.units.sold", unitsSold);
        registry.gauge("demo.store.revenue", revenue, DoubleAdder::sum);
        registry.gauge("demo.visitors.total", totalVisitors);
    }

    public void recordTaskCreated() {
        tasksCreated.incrementAndGet();
    }

    public void recordPurchase(int quantity, BigDecimal lineTotal) {
        purchases.incrementAndGet();
        unitsSold.addAndGet(quantity);
        revenue.add(lineTotal.doubleValue());
    }

    public void recordVisitor() {
        totalVisitors.incrementAndGet();
    }

    public StatsSnapshot snapshot() {
        return new StatsSnapshot(
                tasksCreated.get(),
                purchases.get(),
                unitsSold.get(),
                BigDecimal.valueOf(revenue.sum()).setScale(2, RoundingMode.HALF_UP),
                totalVisitors.get()
        );
    }
}
