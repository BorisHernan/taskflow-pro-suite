package pe.taskflow.board.gestion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.taskflow.board.auth.UsuarioActual;
import reactor.core.publisher.Flux;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Panel de inicio de cada rol: indicadores por tienda, ventas recientes y ventas por día. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Resumen", description = "Indicadores del día por tienda")
public class ResumenController {

    private final DatabaseClient db;

    public record ResumenTienda(long tiendaId, String codigo, String nombre, BigDecimal ventasHoy, long comprasHoy,
                                long alertas, long agotados, long incidenciasAbiertas, long tareasAbiertas,
                                long tareasUrgentes, BigDecimal mermasMes, long pedidosEnCurso, String turnoResponsable) {
    }

    public record Venta(long id, long tiendaId, String producto, String categoria, int cantidad, BigDecimal total,
                        LocalDateTime fecha) {
    }

    public record VentaDia(LocalDate fecha, long unidades, BigDecimal ingresos) {
    }

    @Operation(summary = "Indicadores de hoy: una fila por tienda visible para el usuario")
    @GetMapping("/resumen")
    public Flux<ResumenTienda> resumen(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                SELECT t.id, t.codigo, t.nombre,
                  (SELECT COALESCE(SUM(total), 0) FROM purchases p WHERE p.tienda_id = t.id AND p.created_at >= CURRENT_DATE) AS ventas_hoy,
                  (SELECT COUNT(*) FROM purchases p WHERE p.tienda_id = t.id AND p.created_at >= CURRENT_DATE) AS compras_hoy,
                  (SELECT COUNT(*) FROM inventario i WHERE i.tienda_id = t.id AND i.stock <= i.stock_minimo) AS alertas,
                  (SELECT COUNT(*) FROM inventario i WHERE i.tienda_id = t.id AND i.stock = 0) AS agotados,
                  (SELECT COUNT(*) FROM incidencias x WHERE x.tienda_id = t.id AND x.estado <> 'RESUELTA') AS incidencias,
                  (SELECT COUNT(*) FROM tasks k WHERE k.tienda_id = t.id AND k.status <> 'DONE') AS tareas,
                  (SELECT COUNT(*) FROM tasks k WHERE k.tienda_id = t.id AND k.status <> 'DONE'
                          AND k.prioridad IN ('ALTA', 'CRITICA')) AS urgentes,
                  (SELECT COALESCE(SUM(costo), 0) FROM mermas m WHERE m.tienda_id = t.id
                          AND m.creada_en >= date_trunc('month', now())) AS mermas_mes,
                  (SELECT COUNT(*) FROM pedidos pe WHERE pe.tienda_id = t.id AND pe.estado IN ('SOLICITADO', 'APROBADO')) AS pedidos,
                  (SELECT tu.responsable FROM turnos tu WHERE tu.tienda_id = t.id AND tu.estado = 'ABIERTO') AS turno
                FROM tiendas t WHERE t.id = COALESCE(:tienda, t.id) ORDER BY t.codigo""");
        return Sql.bindOrNull(consulta, "tienda", UsuarioActual.de(jwt).tiendaVisible(tienda), Long.class)
                .map((row, meta) -> new ResumenTienda(
                        row.get("id", Long.class), row.get("codigo", String.class), row.get("nombre", String.class),
                        row.get("ventas_hoy", BigDecimal.class), row.get("compras_hoy", Long.class),
                        row.get("alertas", Long.class), row.get("agotados", Long.class),
                        row.get("incidencias", Long.class), row.get("tareas", Long.class), row.get("urgentes", Long.class),
                        row.get("mermas_mes", BigDecimal.class), row.get("pedidos", Long.class), row.get("turno", String.class)))
                .all();
    }

    @Operation(summary = "Últimas 50 ventas de la tienda online")
    @GetMapping("/ventas")
    public Flux<Venta> ventas(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                SELECT id, tienda_id, product_name, category, quantity, total, created_at FROM purchases
                WHERE tienda_id = COALESCE(:tienda, tienda_id) ORDER BY created_at DESC LIMIT 50""");
        return Sql.bindOrNull(consulta, "tienda", UsuarioActual.de(jwt).tiendaVisible(tienda), Long.class)
                .map((row, meta) -> new Venta(row.get("id", Long.class), row.get("tienda_id", Long.class),
                        row.get("product_name", String.class), row.get("category", String.class),
                        row.get("quantity", Integer.class), row.get("total", BigDecimal.class),
                        row.get("created_at", LocalDateTime.class)))
                .all();
    }

    @Operation(summary = "Unidades e ingresos por día, últimos 14 días")
    @GetMapping("/ventas/por-dia")
    public Flux<VentaDia> ventasPorDia(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                SELECT CAST(created_at AS DATE) AS fecha, SUM(quantity) AS unidades, SUM(total) AS ingresos FROM purchases
                WHERE tienda_id = COALESCE(:tienda, tienda_id) AND created_at > CURRENT_DATE - 14
                GROUP BY 1 ORDER BY 1""");
        return Sql.bindOrNull(consulta, "tienda", UsuarioActual.de(jwt).tiendaVisible(tienda), Long.class)
                .map((row, meta) -> new VentaDia(row.get("fecha", LocalDate.class),
                        row.get("unidades", Number.class).longValue(), row.get("ingresos", BigDecimal.class)))
                .all();
    }
}
