package pe.taskflow.board.demo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Datos agregados para los gráficos de estadísticas (todo sale de Postgres). */
public record HistorialStats(
        List<SerieDia> visitasPorDia,
        List<VentaDia> ventasPorDia,
        List<VentaGrupo> ventasPorCategoria,
        List<VentaGrupo> topProductos,
        List<Conteo> tareasPorEstado,
        List<Conteo> resenasPorEstrellas,
        List<StockCategoria> stockPorCategoria
) {

    public record SerieDia(LocalDate fecha, long total) {}

    public record VentaDia(LocalDate fecha, long unidades, BigDecimal ingresos) {}

    public record VentaGrupo(String nombre, long unidades, BigDecimal ingresos) {}

    public record Conteo(String clave, long total) {}

    public record StockCategoria(String categoria, long stock, long inicial) {}
}
