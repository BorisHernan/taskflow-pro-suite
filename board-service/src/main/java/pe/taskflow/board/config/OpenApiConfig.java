package pe.taskflow.board.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI boardServiceOpenApi() {
        return new OpenAPI().info(new Info()
                .title("TaskFlow Pro — Board Service API")
                .description("API reactiva (Spring WebFlux + R2DBC) del tablero kanban de TaskFlow Pro, "
                        + "con actualizaciones en vivo por Server-Sent Events.")
                .version("v0.1.0"));
    }
}
