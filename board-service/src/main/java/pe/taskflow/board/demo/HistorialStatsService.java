package pe.taskflow.board.demo;

import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import pe.taskflow.board.demo.HistorialStats.Conteo;
import pe.taskflow.board.demo.HistorialStats.SerieDia;
import pe.taskflow.board.demo.HistorialStats.StockCategoria;
import pe.taskflow.board.demo.HistorialStats.VentaDia;
import pe.taskflow.board.demo.HistorialStats.VentaGrupo;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Agregaciones para los gráficos. Son GROUP BY directos en SQL: la base de
 * datos resume y al frontend solo le llegan unas decenas de filas.
 */
@Service
@RequiredArgsConstructor
public class HistorialStatsService {

    static final int DIAS = 30;

    private final DatabaseClient db;

    public Mono<HistorialStats> historial() {
        return Mono.zip(
                visitasPorDia(), ventasPorDia(), ventasPorCategoria(), topProductos(),
                tareasPorEstado(), resenasPorEstrellas(), stockPorCategoria()
        ).map(t -> new HistorialStats(t.getT1(), t.getT2(), t.getT3(), t.getT4(), t.getT5(), t.getT6(), t.getT7()));
    }

    private Mono<List<SerieDia>> visitasPorDia() {
        return db.sql("""
                        SELECT visit_date AS fecha, COUNT(*) AS total FROM visit_log
                        WHERE visit_date > CURRENT_DATE - :dias GROUP BY visit_date ORDER BY visit_date""")
                .bind("dias", DIAS)
                .map((row, meta) -> new SerieDia(row.get("fecha", LocalDate.class), largo(row.get("total", Long.class))))
                .all().collectList();
    }

    private Mono<List<VentaDia>> ventasPorDia() {
        return db.sql("""
                        SELECT CAST(created_at AS DATE) AS fecha, SUM(quantity) AS unidades, SUM(total) AS ingresos
                        FROM purchases WHERE created_at > CURRENT_DATE - :dias GROUP BY 1 ORDER BY 1""")
                .bind("dias", DIAS)
                .map((row, meta) -> new VentaDia(row.get("fecha", LocalDate.class),
                        largo(row.get("unidades", Long.class)), dinero(row.get("ingresos", BigDecimal.class))))
                .all().collectList();
    }

    private Mono<List<VentaGrupo>> ventasPorCategoria() {
        return ventasAgrupadas("category", 20);
    }

    private Mono<List<VentaGrupo>> topProductos() {
        return ventasAgrupadas("product_name", 5);
    }

    // `columna` es siempre una constante de esta clase, nunca entrada del usuario.
    private Mono<List<VentaGrupo>> ventasAgrupadas(String columna, int limite) {
        return db.sql("SELECT " + columna + " AS nombre, SUM(quantity) AS unidades, SUM(total) AS ingresos "
                        + "FROM purchases GROUP BY 1 ORDER BY unidades DESC LIMIT " + limite)
                .map((row, meta) -> new VentaGrupo(row.get("nombre", String.class),
                        largo(row.get("unidades", Long.class)), dinero(row.get("ingresos", BigDecimal.class))))
                .all().collectList();
    }

    private Mono<List<Conteo>> tareasPorEstado() {
        return conteo("SELECT status AS clave, COUNT(*) AS total FROM tasks GROUP BY status");
    }

    private Mono<List<Conteo>> resenasPorEstrellas() {
        return conteo("SELECT CAST(rating AS VARCHAR) AS clave, COUNT(*) AS total FROM product_reviews GROUP BY rating ORDER BY rating DESC");
    }

    private Mono<List<Conteo>> conteo(String sql) {
        return db.sql(sql)
                .map((row, meta) -> new Conteo(row.get("clave", String.class), largo(row.get("total", Long.class))))
                .all().collectList();
    }

    private Mono<List<StockCategoria>> stockPorCategoria() {
        return db.sql("""
                        SELECT p.category AS categoria, SUM(i.stock) AS stock, SUM(i.stock_objetivo) AS inicial
                        FROM inventario i JOIN products p ON p.id = i.producto_id GROUP BY p.category ORDER BY p.category""")
                .map((row, meta) -> new StockCategoria(row.get("categoria", String.class),
                        largo(row.get("stock", Long.class)), largo(row.get("inicial", Long.class))))
                .all().collectList();
    }

    private static long largo(Long valor) {
        return valor == null ? 0 : valor;
    }

    private static BigDecimal dinero(BigDecimal valor) {
        return valor == null ? BigDecimal.ZERO : valor;
    }
}
