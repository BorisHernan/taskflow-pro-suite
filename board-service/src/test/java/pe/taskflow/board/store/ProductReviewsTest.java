package pe.taskflow.board.store;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.web.server.ResponseStatusException;
import pe.taskflow.board.demo.ContentModerationService;
import pe.taskflow.board.demo.DemoStatsService;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductReviewsTest {

    private static final String IP = "4.4.4.4";

    @Mock private ProductRepository productRepository;
    @Mock private ProductEventPublisher eventPublisher;
    @Mock private DemoStatsService statsService;
    @Mock private ProductReviewRepository reviewRepository;
    @Mock private ContentModerationService moderation;
    @Mock private PurchaseRepository purchaseRepository;

    private ProductController controller;
    private final MockServerHttpRequest request = MockServerHttpRequest.post("/api/products/1/reviews")
            .header("X-Forwarded-For", IP).build();

    @BeforeEach
    void setUp() {
        controller = new ProductController(productRepository, eventPublisher, statsService, reviewRepository, moderation, purchaseRepository);
    }

    private static Mono<Product> producto() {
        return Mono.just(Product.builder().id(1L).name("Taza").build());
    }

    private static boolean conEstado(Throwable e, HttpStatus estado) {
        return e instanceof ResponseStatusException rse && rse.getStatusCode() == estado;
    }

    @Test
    void publicaLaResenaGuardandoLaIpYSinMarcarlaComoEjemplo() {
        when(moderation.isBlocked(IP)).thenReturn(false);
        when(moderation.findBlockedWord(anyString(), anyString())).thenReturn(Optional.empty());
        when(productRepository.findById(1L)).thenReturn(producto());
        when(reviewRepository.countByCreatedByIpAndCreatedAtAfter(eq(IP), any(LocalDateTime.class))).thenReturn(Mono.just(0L));
        when(reviewRepository.save(any(ProductReview.class))).thenAnswer(inv -> Mono.just(inv.getArgument(0)));

        StepVerifier.create(controller.addReview(1L, new ReviewRequest("  Ana ", 5, " Muy buena "), request))
                .expectNextCount(1)
                .verifyComplete();

        ArgumentCaptor<ProductReview> guardada = ArgumentCaptor.forClass(ProductReview.class);
        verify(reviewRepository).save(guardada.capture());
        assertThat(guardada.getValue().getAuthor()).isEqualTo("Ana");
        assertThat(guardada.getValue().getComment()).isEqualTo("Muy buena");
        assertThat(guardada.getValue().getCreatedByIp()).isEqualTo(IP);
        assertThat(guardada.getValue().isSeed()).isFalse();
    }

    @Test
    void rechazaLenguajeOfensivoYSumaUnAviso() {
        when(moderation.isBlocked(IP)).thenReturn(false);
        when(moderation.findBlockedWord(anyString(), anyString())).thenReturn(Optional.of("mierda"));
        when(moderation.recordViolation(IP)).thenReturn(1);

        StepVerifier.create(controller.addReview(1L, new ReviewRequest("Ana", 1, "una mierda"), request))
                .expectErrorMatches(e -> conEstado(e, HttpStatus.BAD_REQUEST))
                .verify();

        verify(reviewRepository, never()).save(any());
    }

    @Test
    void unaIpBloqueadaNoPuedePublicar() {
        when(moderation.isBlocked(IP)).thenReturn(true);

        StepVerifier.create(controller.addReview(1L, new ReviewRequest("Ana", 5, "Hola"), request))
                .expectErrorMatches(e -> conEstado(e, HttpStatus.FORBIDDEN))
                .verify();

        verifyNoInteractions(reviewRepository);
    }

    @Test
    void respetaElLimiteDeResenasPorIpAlDia() {
        when(moderation.isBlocked(IP)).thenReturn(false);
        when(moderation.findBlockedWord(anyString(), anyString())).thenReturn(Optional.empty());
        when(productRepository.findById(1L)).thenReturn(producto());
        when(reviewRepository.countByCreatedByIpAndCreatedAtAfter(eq(IP), any(LocalDateTime.class)))
                .thenReturn(Mono.just((long) ProductController.MAX_RESENAS_POR_IP_AL_DIA));

        StepVerifier.create(controller.addReview(1L, new ReviewRequest("Ana", 5, "Otra más"), request))
                .expectErrorMatches(e -> conEstado(e, HttpStatus.TOO_MANY_REQUESTS))
                .verify();

        verify(reviewRepository, never()).save(any());
    }

    @Test
    void unProductoInexistenteDevuelve404() {
        when(moderation.isBlocked(IP)).thenReturn(false);
        when(moderation.findBlockedWord(anyString(), anyString())).thenReturn(Optional.empty());
        when(productRepository.findById(99L)).thenReturn(Mono.empty());

        StepVerifier.create(controller.addReview(99L, new ReviewRequest("Ana", 5, "Hola"), request))
                .expectErrorMatches(e -> conEstado(e, HttpStatus.NOT_FOUND))
                .verify();
    }
}
