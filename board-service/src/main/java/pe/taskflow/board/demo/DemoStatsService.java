package pe.taskflow.board.demo;

import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import pe.taskflow.board.store.PurchaseRepository;
import pe.taskflow.board.store.PurchaseTotals;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.DoubleAdder;

/**
 * Contadores del demo para el dashboard. Visitas totales y compras salen de
 * Postgres (historial permanente); tareas creadas y conexiones viven en memoria
 * y se reinician con cada despliegue. Todo se expone también en Micrometer.
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
    private final PurchaseRepository purchaseRepository;

    public DemoStatsService(MeterRegistry registry, VisitCounterRepository visitCounterRepository,
                            PurchaseRepository purchaseRepository) {
        this.visitCounterRepository = visitCounterRepository;
        this.purchaseRepository = purchaseRepository;
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
     * Incrementa el contador persistido en Postgres, solo si esta IP no
     * había visitado hoy (ver VisitCounterRepository.incrementIfNewVisitorToday).
     * Se llama aparte de recordVisitor() y no bloquea la conexión SSE que la
     * dispara: si la escritura falla (ej. un hiccup de la base de datos), se
     * registra el error y se sigue sin romper el stream, porque esto es solo
     * una métrica informativa, no algo crítico para el funcionamiento del demo.
     */
    public Mono<Void> recordVisitorPersisted(String clientIp) {
        return visitCounterRepository.incrementIfNewVisitorToday(clientIp)
                .doOnError(err -> log.warn("No se pudo persistir la visita", err))
                .onErrorResume(err -> Mono.empty())
                .then();
    }

    /** Compras, unidades e ingresos salen del historial en Postgres; el resto, de memoria. */
    public Mono<StatsSnapshot> snapshot() {
        Mono<Long> visitas = visitCounterRepository.findById(1)
                .map(VisitCounter::getTotalVisits)
                .defaultIfEmpty(0L);
        Mono<PurchaseTotals> compras = purchaseRepository.totales().defaultIfEmpty(PurchaseTotals.VACIO);

        return Mono.zip(visitas, compras).map(t -> new StatsSnapshot(
                tasksCreated.get(),
                t.getT2().compras(),
                t.getT2().unidades(),
                t.getT2().ingresos().setScale(2, RoundingMode.HALF_UP),
                totalVisitors.get(),
                t.getT1()
        ));
    }
}
