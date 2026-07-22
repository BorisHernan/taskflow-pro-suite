package pe.taskflow.board.arena;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import pe.taskflow.board.demo.ContentModerationService;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * Cada conexión WebSocket es un jugador del arena. El nombre viene en la query
 * string (?name=...) y se valida con el mismo filtro de contenido que las
 * tareas del tablero, antes de aceptar la conexión.
 */
@Component
public class ArenaWebSocketHandler implements WebSocketHandler {

    private static final int MAX_NAME_LENGTH = 16;

    private final ArenaState state;
    private final ArenaEngine engine;
    private final ContentModerationService moderationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ArenaWebSocketHandler(ArenaState state, ArenaEngine engine, ContentModerationService moderationService) {
        this.state = state;
        this.engine = engine;
        this.moderationService = moderationService;
    }

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        String name = sanitizeName(extractQueryParam(session.getHandshakeInfo().getUri(), "name").orElse("Jugador"));

        if (moderationService.findBlockedWord(name).isPresent()) {
            return session.close(CloseStatus.POLICY_VIOLATION.withReason("Nombre no permitido"));
        }
        if (state.isFull()) {
            return session.close(new CloseStatus(1013, "Arena llena, intenta más tarde"));
        }

        Blob player = state.addPlayer(name);

        Mono<Void> input = session.receive()
                .doOnNext(message -> handleIncoming(player, message))
                .then();

        Flux<WebSocketMessage> welcome = Flux.just(
                session.textMessage("{\"type\":\"welcome\",\"id\":\"" + player.getId() + "\"}"));

        Flux<WebSocketMessage> outboundSnapshots = engine.snapshots()
                .map(snapshot -> session.textMessage(toJson(snapshot)));

        Mono<Void> output = session.send(Flux.concat(welcome, outboundSnapshots));

        Mono<Void> deathTermination = engine.deaths()
                .filter(id -> id.equals(player.getId()))
                .next()
                .flatMap(id -> session.close(CloseStatus.NORMAL.withReason("eaten")))
                .then();

        return Mono.when(input, output, deathTermination)
                .doFinally(signal -> state.removePlayer(player.getId()));
    }

    private void handleIncoming(Blob player, WebSocketMessage message) {
        try {
            JsonNode node = objectMapper.readTree(message.getPayloadAsText());
            if (node.has("tx") && node.has("ty")) {
                player.setTargetX(clamp(node.get("tx").asDouble()));
                player.setTargetY(clamp(node.get("ty").asDouble()));
            }
        } catch (Exception ignored) {
            // Mensaje malformado: se ignora, no vale la pena tumbar la conexión por esto.
        }
    }

    private double clamp(double value) {
        return Math.max(0, Math.min(ArenaState.WORLD_SIZE, value));
    }

    private String toJson(ArenaSnapshot snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String sanitizeName(String raw) {
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return "Jugador";
        }
        return trimmed.length() > MAX_NAME_LENGTH ? trimmed.substring(0, MAX_NAME_LENGTH) : trimmed;
    }

    private Optional<String> extractQueryParam(URI uri, String key) {
        String query = uri.getRawQuery();
        if (query == null) {
            return Optional.empty();
        }
        for (String pair : query.split("&")) {
            int idx = pair.indexOf('=');
            if (idx < 0) {
                continue;
            }
            if (pair.substring(0, idx).equals(key)) {
                return Optional.of(URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8));
            }
        }
        return Optional.empty();
    }
}
