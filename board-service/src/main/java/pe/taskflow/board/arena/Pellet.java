package pe.taskflow.board.arena;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * Comida del mapa. `tipo`: normal, grande, masa (expulsada por un jugador) o un
 * power-up (velocidad, escudo, iman). La masa recién expulsada no la puede
 * recoger su dueño durante unos ticks, para que no se la vuelva a comer al instante.
 */
public record Pellet(String id, double x, double y, String tipo,
                     @JsonIgnore String duenoId, @JsonIgnore long naceEnTick) {

    public static final String NORMAL = "normal";
    public static final String GRANDE = "grande";
    public static final String MASA = "masa";
    public static final String VELOCIDAD = "velocidad";
    public static final String ESCUDO = "escudo";
    public static final String IMAN = "iman";

    public Pellet(String id, double x, double y, String tipo) {
        this(id, x, y, tipo, null, 0);
    }

    public boolean esPowerUp() {
        return VELOCIDAD.equals(tipo) || ESCUDO.equals(tipo) || IMAN.equals(tipo);
    }

    /** Radio con el que se dibuja y se recoge. */
    public double radio() {
        return switch (tipo) {
            case GRANDE -> ArenaState.BIG_PELLET_RADIUS;
            case MASA -> ArenaState.MASA_RADIUS;
            case NORMAL -> ArenaState.PELLET_RADIUS;
            default -> ArenaState.POWERUP_RADIUS;
        };
    }

    /** Área que suma al comerla (r² equivalente). La masa devuelve exactamente lo que se expulsó. */
    public double areaQueAporta() {
        return switch (tipo) {
            case MASA -> ArenaState.MASA_RADIUS * ArenaState.MASA_RADIUS;
            case GRANDE -> ArenaState.BIG_PELLET_RADIUS * ArenaState.BIG_PELLET_RADIUS * 4;
            case NORMAL -> ArenaState.PELLET_RADIUS * ArenaState.PELLET_RADIUS * 4;
            default -> 0;
        };
    }
}
