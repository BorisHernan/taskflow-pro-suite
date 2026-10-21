package pe.taskflow.board.gestion;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Cuerpos de las peticiones de gestión. tiendaId solo lo usa el administrador. */
public final class Solicitudes {

    private Solicitudes() {
    }

    public record AbrirTurno(
            Long tiendaId,
            @NotBlank @Pattern(regexp = "MANANA|TARDE|NOCHE", message = "tipo debe ser MANANA, TARDE o NOCHE") String tipo,
            @NotBlank @Size(max = 80) String responsable,
            @Size(max = 500) String nota) {
    }

    public record CerrarTurno(@Size(max = 500) String nota) {
    }

    public record NuevaMerma(
            Long tiendaId,
            @NotNull Long productoId,
            @NotNull @Min(1) @Max(500) Integer cantidad,
            @NotBlank @Pattern(regexp = "DANADO|VENCIDO|ROBO|ERROR_INVENTARIO|OTRO", message = "motivo inválido") String motivo,
            @Size(max = 300) String nota) {
    }

    public record NuevaIncidencia(
            Long tiendaId,
            @NotBlank @Size(max = 160) String titulo,
            @Size(max = 1000) String descripcion,
            @NotBlank @Pattern(regexp = "EQUIPOS|LIMPIEZA|SEGURIDAD|CLIENTE|SISTEMAS|OTRO", message = "categoría inválida") String categoria,
            @NotBlank @Pattern(regexp = "BAJA|MEDIA|ALTA|CRITICA", message = "severidad inválida") String severidad) {
    }

    public record CambioIncidencia(
            @NotBlank @Pattern(regexp = "ABIERTA|EN_CURSO|RESUELTA", message = "estado inválido") String estado,
            @Size(max = 500) String solucion) {
    }

    public record NuevoPedido(
            Long tiendaId,
            @NotNull Long productoId,
            @NotNull @Min(1) @Max(500) Integer cantidad,
            @Size(max = 300) String nota) {
    }

    public record RevisionPedido(@Size(max = 300) String nota) {
    }

    public record NivelesInventario(
            @NotNull @Min(0) @Max(1000) Integer stockMinimo,
            @NotNull @Min(1) @Max(5000) Integer stockObjetivo) {
    }
}
