package pe.taskflow.board.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Orígenes permitidos vienen de la property app.cors.allowed-origins (env var
 * ALLOWED_ORIGINS), como lista separada por comas. En dev apunta a localhost:4200;
 * en producción debe apuntar al dominio real del frontend desplegado.
 */
@Configuration
public class WebConfig {

    @Value("${app.cors.allowed-origins}")
    private String allowedOriginsCsv;

    @Bean
    public CorsWebFilter corsWebFilter() {
        List<String> allowedOrigins = Arrays.stream(allowedOriginsCsv.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsWebFilter(source);
    }
}
