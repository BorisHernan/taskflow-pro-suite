package pe.taskflow.board.demo;

import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.DoubleAdder;

/**
 * Contadores del demo para el dashboard de estadísticas. La mayoría vive en
 * memoria (no en la base de datos): se reinician con cada despliegue, algo
 * que se deja claro en el frontend en vez de pretender que son datos
 * históricos. También se registran como métricas de Micrometer, visibles en
 * /actuator/metrics. La única excepción es el total de visitas histórico,
 * que sí se persiste vía VisitCounterRepository para sobrevivir reinicios.
 */
@Component
public class DemoStatsService {

    private static final Logger log = LoggerFactory.getLogger(DemoStatsService.class);

    private final AtomicLong tasksCreated = new AtomicLong();
    private final AtomicLong purchases = new AtomicLong();
    private final AtomicLong unitsSold = new AtomicLong();
    private final DoubleAdder revenue = new DoubleAdder();
    private final AtomicLong totalVisitors = new AtomicLong();
    private final VisitCounterRepository visitCounterRepository;

    public DemoStatsService(MeterRegistry registry, VisitCounterRepository visitCounterRepository) {
        this.visitCounterRepository = visitCounterRepository;
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

    /**
     * Incrementa el contador persistido en Postgres. Se llama aparte de
     * recordVisitor() y no bloquea la conexión SSE que la dispara: si la
     * escritura falla (ej. un hiccup de la base de datos), se registra el
     * error y se sigue sin romper el stream, porque esto es solo una
     * métrica informativa, no algo crítico para el funcionamiento del demo.
     */
    public Mono<Void> recordVisitorPersisted() {
        return visitCounterRepository.increment()
                .doOnError(err -> log.warn("No se pudo persistir la visita", err))
                .onErrorResume(err -> Mono.empty())
                .then();
    }

    public Mono<StatsSnapshot> snapshot() {
        return visitCounterRepository.findById(1)
                .map(VisitCounter::getTotalVisits)
                .defaultIfEmpty(0L)
                .map(totalVisitsAllTime -> new StatsSnapshot(
                        tasksCreated.get(),
                        purchases.get(),
                        unitsSold.get(),
                        BigDecimal.valueOf(revenue.sum()).setScale(2, RoundingMode.HALF_UP),
                        totalVisitors.get(),
                        totalVisitsAllTime
                ));
    }
}
