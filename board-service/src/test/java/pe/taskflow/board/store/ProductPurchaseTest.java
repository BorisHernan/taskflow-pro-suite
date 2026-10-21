package pe.taskflow.board.store;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import pe.taskflow.board.demo.ContentModerationService;
import pe.taskflow.board.demo.DemoStatsService;
import pe.taskflow.board.gestion.Inventario;
import pe.taskflow.board.gestion.InventarioService;
import pe.taskflow.board.gestion.TurnoService;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductPurchaseTest {

    @Mock private ProductRepository productRepository;
    @Mock private ProductEventPublisher eventPublisher;
    @Mock private DemoStatsService statsService;
    @Mock private ProductReviewRepository reviewRepository;
    @Mock private ContentModerationService moderation;
    @Mock private PurchaseRepository purchaseRepository;
    @Mock private InventarioService inventario;
    @Mock private TurnoService turnos;

    private ProductController controller;

    @BeforeEach
    void setUp() {
        controller = new ProductController(productRepository, eventPublisher, statsService, reviewRepository, moderation,
                purchaseRepository, inventario, turnos);
    }

    private static Product teclado() {
        return Product.builder().id(7L).name("Teclado").category("Tecnología").price(new BigDecimal("189.00")).build();
    }

    @Test
    void laCompraDescuentaElStockDeLaSedeYQuedaEnSuTurno() {
        when(productRepository.findById(7L)).thenReturn(Mono.just(teclado()));
        when(inventario.descontar(3L, 7L, 2)).thenReturn(Mono.just(Inventario.builder().tiendaId(3L).productoId(7L).stock(2).build()));
        when(turnos.idAbierto(3L)).thenReturn(Mono.just(40L));
        when(purchaseRepository.save(any(Purchase.class))).thenAnswer(inv -> Mono.just(inv.getArgument(0)));

        StepVerifier.create(controller.purchase(7L, new PurchaseRequest(2, 3L)))
                .expectNextMatches(p -> p.getStock() == 2 && p.getTiendaId() == 3L)
                .verifyComplete();

        ArgumentCaptor<Purchase> compra = ArgumentCaptor.forClass(Purchase.class);
        verify(purchaseRepository).save(compra.capture());
        assertThat(compra.getValue().getTiendaId()).isEqualTo(3L);
        assertThat(compra.getValue().getTurnoId()).isEqualTo(40L);
        assertThat(compra.getValue().getTotal()).isEqualByComparingTo("378.00");
    }

    @Test
    void sinSedeSeCompraEnLaTiendaPrincipal() {
        when(productRepository.findById(7L)).thenReturn(Mono.just(teclado()));
        when(inventario.descontar(ProductController.TIENDA_PRINCIPAL, 7L, 1))
                .thenReturn(Mono.just(Inventario.builder().tiendaId(1L).productoId(7L).stock(9).build()));
        when(turnos.idAbierto(1L)).thenReturn(Mono.empty());
        when(purchaseRepository.save(any(Purchase.class))).thenAnswer(inv -> Mono.just(inv.getArgument(0)));

        StepVerifier.create(controller.purchase(7L, new PurchaseRequest(1, null)))
                .expectNextMatches(p -> p.getStock() == 9)
                .verifyComplete();
    }

    @Test
    void sinStockSuficienteNoSeGuardaNada() {
        when(productRepository.findById(7L)).thenReturn(Mono.just(teclado()));
        when(inventario.descontar(1L, 7L, 2)).thenReturn(Mono.empty());
        when(inventario.stockActual(1L, 7L)).thenReturn(Mono.just(1));

        StepVerifier.create(controller.purchase(7L, new PurchaseRequest(2, 1L)))
                .expectErrorMatches(e -> e instanceof ResponseStatusException rse && rse.getStatusCode() == HttpStatus.CONFLICT)
                .verify();

        verifyNoInteractions(purchaseRepository);
    }
}
