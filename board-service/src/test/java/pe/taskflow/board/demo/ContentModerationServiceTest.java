package pe.taskflow.board.demo;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContentModerationServiceTest {

    private ContentModerationService moderation;

    @BeforeEach
    void setUp() {
        moderation = new ContentModerationService();
    }

    @Test
    void detectaPalabraBloqueadaEnTextoLimpio() {
        assertThat(moderation.findBlockedWord("Vamos puta madre", null)).contains("puta");
    }

    @Test
    void noDetectaNadaEnTextoLimpio() {
        assertThat(moderation.findBlockedWord("Terminar el informe de ventas", "para mañana")).isEmpty();
    }

    @Test
    void respetaLimiteDePalabraYNoBloqueaSubcadenas() {
        // "puta" es sustring de "reputación", pero con \b no debe matchear.
        assertThat(moderation.findBlockedWord("Cuidar la reputación del equipo", null)).isEmpty();
    }

    @Test
    void ignoraAcentosYMayusculas() {
        assertThat(moderation.findBlockedWord("Eres un CABRÓN", null)).contains("cabron");
        assertThat(moderation.findBlockedWord("no seas cabron", null)).contains("cabron");
    }

    @Test
    void combinaTituloYDescripcionEnLaBusqueda() {
        assertThat(moderation.findBlockedWord("Título normal", "pero con mierda en la descripción"))
                .contains("mierda");
    }

    @Test
    void unaIpLimpiaNuncaQuedaBloqueada() {
        assertThat(moderation.isBlocked("1.2.3.4")).isFalse();
    }

    @Test
    void bloqueaLaIpSoloAlLlegarAlMaximoDeViolaciones() {
        String ip = "9.9.9.9";

        assertThat(moderation.recordViolation(ip)).isEqualTo(1);
        assertThat(moderation.isBlocked(ip)).isFalse();

        assertThat(moderation.recordViolation(ip)).isEqualTo(2);
        assertThat(moderation.isBlocked(ip)).isFalse();

        assertThat(moderation.recordViolation(ip)).isEqualTo(ContentModerationService.MAX_VIOLATIONS);
        assertThat(moderation.isBlocked(ip)).isTrue();
    }

    @Test
    void resetViolationsDesbloqueaATodosLosVisitantes() {
        String ip = "8.8.8.8";
        for (int i = 0; i < ContentModerationService.MAX_VIOLATIONS; i++) {
            moderation.recordViolation(ip);
        }
        assertThat(moderation.isBlocked(ip)).isTrue();

        moderation.resetViolations();

        assertThat(moderation.isBlocked(ip)).isFalse();
    }
}
