package pe.taskflow.board.arena;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Motor del juego: un tick cada 100ms (10/seg, no 60, para no exigir mucho al
 * plan free) que mueve bots y jugadores, resuelve colisiones (quién se come a
 * quién) y transmite el estado a todos los conectados por WebSocket.
 */
@Component
public class ArenaEngine {

    private static final Duration TICK_INTERVAL = Duration.ofMillis(100);
    private static final double TICK_SECONDS = TICK_INTERVAL.toMillis() / 1000.0;
    private static final double BASE_SPEED = 220; // unidades/seg para un blob recién nacido
    private static final double MIN_SPEED = 70;
    private static final double SPEED_DECAY = 1.4;
    private static final double EAT_SIZE_RATIO = 1.15; // hay que ser 15% más grande para comer
    private static final double GROWTH_FACTOR = 0.9; // conservación de masa con una pequeña pérdida
    private static final double DANGER_RADIUS = 300;
    private static final double HUNT_RADIUS = 250;
    private static final double WANDER_REFRESH_SECONDS = 2.5;

    private final ArenaState state;
    // replay().limit(1): a un cliente nuevo solo le importa el último estado del
    // juego, no un historial de ticks pasados (a diferencia de los eventos del
    // tablero, aquí el pasado no tiene valor una vez que hay un tick más nuevo).
    private final Sinks.Many<ArenaSnapshot> snapshots = Sinks.many().replay().limit(1);
    private final Sinks.Many<String> deaths = Sinks.many().multicast().onBackpressureBuffer();
    private final Map<String, Double> wanderTimers = new java.util.concurrent.ConcurrentHashMap<>();

    private Disposable loop;

    public ArenaEngine(ArenaState state) {
        this.state = state;
    }

    private static final Logger log = LoggerFactory.getLogger(ArenaEngine.class);

    @PostConstruct
    void start() {
        state.ensureBotPopulation();
        state.ensurePelletPopulation();
        log.info("Arena engine iniciado: {} bots, {} pellets", state.bots().size(), state.pellets().size());
        loop = Flux.interval(TICK_INTERVAL).subscribe(
                tick -> {
                    try {
                        tick();
                    } catch (Exception e) {
                        log.error("Error en tick del arena", e);
                    }
                },
                err -> log.error("Error fatal en el loop del arena", err)
        );
    }

    public Flux<ArenaSnapshot> snapshots() {
        return snapshots.asFlux();
    }

    public Flux<String> deaths() {
        return deaths.asFlux();
    }

    private void tick() {
        List<Blob> allBlobs = new ArrayList<>(state.players().values());
        allBlobs.addAll(state.bots().values());

        for (Blob bot : state.bots().values()) {
            decideBotMovement(bot, allBlobs);
        }

        for (Blob blob : allBlobs) {
            moveTowardTarget(blob);
        }

        resolvePelletCollisions(allBlobs);
        resolveBlobCollisions(allBlobs);

        state.ensureBotPopulation();
        state.ensurePelletPopulation();

        Sinks.EmitResult result = snapshots.tryEmitNext(state.snapshot());
        if (result.isFailure()) {
            log.warn("Emision de snapshot fallida: {}", result);
        }
    }

    private void moveTowardTarget(Blob blob) {
        double dx = blob.getTargetX() - blob.getX();
        double dy = blob.getTargetY() - blob.getY();
        double distance = Math.hypot(dx, dy);
        if (distance < 1) {
            return;
        }

        double speed = Math.max(MIN_SPEED, BASE_SPEED - (blob.getRadius() - ArenaState.START_RADIUS) * SPEED_DECAY);
        double step = Math.min(distance, speed * TICK_SECONDS);

        blob.setX(clamp(blob.getX() + (dx / distance) * step));
        blob.setY(clamp(blob.getY() + (dy / distance) * step));
    }

    private double clamp(double value) {
        return Math.max(0, Math.min(ArenaState.WORLD_SIZE, value));
    }

