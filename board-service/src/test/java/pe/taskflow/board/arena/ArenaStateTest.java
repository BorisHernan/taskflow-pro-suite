package pe.taskflow.board.arena;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ArenaStateTest {

    // Antes el jugador aparecía en un punto al azar: con bots de ~380 de radio
    // nacía dentro de uno y moría al instante, sin llegar a jugar.
    @Test
    void elJugadorNuevoNoApareceAlAlcanceDeUnBotGrande() {
        for (int i = 0; i < 200; i++) {
            ArenaState state = new ArenaState();
            Blob gigante = new Blob("bot-1", true, "HotFixHero", "#8993a4", 1000, 1000, 600);
            state.bots().put(gigante.getId(), gigante);

            Blob jugador = state.addPlayer("Nuevo");

            double distancia = Math.hypot(jugador.getX() - gigante.getX(), jugador.getY() - gigante.getY());
            assertThat(distancia - gigante.getRadius())
                    .as("separación del borde del bot en el intento %d", i)
                    .isGreaterThanOrEqualTo(ArenaState.MARGEN_APARICION);
        }
    }

    @Test
    void conElMapaVacioApareceDentroDelMundo() {
        ArenaState state = new ArenaState();
        Blob jugador = state.addPlayer("Solo");

        assertThat(jugador.getX()).isBetween(0.0, ArenaState.WORLD_SIZE);
        assertThat(jugador.getY()).isBetween(0.0, ArenaState.WORLD_SIZE);
        assertThat(jugador.getRadius()).isEqualTo(ArenaState.START_RADIUS);
    }

    @Test
    void losBotsUsanSkinsExclusivasYLosJugadoresNo() {
        ArenaState state = new ArenaState();
        state.ensureBotPopulation();

        assertThat(state.bots().values()).allSatisfy(b -> assertThat(ArenaState.BOT_SKINS).contains(b.getSkin()));
        assertThat(state.addPlayer("Intruso", "robot").getSkin()).isEqualTo("clasico");
    }

    @Test
    void elJugadorNuevoNaceConUnosSegundosDeEscudo() {
        assertThat(new ArenaState().addPlayer("Nuevo").getEscudoTicks()).isEqualTo(ArenaState.TICKS_PROTECCION_INICIAL);
    }
}
