package pe.taskflow.board.gestion;

import com.fasterxml.jackson.databind.JsonNode;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Flujos completos contra un PostgreSQL real (embebido, sin Docker): migraciones,
 * login, alertas de stock, pedidos, turnos, incidencias, mermas y permisos por rol.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GestionIntegracionTest {

    private static EmbeddedPostgres postgres;

    @Autowired
    private WebTestClient http;

    @BeforeAll
    static void arrancarPostgres() throws IOException {
        postgres = EmbeddedPostgres.builder().start();
    }

    @AfterAll
    static void detenerPostgres() throws IOException {
        postgres.close();
    }

    @DynamicPropertySource
    static void baseDeDatos(DynamicPropertyRegistry registro) throws IOException {
        if (postgres == null) {
            postgres = EmbeddedPostgres.builder().start();
        }
        registro.add("spring.r2dbc.url", () -> "r2dbc:postgresql://localhost:" + postgres.getPort() + "/postgres");
        registro.add("spring.r2dbc.username", () -> "postgres");
        registro.add("spring.r2dbc.password", () -> "postgres");
        registro.add("spring.flyway.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
        registro.add("spring.flyway.user", () -> "postgres");
        registro.add("spring.flyway.password", () -> "postgres");
        registro.add("app.auth.jwt-secret", () -> "clave-de-pruebas-de-al-menos-32-bytes!!");
    }

    private String token(String usuario) {
        JsonNode r = http.post().uri("/api/auth/login")
                .bodyValue(Map.of("usuario", usuario, "clave", "demo1234"))
                .exchange().expectStatus().isOk()
                .expectBody(JsonNode.class).returnResult().getResponseBody();
        return r.get("token").asText();
    }

    private WebTestClient.RequestHeadersSpec<?> get(String token, String uri) {
        return http.mutate().responseTimeout(Duration.ofSeconds(20)).build()
                .get().uri(uri).header("Authorization", "Bearer " + token);
    }

    private JsonNode json(String token, String uri) {
        return get(token, uri).exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
    }

    private JsonNode post(String token, String uri, Object cuerpo, HttpStatus esperado) {
        return http.post().uri(uri).header("Authorization", "Bearer " + token).bodyValue(cuerpo)
                .exchange().expectStatus().isEqualTo(esperado)
                .expectBody(JsonNode.class).returnResult().getResponseBody();
    }

    @Test
    void loginRechazaClaveIncorrecta() {
        http.post().uri("/api/auth/login").bodyValue(Map.of("usuario", "admin", "clave", "otra"))
                .exchange().expectStatus().isUnauthorized();
        http.get().uri("/api/tasks").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void cadaTiendaVeSoloLoSuyoYElAdminTodo() {
        String miraflores = token("miraflores");
        long propia = json(miraflores, "/api/auth/yo").get("tiendaId").asLong();

        for (JsonNode tarea : json(miraflores, "/api/tasks")) {
            assertThat(tarea.get("tiendaId").asLong()).isEqualTo(propia);
        }
        assertThat(json(miraflores, "/api/resumen")).hasSize(1);
        // Pedir otra tienda no sirve: se ignora y vuelve la propia.
        assertThat(json(miraflores, "/api/inventario?tienda=2").get(0).get("tiendaId").asLong()).isEqualTo(propia);

        get(miraflores, "/api/stats/historial").exchange().expectStatus().isForbidden();
        get(miraflores, "/api/reportes/ventas").exchange().expectStatus().isForbidden();

        String admin = token("admin");
        assertThat(json(admin, "/api/resumen")).hasSize(3);
        get(admin, "/api/reportes/inventario").exchange().expectStatus().isOk()
                .expectHeader().contentTypeCompatibleWith("text/csv");
    }

    @Test
    void venderBajoElMinimoAbreLaAlertaYElPedidoRecibidoLaCierra() {
        String sanIsidro = token("sanisidro");
        String admin = token("admin");
        long tienda = json(sanIsidro, "/api/auth/yo").get("tiendaId").asLong();

        JsonNode fila = null;
        for (JsonNode f : json(sanIsidro, "/api/inventario")) {
            if ("OK".equals(f.get("estado").asText()) && f.get("stock").asInt() - f.get("stockMinimo").asInt() <= 50) {
                fila = f;
            }
        }
        assertThat(fila).as("algún producto con stock normal").isNotNull();
        long producto = fila.get("productoId").asLong();
        int vender = fila.get("stock").asInt() - fila.get("stockMinimo").asInt();

        http.post().uri("/api/products/" + producto + "/purchase")
                .bodyValue(Map.of("quantity", vender, "tiendaId", tienda))
                .exchange().expectStatus().isOk();

        JsonNode alerta = tareaDeReposicion(sanIsidro, producto);
        assertThat(alerta).as("la venta abre una tarea de reposición").isNotNull();
        assertThat(alerta.get("status").asText()).isEqualTo("TODO");

        JsonNode pedido = post(sanIsidro, "/api/pedidos", Map.of("productoId", producto, "cantidad", 30), HttpStatus.CREATED);
        long pedidoId = pedido.get("id").asLong();
        assertThat(tareaDeReposicion(sanIsidro, producto).get("status").asText()).isEqualTo("IN_PROGRESS");

        // Un segundo pedido del mismo producto se rechaza, y no se recibe lo que no se aprobó.
        post(sanIsidro, "/api/pedidos", Map.of("productoId", producto, "cantidad", 5), HttpStatus.CONFLICT);
        post(sanIsidro, "/api/pedidos/" + pedidoId + "/recibir", Map.of(), HttpStatus.CONFLICT);
        // Aprobar es del administrador.
        post(sanIsidro, "/api/pedidos/" + pedidoId + "/aprobar", Map.of(), HttpStatus.FORBIDDEN);

        post(admin, "/api/pedidos/" + pedidoId + "/aprobar", Map.of(), HttpStatus.OK);
        post(sanIsidro, "/api/pedidos/" + pedidoId + "/recibir", Map.of(), HttpStatus.OK);
        post(sanIsidro, "/api/pedidos/" + pedidoId + "/recibir", Map.of(), HttpStatus.CONFLICT);

        assertThat(tareaDeReposicion(sanIsidro, producto)).as("la alerta se cerró sola").isNull();
    }

    private JsonNode tareaDeReposicion(String token, long producto) {
        for (JsonNode t : json(token, "/api/tasks")) {
            if ("REPOSICION".equals(t.get("tipo").asText()) && t.path("productoId").asLong() == producto
                    && !"DONE".equals(t.get("status").asText())) {
                return t;
            }
        }
        return null;
    }

    @Test
    void elTurnoGeneraSuChecklistYAlCerrarloDaElResumen() {
        String surco = token("surco");
        JsonNode turno = post(surco, "/api/turnos", Map.of("tipo", "TARDE", "responsable", "Rosa Huamán"), HttpStatus.CREATED);
        long id = turno.get("id").asLong();

        post(surco, "/api/turnos", Map.of("tipo", "NOCHE", "responsable", "Otro"), HttpStatus.CONFLICT);

        long checklist = 0;
        for (JsonNode t : json(surco, "/api/tasks")) {
            if (t.path("turnoId").asLong() == id) {
                checklist++;
            }
        }
        assertThat(checklist).isEqualTo(TareasAutomaticas.CHECKLIST_POR_TURNO.get(Turno.TARDE).size());

        JsonNode resumen = post(surco, "/api/turnos/" + id + "/cerrar", Map.of("nota", "Todo en orden"), HttpStatus.OK);
        assertThat(resumen.get("tareas").asLong()).isEqualTo(checklist);
        assertThat(resumen.get("pendientes")).hasSize((int) checklist);
        get(surco, "/api/turnos/actual").exchange().expectStatus().isNoContent();
    }

    @Test
    void unaIncidenciaGraveCreaTareaYResolverlaLaCierra() {
        String miraflores = token("miraflores");
        JsonNode inc = post(miraflores, "/api/incidencias", Map.of(
                "titulo", "Se cayó el sistema de caja", "categoria", "SISTEMAS", "severidad", "CRITICA"), HttpStatus.CREATED);
        long tareaId = inc.get("tareaId").asLong();
        assertThat(tareaId).isPositive();

        http.patch().uri("/api/incidencias/" + inc.get("id").asLong())
                .header("Authorization", "Bearer " + miraflores)
                .bodyValue(Map.of("estado", "RESUELTA", "solucion", "Se reinició el POS"))
                .exchange().expectStatus().isOk();

        for (JsonNode t : json(miraflores, "/api/tasks")) {
            if (t.get("id").asLong() == tareaId) {
                assertThat(t.get("status").asText()).isEqualTo("DONE");
            }
        }
    }

    @Test
    void unaMermaPorRoboDescuentaStockYAbreIncidencia() {
        String miraflores = token("miraflores");
        JsonNode fila = json(miraflores, "/api/inventario").get(json(miraflores, "/api/inventario").size() - 1);
        int antes = fila.get("stock").asInt();

        post(miraflores, "/api/mermas", Map.of("productoId", fila.get("productoId").asLong(), "cantidad", 1, "motivo", "ROBO"),
                HttpStatus.CREATED);

        int despues = -1;
        for (JsonNode f : json(miraflores, "/api/inventario")) {
            if (f.get("id").asLong() == fila.get("id").asLong()) {
                despues = f.get("stock").asInt();
            }
        }
        assertThat(despues).isEqualTo(antes - 1);
        assertThat(json(miraflores, "/api/incidencias").get(0).get("titulo").asText()).startsWith("Robo de 1");

        post(miraflores, "/api/mermas", Map.of("productoId", fila.get("productoId").asLong(), "cantidad", 500, "motivo", "DANADO"),
                HttpStatus.CONFLICT);
    }
}
