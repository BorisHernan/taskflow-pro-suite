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
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Motor del juego: un tick cada 100ms (10/seg, no 60, para no exigir mucho al
 * plan free) que mueve bots y jugadores, resuelve colisiones (quién se come a
 * quién), aplica power-ups y transmite el estado a todos por WebSocket.
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

    static final int MAX_CELULAS = 8;
    static final double RADIO_MIN_DIVIDIR = 36;
    static final double RADIO_MIN_EXPULSAR = 32;
    static final int TICKS_FUSION = 100; // 10 s separados antes de poder volver a juntarse
    static final int TICKS_POWERUP = 80; // 8 s de efecto
    static final int TICKS_MASA_PROPIA = 8; // tu masa expulsada no la recoges durante 0,8 s
    static final double IMPULSO_DIVISION = 900;
    static final double FRENO_IMPULSO = 0.82;
    static final double MULTIPLICADOR_VELOCIDAD = 1.6;
    static final double ALCANCE_IMAN = 140;

    public static final String DIVIDIR = "dividir";
    public static final String EXPULSAR = "expulsar";

    private final ArenaState state;
    // replay().limit(1): a un cliente nuevo solo le importa el último estado del juego.
    private final Sinks.Many<ArenaSnapshot> snapshots = Sinks.many().replay().limit(1);
    // directBestEffort: sobrevive a que se vayan todos los suscriptores y no acumula eventos viejos.
    private final Sinks.Many<String> deaths = Sinks.many().multicast().directBestEffort();
    private final Sinks.Many<String> victories = Sinks.many().multicast().directBestEffort();
    private final Map<String, Double> wanderTimers = new ConcurrentHashMap<>();
    // Las acciones llegan por WebSocket en otro hilo; se aplican al inicio del tick.
    private final Queue<String[]> acciones = new ConcurrentLinkedQueue<>();
    private final List<ArenaEvent> eventosDelTick = new ArrayList<>();
    private long tickActual;

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

    public Flux<String> victories() {
        return victories.asFlux();
    }

    /** Dividir o expulsar masa: se encola y se aplica en el próximo tick. */
    public void encolar(String ownerId, String accion) {
        if (DIVIDIR.equals(accion) || EXPULSAR.equals(accion)) {
            acciones.add(new String[]{ownerId, accion});
        }
    }

    /** Apunta todas las células del jugador al mismo lugar. */
    public void apuntar(String ownerId, double x, double y) {
        for (Blob cell : state.cellsOf(ownerId)) {
            cell.setTargetX(clamp(x));
            cell.setTargetY(clamp(y));
        }
    }

    // Visibilidad de paquete: los tests llaman a un tick puntual sin el loop real.
    void tick() {
        tickActual++;
        eventosDelTick.clear();
        aplicarAcciones();

        List<Blob> allBlobs = new ArrayList<>(state.players().values());
        allBlobs.addAll(state.bots().values());
        allBlobs.forEach(Blob::avanzarTick);

        for (Blob bot : state.bots().values()) {
            decideBotMovement(bot, allBlobs);
        }
        for (Blob blob : allBlobs) {
            moveTowardTarget(blob);
        }
        separarCelulasPropias();

        resolvePelletCollisions(allBlobs);
        resolveBlobCollisions(allBlobs);

        state.ensureBotPopulation();
        state.ensurePelletPopulation();

        Sinks.EmitResult result = snapshots.tryEmitNext(state.snapshot(eventosDelTick));
        if (result.isFailure()) {
            log.warn("Emision de snapshot fallida: {}", result);
        }
    }

    private void aplicarAcciones() {
        String[] accion;
        while ((accion = acciones.poll()) != null) {
            if (DIVIDIR.equals(accion[1])) {
                dividir(accion[0]);
            } else {
                expulsar(accion[0]);
            }
        }
    }

    /** Cada célula grande se parte en dos de igual área; la nueva sale disparada hacia el mouse. */
    void dividir(String ownerId) {
        List<Blob> celulas = new ArrayList<>(state.cellsOf(ownerId));
        int total = celulas.size();
        for (Blob cell : celulas) {
            if (total >= MAX_CELULAS || cell.getRadius() < RADIO_MIN_DIVIDIR) {
                continue;
            }
            double nuevoRadio = cell.getRadius() / Math.sqrt(2);
            double[] dir = direccion(cell);
            cell.setRadius(nuevoRadio);
            cell.setFusionTicks(TICKS_FUSION);

            Blob hija = new Blob(UUID.randomUUID().toString(), false, cell.getName(), cell.getColor(),
                    cell.getX(), cell.getY(), nuevoRadio);
            hija.setOwnerId(ownerId);
            hija.setSkin(cell.getSkin());
            hija.setTargetX(cell.getTargetX());
            hija.setTargetY(cell.getTargetY());
            hija.setVx(dir[0] * IMPULSO_DIVISION);
            hija.setVy(dir[1] * IMPULSO_DIVISION);
            hija.setFusionTicks(TICKS_FUSION);
            hija.setVelocidadTicks(cell.getVelocidadTicks());
            hija.setEscudoTicks(cell.getEscudoTicks());
            hija.setImanTicks(cell.getImanTicks());
            state.addCell(hija);
            total++;
        }
    }

    /** Suelta una bolita de masa hacia donde apunta cada célula (sirve para alimentar o para huir más liviano). */
    void expulsar(String ownerId) {
        for (Blob cell : state.cellsOf(ownerId)) {
            if (cell.getRadius() < RADIO_MIN_EXPULSAR || state.masaEnElMapa() >= ArenaState.MAX_MASA) {
                continue;
            }
            double[] dir = direccion(cell);
            double distancia = cell.getRadius() + ArenaState.MASA_RADIUS + 30;
            cell.setRadius(Math.sqrt(cell.getRadius() * cell.getRadius() - ArenaState.MASA_RADIUS * ArenaState.MASA_RADIUS));
            String id = UUID.randomUUID().toString();
            state.pellets().put(id, new Pellet(id, clamp(cell.getX() + dir[0] * distancia), clamp(cell.getY() + dir[1] * distancia),
                    Pellet.MASA, ownerId, tickActual));
        }
    }

    /** Vector unitario hacia el objetivo (o hacia la derecha si ya está encima). */
    private double[] direccion(Blob cell) {
        double dx = cell.getTargetX() - cell.getX();
        double dy = cell.getTargetY() - cell.getY();
        double d = Math.hypot(dx, dy);
        return d < 1 ? new double[]{1, 0} : new double[]{dx / d, dy / d};
    }

    private void moveTowardTarget(Blob blob) {
        double dx = blob.getTargetX() - blob.getX();
        double dy = blob.getTargetY() - blob.getY();
        double distance = Math.hypot(dx, dy);

        double nx = blob.getX();
        double ny = blob.getY();
        if (distance >= 1) {
            double speed = Math.max(MIN_SPEED, BASE_SPEED - (blob.getRadius() - ArenaState.START_RADIUS) * SPEED_DECAY);
            if (blob.getVelocidadTicks() > 0) {
                speed *= MULTIPLICADOR_VELOCIDAD;
            }
            double step = Math.min(distance, speed * TICK_SECONDS);
            nx += (dx / distance) * step;
            ny += (dy / distance) * step;
        }

        nx += blob.getVx() * TICK_SECONDS;
        ny += blob.getVy() * TICK_SECONDS;
        blob.setVx(Math.abs(blob.getVx()) < 5 ? 0 : blob.getVx() * FRENO_IMPULSO);
        blob.setVy(Math.abs(blob.getVy()) < 5 ? 0 : blob.getVy() * FRENO_IMPULSO);

        blob.setX(clamp(nx));
        blob.setY(clamp(ny));
    }

    /** Mientras no puedan fusionarse, las células de un mismo jugador se empujan para no encimarse. */
    private void separarCelulasPropias() {
        List<Blob> celulas = new ArrayList<>(state.players().values());
        for (int i = 0; i < celulas.size(); i++) {
            Blob a = celulas.get(i);
            for (int j = i + 1; j < celulas.size(); j++) {
                Blob b = celulas.get(j);
                if (!a.getOwnerId().equals(b.getOwnerId()) || (a.getFusionTicks() == 0 && b.getFusionTicks() == 0)) {
                    continue;
                }
                double dx = b.getX() - a.getX();
                double dy = b.getY() - a.getY();
                double d = Math.max(0.01, Math.hypot(dx, dy));
                double solape = a.getRadius() + b.getRadius() - d;
                if (solape > 0) {
                    double empuje = solape / 2;
                    a.setX(clamp(a.getX() - dx / d * empuje));
                    a.setY(clamp(a.getY() - dy / d * empuje));
                    b.setX(clamp(b.getX() + dx / d * empuje));
                    b.setY(clamp(b.getY() + dy / d * empuje));
                }
            }
        }
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
            if (bot.getRadius() > other.getRadius() * EAT_SIZE_RATIO && other.getEscudoTicks() == 0
                    && dist < HUNT_RADIUS && dist < closestPreyDist) {
                prey = other;
                closestPreyDist = dist;
            }
        }

        if (threat != null && bot.getEscudoTicks() == 0) {
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
            if (isRemoved(blob)) {
                continue;
            }
            double alcanceIman = blob.getImanTicks() > 0 ? ALCANCE_IMAN : 0;
            for (Pellet pellet : List.copyOf(state.pellets().values())) {
                if (Pellet.MASA.equals(pellet.tipo()) && blob.getOwnerId().equals(pellet.duenoId())
                        && tickActual - pellet.naceEnTick() < TICKS_MASA_PROPIA) {
                    continue;
                }
                // El imán atrae comida, no power-ups (si no, los acapararía todos).
                double alcance = blob.getRadius() + (pellet.esPowerUp() ? 0 : alcanceIman);
                double dist = Math.hypot(pellet.x() - blob.getX(), pellet.y() - blob.getY());
                if (dist >= alcance || state.pellets().remove(pellet.id()) == null) {
                    continue;
                }
                if (pellet.esPowerUp()) {
                    aplicarPowerUp(blob, pellet);
                    continue;
                }
                growBlob(blob, Math.sqrt(blob.getRadius() * blob.getRadius() + pellet.areaQueAporta()));
                if (isRemoved(blob)) {
                    break;
                }
            }
        }
    }

    /** El efecto se aplica a todas las células del jugador (o al bot). */
    private void aplicarPowerUp(Blob blob, Pellet pellet) {
        List<Blob> afectadas = blob.isBot() ? List.of(blob) : state.cellsOf(blob.getOwnerId());
        for (Blob cell : afectadas) {
            switch (pellet.tipo()) {
                case Pellet.VELOCIDAD -> cell.setVelocidadTicks(TICKS_POWERUP);
                case Pellet.ESCUDO -> cell.setEscudoTicks(TICKS_POWERUP);
                default -> cell.setImanTicks(TICKS_POWERUP);
            }
        }
        eventosDelTick.add(new ArenaEvent(ArenaEvent.POWERUP, blob.getName(), pellet.tipo(), pellet.x(), pellet.y(), blob.getColor()));
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

                if (a.getOwnerId().equals(b.getOwnerId())) {
                    // Células propias: se fusionan sin pérdida cuando ya pasó el tiempo.
                    if (a.getFusionTicks() == 0 && b.getFusionTicks() == 0 && dist < bigger.getRadius()) {
                        state.removeCell(smaller.getId());
                        growBlob(bigger, Math.hypot(bigger.getRadius(), smaller.getRadius()));
                    }
                    continue;
                }

                if (dist < bigger.getRadius() && bigger.getRadius() > smaller.getRadius() * EAT_SIZE_RATIO
                        && smaller.getEscudoTicks() == 0) {
                    double newRadius = Math.sqrt(bigger.getRadius() * bigger.getRadius()
                            + smaller.getRadius() * smaller.getRadius() * GROWTH_FACTOR);
                    eventosDelTick.add(new ArenaEvent(ArenaEvent.COMIO, bigger.getName(), smaller.getName(),
                            smaller.getX(), smaller.getY(), smaller.getColor()));
                    eat(smaller);
                    growBlob(bigger, newRadius);
                }
            }
        }
    }

    /** Crece un blob con tope en MAX_RADIUS: llegar ahí termina la partida (victoria o retiro del bot). */
    private void growBlob(Blob blob, double newRadius) {
        double capped = Math.min(newRadius, ArenaState.MAX_RADIUS);
        blob.setRadius(capped);
        if (capped < ArenaState.MAX_RADIUS) {
            return;
        }
        if (blob.isBot()) {
            state.respawnBot(blob.getId());
        } else {
            state.removePlayer(blob.getOwnerId());
            victories.tryEmitNext(blob.getOwnerId());
        }
    }

    private boolean isRemoved(Blob blob) {
        if (blob.isBot()) {
            return state.bots().get(blob.getId()) != blob;
        }
        return !state.players().containsKey(blob.getId());
    }

    /** Un jugador muere recién cuando le comen la última célula. */
    private void eat(Blob smaller) {
        if (smaller.isBot()) {
            state.respawnBot(smaller.getId());
            return;
        }
        state.removeCell(smaller.getId());
        if (state.cellsOf(smaller.getOwnerId()).isEmpty()) {
            deaths.tryEmitNext(smaller.getOwnerId());
        }
    }
}
