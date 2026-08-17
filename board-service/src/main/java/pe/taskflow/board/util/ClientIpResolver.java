package pe.taskflow.board.util;

import org.springframework.http.server.reactive.ServerHttpRequest;

/**
 * Resuelve la IP real del visitante detrás de proxies (Cloudflare/Render).
 * Se usa como única señal de identidad en el demo público sin login: para
 * limitar abuso (ContentModerationService, límite de tareas) y para contar
 * visitas únicas por día en DemoStatsService.
 */
public final class ClientIpResolver {

    private ClientIpResolver() {
    }

    public static String resolve(ServerHttpRequest request) {
        String cfConnectingIp = request.getHeaders().getFirst("CF-Connecting-IP");
        if (cfConnectingIp != null && !cfConnectingIp.isBlank()) {
            return cfConnectingIp;
        }
        String forwardedFor = request.getHeaders().getFirst("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddress() != null
                ? request.getRemoteAddress().getAddress().getHostAddress()
                : "unknown";
    }
}
