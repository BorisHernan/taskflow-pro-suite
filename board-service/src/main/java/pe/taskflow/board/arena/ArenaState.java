package pe.taskflow.board.arena;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Estado del arena en memoria (no se persiste): células de jugadores, bots y
 * pellets. `players` guarda células: un jugador dividido tiene varias con el
 * mismo ownerId (la primera usa el id del jugador).
 */
@Component
public class ArenaState {

    public static final double WORLD_SIZE = 4000;
    public static final int MAX_PELLETS = 350;
    public static final int BOT_COUNT = 6;
    public static final int MAX_PLAYERS = 20;
    public static final double START_RADIUS = 20;
    public static final double PELLET_RADIUS = 4;
    public static final double BIG_PELLET_RADIUS = 10;
    public static final double BIG_PELLET_CHANCE = 0.08;
    public static final double MASA_RADIUS = 12;
    public static final double POWERUP_RADIUS = 14;
    public static final int POWERUP_COUNT = 10;
    public static final int MAX_MASA = 150;
    public static final List<String> SKINS = List.of("clasico", "sandia", "planeta", "galaxia", "dona", "ojo", "bug");
    private static final List<String> POWERUPS = List.of(Pellet.VELOCIDAD, Pellet.ESCUDO, Pellet.IMAN);
    // Al llegar acá se acaba la partida: para un jugador es una victoria, para
    // un bot simplemente se "retira" y aparece uno nuevo — evita que farmear
    // sin límite vuelva aburrido el resto del arena para todos.
    public static final double MAX_RADIUS = 2000;
    // Distancia mínima al borde de cualquier otro círculo al aparecer.
    public static final double MARGEN_APARICION = 150;
    private static final int INTENTOS_APARICION = 60;

    private static final List<String> PLAYER_COLORS = List.of(
            "#ff5630", "#36b37e", "#0052cc", "#ffab00", "#6554c0", "#00b8d9", "#de350b", "#00875a"
    );
    private static final List<String> BOT_COLORS = List.of(
            "#8993a4", "#97a0af", "#7a869a", "#a5adba", "#6b778c"
    );

    private final Map<String, Blob> players = new ConcurrentHashMap<>();
    private final Map<String, Blob> bots = new ConcurrentHashMap<>();
    private final Map<String, Pellet> pellets = new ConcurrentHashMap<>();

    public boolean isFull() {
        return players.size() >= MAX_PLAYERS;
    }

    public Blob addPlayer(String name) {
        return addPlayer(name, "clasico");
    }

    public Blob addPlayer(String name, String skin) {
        Blob blob = randomBlob(UUID.randomUUID().toString(), false, name);
        blob.setSkin(SKINS.contains(skin) ? skin : "clasico");
        ubicarLejosDeOtros(blob);
        players.put(blob.getId(), blob);
        return blob;
    }

    /** Células de un jugador (más de una si se dividió). */
    public List<Blob> cellsOf(String ownerId) {
        return players.values().stream().filter(b -> b.getOwnerId().equals(ownerId)).toList();
    }

    public void addCell(Blob cell) {
        players.put(cell.getId(), cell);
    }

    public void removeCell(String cellId) {
        players.remove(cellId);
    }

    /**
     * Prueba posiciones al azar y se queda con la primera que deja al menos
     * MARGEN_APARICION hasta el borde de cualquier otro círculo; si ninguna
     * alcanza, con la más despejada. Así no se nace dentro de un bot gigante.
     */
    private void ubicarLejosDeOtros(Blob nuevo) {
        double mejorX = nuevo.getX();
        double mejorY = nuevo.getY();
        double mejorHolgura = holgura(mejorX, mejorY);

        for (int i = 0; i < INTENTOS_APARICION && mejorHolgura < MARGEN_APARICION; i++) {
            double x = randomCoordinate();
            double y = randomCoordinate();
            double h = holgura(x, y);
            if (h > mejorHolgura) {
                mejorX = x;
                mejorY = y;
                mejorHolgura = h;
            }
        }
        nuevo.setX(mejorX);
        nuevo.setY(mejorY);
        nuevo.setTargetX(mejorX);
        nuevo.setTargetY(mejorY);
    }

    /** Distancia desde (x, y) hasta el borde del círculo más cercano; infinita si no hay ninguno. */
    private double holgura(double x, double y) {
        return java.util.stream.Stream.concat(players.values().stream(), bots.values().stream())
                .mapToDouble(b -> Math.hypot(b.getX() - x, b.getY() - y) - b.getRadius())
                .min()
                .orElse(Double.MAX_VALUE);
    }

    /** Saca al jugador entero: todas sus células. */
    public void removePlayer(String ownerId) {
        players.values().removeIf(b -> b.getOwnerId().equals(ownerId));
    }

    public Blob getPlayer(String id) {
        return players.get(id);
    }

    public Map<String, Blob> players() {
        return players;
    }

    public Map<String, Blob> bots() {
        return bots;
    }

    public Map<String, Pellet> pellets() {
        return pellets;
    }

    public void ensureBotPopulation() {
        while (bots.size() < BOT_COUNT) {
            Blob bot = randomBlob(UUID.randomUUID().toString(), true, BotNames.random());
            bots.put(bot.getId(), bot);
        }
    }

    public void respawnBot(String id) {
        bots.put(id, randomBlob(id, true, BotNames.random()));
    }

    /** Repone la comida común y los power-ups por separado (la masa expulsada no cuenta). */
    public void ensurePelletPopulation() {
        long comunes = pellets.values().stream().filter(p -> !p.esPowerUp() && !Pellet.MASA.equals(p.tipo())).count();
        for (long i = comunes; i < MAX_PELLETS; i++) {
            String tipo = ThreadLocalRandom.current().nextDouble() < BIG_PELLET_CHANCE ? Pellet.GRANDE : Pellet.NORMAL;
            addPellet(tipo, randomCoordinate(), randomCoordinate());
        }
        long powerUps = pellets.values().stream().filter(Pellet::esPowerUp).count();
        for (long i = powerUps; i < POWERUP_COUNT; i++) {
            addPellet(POWERUPS.get(ThreadLocalRandom.current().nextInt(POWERUPS.size())), randomCoordinate(), randomCoordinate());
        }
    }

    private void addPellet(String tipo, double x, double y) {
        String id = UUID.randomUUID().toString();
        pellets.put(id, new Pellet(id, x, y, tipo));
    }

    public long masaEnElMapa() {
        return pellets.values().stream().filter(p -> Pellet.MASA.equals(p.tipo())).count();
    }

    public ArenaSnapshot snapshot(List<ArenaEvent> eventos) {
        List<BlobView> blobs = java.util.stream.Stream
                .concat(players.values().stream(), bots.values().stream())
                .map(BlobView::from)
                .toList();
        return new ArenaSnapshot(blobs, List.copyOf(pellets.values()), WORLD_SIZE, List.copyOf(eventos));
    }

    private Blob randomBlob(String id, boolean bot, String name) {
        String color = bot
                ? BOT_COLORS.get(ThreadLocalRandom.current().nextInt(BOT_COLORS.size()))
                : PLAYER_COLORS.get(ThreadLocalRandom.current().nextInt(PLAYER_COLORS.size()));
        return new Blob(id, bot, name, color, randomCoordinate(), randomCoordinate(), START_RADIUS);
    }

    double randomCoordinate() {
        return ThreadLocalRandom.current().nextDouble(0, WORLD_SIZE);
    }
}
