package pe.taskflow.board.arena;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.test.StepVerifier;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prueba las reglas del juego (crecer, comer, tope de tamaño) llamando a
 * tick() directamente sobre un ArenaState fresco y controlado, sin arrancar
 * el loop real de Flux.interval ni depender del contexto de Spring.
 */
class ArenaEngineTest {

    private ArenaState state;
    private ArenaEngine engine;

    @BeforeEach
    void setUp() {
        state = new ArenaState();
        engine = new ArenaEngine(state);
    }

    @Test
    void unBlobMasGrandeSeComeAlMasPequenoYCrece() {
        Blob grande = state.addPlayer("Grande");
        placeStill(grande, 100, 100, 100);

        Blob chico = state.addPlayer("Chico");
        placeStill(chico, 100, 100, 50);

        StepVerifier.create(engine.deaths())
                .then(engine::tick)
                .expectNext(chico.getId())
                .thenCancel()
                .verify(Duration.ofSeconds(1));

        assertThat(state.players()).doesNotContainKey(chico.getId());
        assertThat(state.players()).containsKey(grande.getId());
        // sqrt(100^2 + 50^2 * 0.9) ~= 110.68
        assertThat(state.players().get(grande.getId()).getRadius()).isCloseTo(110.68, within(0.5));
    }

    @Test
    void unBlobDemasiadoParecidoEnTamanoNoSeComeANadie() {
        Blob a = state.addPlayer("A");
        placeStill(a, 200, 200, 100);
        Blob b = state.addPlayer("B");
        // 100 < 90 * 1.15 (103.5): no alcanza la proporción para comer.
        placeStill(b, 200, 200, 90);

        engine.tick();

        assertThat(state.players()).containsKeys(a.getId(), b.getId());
    }

    @Test
    void unBotComidoRespawneaEnVezDeDesaparecer() {
        Blob player = state.addPlayer("Cazador");
        placeStill(player, 500, 500, 200);

        Blob bot = new Blob("bot-1", true, "NullPointer", "#8993a4", 500, 500, 50);
        bot.setTargetX(500);
        bot.setTargetY(500);
        state.bots().put(bot.getId(), bot);

        engine.tick();

        assertThat(state.bots()).containsKey("bot-1");
        assertThat(state.bots().get("bot-1").getRadius()).isEqualTo(ArenaState.START_RADIUS);
    }

    @Test
    void alComerUnPelletEnElTopeDeTamanoTerminaLaPartidaConVictoria() {
        Blob player = state.addPlayer("Campeon");
        placeStill(player, 1000, 1000, ArenaState.MAX_RADIUS);

        state.pellets().put("p1", new Pellet("p1", 1000, 1000, false));

        StepVerifier.create(engine.victories())
                .then(engine::tick)
                .expectNext(player.getId())
                .thenCancel()
                .verify(Duration.ofSeconds(1));

        assertThat(state.players()).doesNotContainKey(player.getId());
    }

    @Test
    void unBotQueLlegaAlTopeSeRetiraYReapareceEnVezDeGanar() {
        Blob bot = new Blob("bot-2", true, "SyntaxError", "#8993a4", 1500, 1500, ArenaState.MAX_RADIUS);
        bot.setTargetX(1500);
        bot.setTargetY(1500);
        state.bots().put(bot.getId(), bot);
        state.pellets().put("p2", new Pellet("p2", 1500, 1500, false));

        engine.tick();

        assertThat(state.bots()).containsKey("bot-2");
        assertThat(state.bots().get("bot-2").getRadius()).isEqualTo(ArenaState.START_RADIUS);
    }

    private void placeStill(Blob blob, double x, double y, double radius) {
        blob.setX(x);
        blob.setY(y);
        blob.setRadius(radius);
        blob.setTargetX(x);
        blob.setTargetY(y);
    }

    private static org.assertj.core.data.Offset<Double> within(double value) {
        return org.assertj.core.data.Offset.offset(value);
    }
}
