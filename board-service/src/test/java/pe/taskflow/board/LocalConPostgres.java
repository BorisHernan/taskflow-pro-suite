package pe.taskflow.board;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.SpringApplication;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Levanta el backend completo con un PostgreSQL embebido, sin Docker:
 * mvn spring-boot:test-run -Dspring-boot.run.main-class=pe.taskflow.board.LocalConPostgres
 * Los datos quedan en target/postgres-local y sobreviven entre arranques.
 */
public class LocalConPostgres {

    public static void main(String[] args) throws Exception {
        Path datos = Path.of("target", "postgres-local");
        Files.createDirectories(datos);
        EmbeddedPostgres postgres = EmbeddedPostgres.builder()
                .setPort(5433)
                .setDataDirectory(datos)
                .setCleanDataDirectory(false)
                .start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                postgres.close();
            } catch (Exception ignored) {
                // Se está apagando de todos modos.
            }
        }));

        System.setProperty("spring.r2dbc.url", "r2dbc:postgresql://localhost:5433/postgres");
        System.setProperty("spring.r2dbc.username", "postgres");
        System.setProperty("spring.r2dbc.password", "postgres");
        System.setProperty("spring.flyway.url", "jdbc:postgresql://localhost:5433/postgres");
        System.setProperty("spring.flyway.user", "postgres");
        System.setProperty("spring.flyway.password", "postgres");
        System.setProperty("app.auth.jwt-secret", "clave-local-de-desarrollo-de-32-bytes!");
        SpringApplication.run(BoardServiceApplication.class, args);
    }
}