    private void decideBotMovement(Blob bot, List<Blob> allBlobs) {
        Blob threat = null;
        double closestThreatDist = Double.MAX_VALUE;
        Blob prey = null;
        double closestPreyDist = Double.MAX_VALUE;

        for (Blob other : allBlobs) {
            if (other == bot) {
                continue;
            }
            double dist = Math.hypot(other.getX() - bot.getX(), other.getY() - bot.getY());

            if (other.getRadius() > bot.getRadius() * EAT_SIZE_RATIO && dist < DANGER_RADIUS && dist < closestThreatDist) {
                threat = other;
                closestThreatDist = dist;
            }
            if (bot.getRadius() > other.getRadius() * EAT_SIZE_RATIO && dist < HUNT_RADIUS && dist < closestPreyDist) {
                prey = other;
                closestPreyDist = dist;
            }
        }

        if (threat != null) {
            bot.setTargetX(clamp(bot.getX() - (threat.getX() - bot.getX())));
            bot.setTargetY(clamp(bot.getY() - (threat.getY() - bot.getY())));
            return;
        }

        if (prey != null) {
            bot.setTargetX(prey.getX());
            bot.setTargetY(prey.getY());
            return;
        }

        Pellet nearestPellet = null;
        double closestPelletDist = Double.MAX_VALUE;
        for (Pellet pellet : state.pellets().values()) {
            double dist = Math.hypot(pellet.x() - bot.getX(), pellet.y() - bot.getY());
            if (dist < closestPelletDist) {
                nearestPellet = pellet;
                closestPelletDist = dist;
            }
        }
        if (nearestPellet != null) {
            bot.setTargetX(nearestPellet.x());
            bot.setTargetY(nearestPellet.y());
            return;
        }

        wander(bot);
    }

    private void wander(Blob bot) {
        double timer = wanderTimers.getOrDefault(bot.getId(), 0.0) - TICK_SECONDS;
        if (timer <= 0) {
            bot.setTargetX(ThreadLocalRandom.current().nextDouble(0, ArenaState.WORLD_SIZE));
            bot.setTargetY(ThreadLocalRandom.current().nextDouble(0, ArenaState.WORLD_SIZE));
            timer = WANDER_REFRESH_SECONDS;
        }
        wanderTimers.put(bot.getId(), timer);
    }

    private void resolvePelletCollisions(List<Blob> allBlobs) {
        for (Blob blob : allBlobs) {
            for (Pellet pellet : List.copyOf(state.pellets().values())) {
                double dist = Math.hypot(pellet.x() - blob.getX(), pellet.y() - blob.getY());
                if (dist < blob.getRadius()) {
                    state.pellets().remove(pellet.id());
                    double pelletRadius = pellet.big() ? ArenaState.BIG_PELLET_RADIUS : ArenaState.PELLET_RADIUS;
                    blob.setRadius(Math.sqrt(blob.getRadius() * blob.getRadius() + pelletRadius * pelletRadius * 4));
                }
            }
        }
    }

    private void resolveBlobCollisions(List<Blob> allBlobs) {
        for (int i = 0; i < allBlobs.size(); i++) {
            Blob a = allBlobs.get(i);
            for (int j = i + 1; j < allBlobs.size(); j++) {
                Blob b = allBlobs.get(j);
                if (isRemoved(a) || isRemoved(b)) {
                    continue;
                }

                double dist = Math.hypot(a.getX() - b.getX(), a.getY() - b.getY());
                Blob bigger = a.getRadius() >= b.getRadius() ? a : b;
                Blob smaller = bigger == a ? b : a;

                if (dist < bigger.getRadius() && bigger.getRadius() > smaller.getRadius() * EAT_SIZE_RATIO) {
                    bigger.setRadius(Math.sqrt(bigger.getRadius() * bigger.getRadius()
                            + smaller.getRadius() * smaller.getRadius() * GROWTH_FACTOR));
                    eat(smaller);
                }
            }
        }
    }

    private boolean isRemoved(Blob blob) {
        if (blob.isBot()) {
            return !state.bots().containsKey(blob.getId());
        }
        return !state.players().containsKey(blob.getId());
    }

    private void eat(Blob smaller) {
        if (smaller.isBot()) {
            state.respawnBot(smaller.getId());
        } else {
            state.removePlayer(smaller.getId());
            deaths.tryEmitNext(smaller.getId());
        }
    }
}
