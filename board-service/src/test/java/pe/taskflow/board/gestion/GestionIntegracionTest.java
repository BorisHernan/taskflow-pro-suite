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
        // El catálogo completo de una sede ya pesa más que el límite de 256 KB del cliente de pruebas.
        registro.add("spring.codec.max-in-memory-size", () -> "4MB");
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

    @Test
    void cadaSedeTieneSuUbicacionYSuSurtidoPropio() {
        JsonNode tiendas = http.get().uri("/api/tiendas").exchange().expectStatus().isOk()
                .expectBody(JsonNode.class).returnResult().getResponseBody();
        for (JsonNode t : tiendas) {
            assertThat(t.get("latitud").asDouble()).isBetween(-12.2, -12.0);
            assertThat(t.get("direccion").asText()).isNotBlank();
        }

        java.util.Map<Long, java.util.Set<String>> catalogo = new java.util.HashMap<>();
        for (JsonNode t : tiendas) {
            long id = t.get("id").asLong();
            JsonNode productos = http.get().uri("/api/products?tienda=" + id).exchange().expectStatus().isOk()
                    .expectBody(JsonNode.class).returnResult().getResponseBody();
            java.util.Set<String> nombres = new java.util.HashSet<>();
            productos.forEach(p -> nombres.add(p.get("name").asText()));
            catalogo.put(id, nombres);
        }
        // La cámara web es exclusiva de San Isidro; la manta, de Surco.
        long sanIsidro = tiendas.get(1).get("id").asLong();
        long surco = tiendas.get(2).get("id").asLong();
        assertThat(catalogo.get(sanIsidro)).contains("Cámara web Full HD").doesNotContain("Manta polar 150 × 200 cm");
        assertThat(catalogo.get(surco)).contains("Manta polar 150 × 200 cm").doesNotContain("Cámara web Full HD");
    }

    @Test
    void unaPromocionDosPorUnoCobraSoloUnaUnidadPorCadaPar() {
        String miraflores = token("miraflores");
        long tienda = json(miraflores, "/api/auth/yo").get("tiendaId").asLong();
        JsonNode catalogo = http.get().uri("/api/products?tienda=" + tienda).exchange()
                .expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        JsonNode promo = null;
        for (JsonNode p : catalogo) {
            if ("2X1".equals(p.path("promo").asText()) && p.get("stock").asInt() >= 4) {
                promo = p;
                break;
            }
        }
        assertThat(promo).as("hay productos con 2×1 y stock").isNotNull();

        JsonNode creada = http.post().uri("/api/ordenes").bodyValue(Map.of("tiendaId", tienda, "clienteNombre", "Marta",
                        "modalidad", "RECOJO", "lineas", java.util.List.of(Map.of("productoId", promo.get("id").asLong(), "cantidad", 3))))
                .exchange().expectStatus().isCreated().expectBody(JsonNode.class).returnResult().getResponseBody();
        // Tres unidades: un par (se paga una) más una suelta = dos unidades cobradas.
        assertThat(creada.get("orden").get("total").decimalValue())
                .isEqualByComparingTo(promo.get("price").decimalValue().multiply(java.math.BigDecimal.valueOf(2)));
    }

    @Test
    void unPedidoOnlineDescuentaTodoJuntoCreaSuTareaYSeSigueHastaLaEntrega() {
        String miraflores = token("miraflores");
        String surco = token("surco");
        long tienda = json(miraflores, "/api/auth/yo").get("tiendaId").asLong();
        java.util.List<JsonNode> conStock = new java.util.ArrayList<>();
        json(miraflores, "/api/inventario").forEach(f -> {
            if (f.get("stock").asInt() >= 3) {
                conStock.add(f);
            }
        });
        JsonNode a = conStock.get(0);
        JsonNode b = conStock.get(1);
        long idA = a.get("productoId").asLong();
        long idB = b.get("productoId").asLong();

        // Si una línea no tiene stock, no se cobra ninguna.
        java.util.List<Map<String, Object>> demasiado = new java.util.ArrayList<>();
        demasiado.add(Map.of("productoId", idA, "cantidad", 1));
        for (int i = 0; i <= b.get("stock").asInt() / 50; i++) {
            demasiado.add(Map.of("productoId", idB, "cantidad", 50));
        }
        http.post().uri("/api/ordenes").bodyValue(Map.of("tiendaId", tienda, "clienteNombre", "Lucía", "modalidad", "RECOJO",
                "lineas", demasiado)).exchange().expectStatus().isEqualTo(HttpStatus.CONFLICT);
        assertThat(stockDe(miraflores, idA)).isEqualTo(a.get("stock").asInt());

        // Fuera de la zona de reparto (Chincha, a más de 100 km) no se acepta, y tampoco se cobra.
        http.post().uri("/api/ordenes").bodyValue(Map.of("tiendaId", tienda, "clienteNombre", "Lucía", "modalidad", "ENVIO",
                "latitud", -13.41, "longitud", -76.13, "lineas", java.util.List.of(Map.of("productoId", idA, "cantidad", 1))))
                .exchange().expectStatus().isBadRequest();
        assertThat(stockDe(miraflores, idA)).isEqualTo(a.get("stock").asInt());

        // El envío necesita la ubicación.
        http.post().uri("/api/ordenes").bodyValue(Map.of("tiendaId", tienda, "clienteNombre", "Lucía", "modalidad", "ENVIO",
                "lineas", java.util.List.of(Map.of("productoId", idA, "cantidad", 1)))).exchange().expectStatus().isBadRequest();

        JsonNode creada = http.post().uri("/api/ordenes").bodyValue(Map.of("tiendaId", tienda, "clienteNombre", "Lucía",
                        "modalidad", "ENVIO", "direccion", "Calle Berlín 250", "latitud", -12.119, "longitud", -77.034,
                        "cupon", "bienvenido10",
                        "lineas", java.util.List.of(Map.of("productoId", idA, "cantidad", 2), Map.of("productoId", idB, "cantidad", 1))))
                .exchange().expectStatus().isCreated().expectBody(JsonNode.class).returnResult().getResponseBody();
        JsonNode orden = creada.get("orden");
        String codigo = orden.get("codigo").asText();
        assertThat(codigo).matches("TF-[A-Z0-9]{6}");
        assertThat(creada.get("lineas")).hasSize(2);
        assertThat(orden.get("descuento").decimalValue()).isPositive();
        assertThat(orden.get("distanciaKm").asDouble()).isBetween(0.1, 2.0);
        assertThat(stockDe(miraflores, idA)).isEqualTo(a.get("stock").asInt() - 2);

        long ordenId = orden.get("id").asLong();
        long tareaId = orden.get("tareaId").asLong();
        assertThat(estadoDeTarea(miraflores, tareaId)).isEqualTo("TODO");

        // Otra sede no lo despacha y no se saltan pasos.
        avanzar(surco, ordenId, "PREPARANDO", HttpStatus.FORBIDDEN);
        avanzar(miraflores, ordenId, "EN_CAMINO", HttpStatus.CONFLICT);
        avanzar(miraflores, ordenId, "PREPARANDO", HttpStatus.OK);
        assertThat(estadoDeTarea(miraflores, tareaId)).isEqualTo("IN_PROGRESS");
        avanzar(miraflores, ordenId, "LISTA", HttpStatus.CONFLICT);
        avanzar(miraflores, ordenId, "EN_CAMINO", HttpStatus.OK);
        avanzar(miraflores, ordenId, "ENTREGADA", HttpStatus.OK);
        assertThat(estadoDeTarea(miraflores, tareaId)).isEqualTo("DONE");

        JsonNode seguimiento = http.get().uri("/api/ordenes/seguimiento/" + codigo.toLowerCase()).exchange()
                .expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        assertThat(seguimiento.get("orden").get("estado").asText()).isEqualTo("ENTREGADA");
        assertThat(seguimiento.get("tiendaNombre").asText()).isNotBlank();
        http.get().uri("/api/ordenes/seguimiento/TF-NOEXIS").exchange().expectStatus().isNotFound();
    }

    private int stockDe(String token, long producto) {
        for (JsonNode f : json(token, "/api/inventario")) {
            if (f.get("productoId").asLong() == producto) {
                return f.get("stock").asInt();
            }
        }
        return -1;
    }

    private String estadoDeTarea(String token, long id) {
        for (JsonNode t : json(token, "/api/tasks")) {
            if (t.get("id").asLong() == id) {
                return t.get("status").asText();
            }
        }
        return null;
    }

    private void avanzar(String token, long orden, String estado, HttpStatus esperado) {
        http.patch().uri("/api/ordenes/" + orden + "/estado").header("Authorization", "Bearer " + token)
                .bodyValue(Map.of("estado", estado)).exchange().expectStatus().isEqualTo(esperado);
    }

    @Autowired
    private PersonalService personal;

    @Autowired
    private org.springframework.r2dbc.core.DatabaseClient db;

    @Test
    void elPersonalSeAsignaRepondeDesdeElAlmacenYSinAlmacenSePideAlDistribuidor() {
        String miraflores = token("miraflores");
        String surco = token("surco");
        long tienda = json(miraflores, "/api/auth/yo").get("tiendaId").asLong();
        // El día libre depende del día en que corre la prueba: aquí nadie descansa.
        db.sql("UPDATE empleados SET dia_libre = NULL").then().block();

        JsonNode equipo = json(miraflores, "/api/personal");
        assertThat(equipo).hasSize(12);
        equipo.forEach(e -> assertThat(e.get("tiendaId").asLong()).isEqualTo(tienda));
        JsonNode reponedor = null;
        JsonNode cajero = null;
        for (JsonNode e : equipo) {
            if ("DISPONIBLE".equals(e.get("estado").asText()) && "REPONEDOR".equals(e.get("puesto").asText()) && reponedor == null) {
                reponedor = e;
            }
            if ("DISPONIBLE".equals(e.get("estado").asText()) && "CAJERO".equals(e.get("puesto").asText())) {
                cajero = e;
            }
        }
        assertThat(reponedor).as("a toda hora hay un reponedor de turno en Miraflores").isNotNull();
        long reponedorId = reponedor.get("id").asLong();

        // Producto con unidades en el almacén: se vende hasta el mínimo y se abre la alerta.
        JsonNode conAlmacen = filaDe(miraflores, true);
        long producto = conAlmacen.get("productoId").asLong();
        venderHastaElMinimo(tienda, conAlmacen);
        long tarea = tareaDeReposicionId(miraflores, producto);

        if (cajero != null) {
            asignar(miraflores, tarea, cajero.get("id").asLong(), HttpStatus.BAD_REQUEST);
        }
        asignar(surco, tarea, reponedorId, HttpStatus.FORBIDDEN);
        JsonNode asignada = asignar(miraflores, tarea, reponedorId, HttpStatus.OK);
        assertThat(asignada.get("status").asText()).isEqualTo("IN_PROGRESS");
        assertThat(asignada.get("minutosEstimados").asInt()).isBetween(3, 8);
        assertThat(estadoDe(miraflores, reponedorId)).isEqualTo("TRABAJANDO");

        // Pasa el tiempo estimado: la reposición mueve stock del almacén al piso y la alerta se cierra.
        db.sql("UPDATE tasks SET asignada_en = asignada_en - INTERVAL '1 hour' WHERE id = :id").bind("id", tarea).then().block();
        personal.completarVencidas().blockLast(Duration.ofSeconds(20));
        JsonNode despues = filaPorProducto(miraflores, producto);
        assertThat(despues.get("estado").asText()).isEqualTo("OK");
        assertThat(despues.get("almacen").asInt()).isLessThan(conAlmacen.get("almacen").asInt());
        assertThat(estadoDe(miraflores, reponedorId)).isEqualTo("DISPONIBLE");

        // Sin unidades en el almacén no se puede reponer: se pide al distribuidor y queda quién lo pidió.
        JsonNode sinAlmacen = filaDe(miraflores, false);
        long otro = sinAlmacen.get("productoId").asLong();
        venderHastaElMinimo(tienda, sinAlmacen);
        long tareaSin = tareaDeReposicionId(miraflores, otro);
        asignar(miraflores, tareaSin, reponedorId, HttpStatus.CONFLICT);
        JsonNode pedido = post(miraflores, "/api/pedidos", Map.of("productoId", otro, "cantidad", 20, "empleadoId", reponedorId),
                HttpStatus.CREATED);
        assertThat(pedido.get("solicitadoPor").asText()).isEqualTo(reponedor.get("nombre").asText());

        // Moverlo a un puesto le deja un aviso con lo que debe hacer.
        http.put().uri("/api/personal/" + reponedorId + "/puesto").header("Authorization", "Bearer " + miraflores)
                .bodyValue(Map.of("puesto", "CAJA_4")).exchange().expectStatus().isOk();
        JsonNode avisos = json(miraflores, "/api/personal/avisos");
        assertThat(avisos.get(0).get("mensaje").asText()).contains("caja 4");

        // Una ausencia lo saca de la lista de disponibles hasta que se reincorpore.
        http.put().uri("/api/personal/" + reponedorId + "/ausencia").header("Authorization", "Bearer " + miraflores)
                .bodyValue(Map.of("disponibilidad", "DESCANSO_MEDICO", "motivo", "Fiebre")).exchange().expectStatus().isOk();
        assertThat(estadoDe(miraflores, reponedorId)).isEqualTo("AUSENTE");
        http.delete().uri("/api/personal/" + reponedorId + "/ausencia").header("Authorization", "Bearer " + miraflores)
                .exchange().expectStatus().isOk();
        assertThat(estadoDe(miraflores, reponedorId)).isEqualTo("DISPONIBLE");
    }

    private JsonNode asignar(String token, long tarea, long empleado, HttpStatus esperado) {
        return http.post().uri("/api/tasks/" + tarea + "/asignar").header("Authorization", "Bearer " + token)
                .bodyValue(Map.of("empleadoId", empleado)).exchange().expectStatus().isEqualTo(esperado)
                .expectBody(JsonNode.class).returnResult().getResponseBody();
    }

    private String estadoDe(String token, long empleado) {
        for (JsonNode e : json(token, "/api/personal")) {
            if (e.get("id").asLong() == empleado) {
                return e.get("estado").asText();
            }
        }
        return null;
    }

    /** Una fila con stock normal, con o sin unidades en el almacén, sin alerta ni pedido en curso. */
    private JsonNode filaDe(String token, boolean conAlmacen) {
        for (JsonNode f : json(token, "/api/inventario")) {
            if ("OK".equals(f.get("estado").asText()) && !f.get("pedidoEnCurso").asBoolean()
                    && (f.get("almacen").asInt() > 0) == conAlmacen && f.get("stock").asInt() - f.get("stockMinimo").asInt() <= 50) {
                return f;
            }
        }
        throw new AssertionError("no hay fila " + (conAlmacen ? "con" : "sin") + " almacén");
    }

    private JsonNode filaPorProducto(String token, long producto) {
        for (JsonNode f : json(token, "/api/inventario")) {
            if (f.get("productoId").asLong() == producto) {
                return f;
            }
        }
        throw new AssertionError("producto " + producto);
    }

    private void venderHastaElMinimo(long tienda, JsonNode fila) {
        http.post().uri("/api/products/" + fila.get("productoId").asLong() + "/purchase")
                .bodyValue(Map.of("quantity", fila.get("stock").asInt() - fila.get("stockMinimo").asInt(), "tiendaId", tienda))
                .exchange().expectStatus().isOk();
    }

    private long tareaDeReposicionId(String token, long producto) {
        JsonNode t = tareaDeReposicion(token, producto);
        assertThat(t).as("alerta de reposición del producto " + producto).isNotNull();
        return t.get("id").asLong();
    }
}
