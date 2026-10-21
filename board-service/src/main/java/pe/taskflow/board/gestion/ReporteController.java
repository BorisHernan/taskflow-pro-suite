package pe.taskflow.board.gestion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Exportación CSV para el administrador (la ruta /api/reportes/** exige ROLE_ADMIN). */
@RestController
@RequestMapping("/api/reportes")
@RequiredArgsConstructor
@Tag(name = "Reportes", description = "Exportación CSV por tienda y rango de fechas (solo admin)")
public class ReporteController {

    // Cada consulta recibe :tienda (o null = todas), :desde y :hasta. Las claves son fijas, nunca entrada del usuario.
    static final Map<String, String> CONSULTAS = Map.of(
            "ventas", """
                    SELECT p.id, t.nombre AS tienda, p.product_name AS producto, p.category AS categoria,
                           p.quantity AS cantidad, p.total, p.created_at AS fecha
                    FROM purchases p JOIN tiendas t ON t.id = p.tienda_id
                    WHERE p.tienda_id = COALESCE(:tienda, p.tienda_id) AND p.created_at >= :desde AND p.created_at < :hasta
                    ORDER BY p.created_at""",
            "mermas", """
                    SELECT m.id, t.nombre AS tienda, m.producto_nombre AS producto, m.cantidad, m.motivo, m.costo,
                           m.nota, m.registrado_por, m.creada_en AS fecha
                    FROM mermas m JOIN tiendas t ON t.id = m.tienda_id
                    WHERE m.tienda_id = COALESCE(:tienda, m.tienda_id) AND m.creada_en >= :desde AND m.creada_en < :hasta
                    ORDER BY m.creada_en""",
            "incidencias", """
                    SELECT i.id, t.nombre AS tienda, i.titulo, i.categoria, i.severidad, i.estado, i.solucion,
                           i.reportada_por, i.creada_en, i.resuelta_en
                    FROM incidencias i JOIN tiendas t ON t.id = i.tienda_id
                    WHERE i.tienda_id = COALESCE(:tienda, i.tienda_id) AND i.creada_en >= :desde AND i.creada_en < :hasta
                    ORDER BY i.creada_en""",
            "pedidos", """
                    SELECT pe.id, t.nombre AS tienda, pe.producto_nombre AS producto, pe.cantidad, pe.costo, pe.estado,
                           pe.solicitado_por, pe.revisado_por, pe.creado_en, pe.actualizado_en
                    FROM pedidos pe JOIN tiendas t ON t.id = pe.tienda_id
                    WHERE pe.tienda_id = COALESCE(:tienda, pe.tienda_id) AND pe.creado_en >= :desde AND pe.creado_en < :hasta
                    ORDER BY pe.creado_en""",
            "tareas", """
                    SELECT k.id, COALESCE(t.nombre, 'General') AS tienda, k.title AS titulo, k.tipo, k.prioridad,
                           k.status AS estado, k.creado_por, k.created_at AS creada, k.cerrada_en AS cerrada
                    FROM tasks k LEFT JOIN tiendas t ON t.id = k.tienda_id
                    WHERE (CAST(:tienda AS BIGINT) IS NULL OR k.tienda_id = :tienda) AND k.created_at >= :desde AND k.created_at < :hasta
                    ORDER BY k.created_at""",
            "inventario", """
                    SELECT t.nombre AS tienda, p.name AS producto, p.category AS categoria, i.stock, i.stock_minimo,
                           i.stock_objetivo, i.actualizado_en
                    FROM inventario i JOIN tiendas t ON t.id = i.tienda_id JOIN products p ON p.id = i.producto_id
                    WHERE i.tienda_id = COALESCE(:tienda, i.tienda_id) AND CAST(:desde AS TIMESTAMP) IS NOT NULL
                          AND CAST(:hasta AS TIMESTAMP) IS NOT NULL
                    ORDER BY t.codigo, p.name""");

    private final DatabaseClient db;

    @Operation(summary = "Descarga un reporte en CSV: ventas, mermas, incidencias, pedidos, tareas o inventario")
    @GetMapping("/{tipo}")
    public Mono<ResponseEntity<String>> csv(@PathVariable String tipo,
                                            @RequestParam(required = false) Long tienda,
                                            @RequestParam(required = false) LocalDate desde,
                                            @RequestParam(required = false) LocalDate hasta) {
        String sql = CONSULTAS.get(tipo);
        if (sql == null) {
            return Mono.error(Errores.noEncontrado("Reporte desconocido: " + tipo));
        }
        LocalDate fin = hasta == null ? LocalDate.now() : hasta;
        LocalDate inicio = desde == null ? fin.minusDays(30) : desde;
        DatabaseClient.GenericExecuteSpec consulta = db.sql(sql)
                .bind("desde", inicio.atStartOfDay())
                .bind("hasta", fin.plusDays(1).atStartOfDay());
        return Sql.bindOrNull(consulta, "tienda", tienda, Long.class)
                .fetch().all()
                .collectList()
                .map(filas -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION,
                                "attachment; filename=\"" + tipo + "-" + inicio + "-a-" + fin + ".csv\"")
                        .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                        // BOM: Excel abre el CSV con tildes y eñes correctas.
                        .body("﻿" + aCsv(filas)));
    }

    static String aCsv(List<Map<String, Object>> filas) {
        if (filas.isEmpty()) {
            return "sin datos\n";
        }
        StringBuilder sb = new StringBuilder(String.join(",", filas.get(0).keySet())).append('\n');
        for (Map<String, Object> fila : filas) {
            sb.append(fila.values().stream().map(ReporteController::celda).collect(Collectors.joining(","))).append('\n');
        }
        return sb.toString();
    }

    static String celda(Object valor) {
        if (valor == null) {
            return "";
        }
        if (valor instanceof Number) {
            return valor.toString();
        }
        String texto = valor.toString();
        // Evita que Excel interprete una celda como fórmula (inyección CSV).
        if (!texto.isEmpty() && "=+-@".indexOf(texto.charAt(0)) >= 0) {
            texto = "'" + texto;
        }
        if (texto.contains(",") || texto.contains("\"") || texto.contains("\n")) {
            texto = "\"" + texto.replace("\"", "\"\"") + "\"";
        }
        return texto;
    }
}
