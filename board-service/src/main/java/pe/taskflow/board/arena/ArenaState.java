package pe.taskflow.board.arena;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Estado del arena en memoria (no se persiste): jugadores, bots y pellets.
 * Limitado a pocos participantes a la vez para no exigir mucho al plan free.
 */
@Component
public class ArenaState {

    public static final double WORLD_SIZE = 2000;
    public static final int MAX_PELLETS = 150;
    public static final int BOT_COUNT = 6;
    public static final int MAX_PLAYERS = 20;
    public static final double START_RADIUS = 20;
    public static final double PELLET_RADIUS = 4;

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
        Blob blob = randomBlob(UUID.randomUUID().toString(), false, name);
        players.put(blob.getId(), blob);
        return blob;
    }

    public void removePlayer(String id) {
        players.remove(id);
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

    public void ensurePelletPopulation() {
        while (pellets.size() < MAX_PELLETS) {
            String id = UUID.randomUUID().toString();
            pellets.put(id, new Pellet(id, randomCoordinate(), randomCoordinate()));
        }
    }

    public ArenaSnapshot snapshot() {
        List<BlobView> blobs = java.util.stream.Stream
                .concat(players.values().stream(), bots.values().stream())
                .map(BlobView::from)
                .toList();
        return new ArenaSnapshot(blobs, List.copyOf(pellets.values()), WORLD_SIZE);
    }

    private Blob randomBlob(String id, boolean bot, String name) {
        String color = bot
                ? BOT_COLORS.get(ThreadLocalRandom.current().nextInt(BOT_COLORS.size()))
                : PLAYER_COLORS.get(ThreadLocalRandom.current().nextInt(PLAYER_COLORS.size()));
        return new Blob(id, bot, name, color, randomCoordinate(), randomCoordinate(), START_RADIUS);
    }

    private double randomCoordinate() {
        return ThreadLocalRandom.current().nextDouble(0, WORLD_SIZE);
    }
}
