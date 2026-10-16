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

    private ProductController controller;

    @BeforeEach
    void setUp() {
        controller = new ProductController(productRepository, eventPublisher, statsService, reviewRepository, moderation, purchaseRepository);
    }

    private static Product teclado(int stock) {
        return Product.builder().id(7L).name("Teclado").category("Tecnología").price(new BigDecimal("189.00")).stock(stock).build();
    }

    @Test
    void cadaCompraQuedaEnElHistorialYSeTransmite() {
        when(productRepository.findById(7L)).thenReturn(Mono.just(teclado(4)));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> Mono.just(inv.getArgument(0)));
        when(purchaseRepository.save(any(Purchase.class))).thenAnswer(inv -> Mono.just(inv.getArgument(0)));

        StepVerifier.create(controller.purchase(7L, new PurchaseRequest(2)))
                .expectNextMatches(p -> p.getStock() == 2)
                .verifyComplete();

        ArgumentCaptor<Purchase> compra = ArgumentCaptor.forClass(Purchase.class);
        verify(purchaseRepository).save(compra.capture());
        assertThat(compra.getValue().getProductName()).isEqualTo("Teclado");
        assertThat(compra.getValue().getCategory()).isEqualTo("Tecnología");
        assertThat(compra.getValue().getTotal()).isEqualByComparingTo("378.00");
        verify(eventPublisher).publish(any(Product.class));
    }

    @Test
    void sinStockSuficienteNoSeGuardaNada() {
        when(productRepository.findById(7L)).thenReturn(Mono.just(teclado(1)));

        StepVerifier.create(controller.purchase(7L, new PurchaseRequest(2)))
                .expectErrorMatches(e -> e instanceof ResponseStatusException rse && rse.getStatusCode() == HttpStatus.CONFLICT)
                .verify();

        verifyNoInteractions(purchaseRepository);
    }
}
