package pe.taskflow.board.demo;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.taskflow.board.store.PurchaseRepository;
import pe.taskflow.board.store.PurchaseTotals;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DemoStatsServiceTest {

    @Mock
    private VisitCounterRepository visitCounterRepository;

    @Mock
    private PurchaseRepository purchaseRepository;

    private DemoStatsService statsService;

    @BeforeEach
    void setUp() {
        statsService = new DemoStatsService(new SimpleMeterRegistry(), visitCounterRepository, purchaseRepository);
    }

    @Test
    void elSnapshotCombinaContadoresEnMemoriaConLosPersistidos() {
        statsService.recordTaskCreated();
        statsService.recordVisitor();
        when(purchaseRepository.totales()).thenReturn(Mono.just(new PurchaseTotals(1, 3, new BigDecimal("15.5"))));

        VisitCounter counter = new VisitCounter();
        counter.setId(1);
        counter.setTotalVisits(42L);
        when(visitCounterRepository.findById(1)).thenReturn(Mono.just(counter));

        StepVerifier.create(statsService.snapshot())
                .expectNextMatches(snapshot ->
                        snapshot.tasksCreated() == 1
                                && snapshot.purchases() == 1
                                && snapshot.unitsSold() == 3
                                && snapshot.revenue().compareTo(new BigDecimal("15.50")) == 0
                                && snapshot.totalVisitors() == 1
                                && snapshot.totalVisitsAllTime() == 42L)
                .verifyComplete();
    }

    @Test
    void siNoHayFilaPersistidaElTotalHistoricoEsCero() {
        when(visitCounterRepository.findById(1)).thenReturn(Mono.empty());
        when(purchaseRepository.totales()).thenReturn(Mono.empty());

        StepVerifier.create(statsService.snapshot())
                .expectNextMatches(snapshot -> snapshot.totalVisitsAllTime() == 0L)
                .verifyComplete();
    }

    @Test
    void unFalloAlPersistirLaVisitaNoPropagaError() {
        when(visitCounterRepository.incrementIfNewVisitorToday("1.2.3.4"))
                .thenReturn(Mono.error(new RuntimeException("db caida")));

        StepVerifier.create(statsService.recordVisitorPersisted("1.2.3.4"))
                .verifyComplete();
    }
}
