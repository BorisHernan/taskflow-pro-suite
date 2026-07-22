package pe.taskflow.board.demo;

import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Filtro de lenguaje ofensivo + control de abuso por IP para el demo público.
 * No requiere login, así que la única señal de identidad de un visitante es su IP:
 * es una heurística imperfecta (NAT/VPN comparten IP), suficiente para un demo de portafolio.
 */
@Component
public class ContentModerationService {

    public static final int MAX_VIOLATIONS = 3;

    private final Set<String> blockedWords;
    private final Map<String, AtomicInteger> violationsByIp = new ConcurrentHashMap<>();

    public ContentModerationService() {
        this.blockedWords = loadBlockedWords();
    }

    public Optional<String> findBlockedWord(String... texts) {
        String normalized = normalize(String.join(" ", texts));
        if (normalized.isBlank()) {
            return Optional.empty();
        }
        return blockedWords.stream()
                .filter(word -> Pattern.compile("\\b" + Pattern.quote(word) + "\\b").matcher(normalized).find())
                .findFirst();
    }

    /** @return el número de violaciones acumuladas por esa IP, incluyendo esta. */
    public int recordViolation(String ip) {
        return violationsByIp.computeIfAbsent(ip, key -> new AtomicInteger()).incrementAndGet();
    }

    public boolean isBlocked(String ip) {
        AtomicInteger count = violationsByIp.get(ip);
        return count != null && count.get() >= MAX_VIOLATIONS;
    }

    /** Se llama en cada limpieza periódica del demo para no bloquear visitantes para siempre. */
    public void resetViolations() {
        violationsByIp.clear();
    }

    private static String normalize(String text) {
        if (text == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(text, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    private Set<String> loadBlockedWords() {
        try (var input = getClass().getResourceAsStream("/moderation/blocked-words.txt")) {
            if (input == null) {
                return Set.of();
            }
            try (var reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                return reader.lines()
                        .map(String::trim)
                        .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                        .map(ContentModerationService::normalize)
                        .collect(Collectors.toUnmodifiableSet());
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
