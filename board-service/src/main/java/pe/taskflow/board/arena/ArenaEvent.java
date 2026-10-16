package pe.taskflow.board.arena;

/** Algo que pasó en un tick y que el cliente muestra (aviso y partículas). */
public record ArenaEvent(String tipo, String quien, String aQuien, double x, double y, String color) {

    public static final String COMIO = "comio";
    public static final String POWERUP = "powerup";
}
