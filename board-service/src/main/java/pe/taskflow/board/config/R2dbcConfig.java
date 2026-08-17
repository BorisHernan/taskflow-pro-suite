package pe.taskflow.board.config;

import io.r2dbc.spi.ConnectionFactoryOptions;
import org.springframework.boot.autoconfigure.r2dbc.ConnectionFactoryOptionsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Neon (la base de datos gratis en producción) suspende su cómputo tras un
 * rato sin tráfico; la primera conexión después de eso puede tardar varios
 * segundos en "despertar". El timeout de conexión por defecto del driver es
 * más corto que eso, así que a veces el health check de Actuator (que abre
 * su propia conexión para validar) reporta DOWN por timeout aunque el resto
 * de la app funcione bien — el resto de los endpoints usan sus propias
 * conexiones y sí alcanzan a esperar. Se sube el timeout para que también
 * el health check le dé tiempo real a Neon a responder.
 *
 * Se hace vía ConnectionFactoryOptionsBuilderCustomizer (no metiendo el
 * parámetro en la URL) porque en producción esa URL la define Render como
 * variable de entorno (SPRING_R2DBC_URL), no este código.
 */
@Configuration
public class R2dbcConfig {

    @Bean
    public ConnectionFactoryOptionsBuilderCustomizer connectTimeoutCustomizer() {
        return builder -> builder.option(ConnectionFactoryOptions.CONNECT_TIMEOUT, Duration.ofSeconds(15));
    }
}
