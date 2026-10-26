package pe.taskflow.board.ventas;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class SolicitudesOrden {

    private SolicitudesOrden() {
    }

    public record Linea(@NotNull Long productoId, @NotNull @Min(1) @Max(50) Integer cantidad) {
    }

    public record NuevaOrden(
            @NotNull Long tiendaId,
            @NotBlank @Size(max = 80) String clienteNombre,
            @NotBlank @Pattern(regexp = "RECOJO|ENVIO", message = "modalidad debe ser RECOJO o ENVIO") String modalidad,
            @Size(max = 200) String direccion,
            Double latitud,
            Double longitud,
            @Size(max = 20) String cupon,
            @NotEmpty @Size(max = 20) List<@Valid Linea> lineas) {
    }

    public record CambioEstado(
            @NotBlank @Pattern(regexp = "PREPARANDO|LISTA|EN_CAMINO|ENTREGADA", message = "estado inválido") String estado) {
    }

    /** Orden con sus líneas y los datos de la sede, lista para mostrar o seguir. */
    public record OrdenVista(Orden orden, List<LineaVista> lineas, String tiendaNombre, String tiendaDireccion,
                             BigDecimal tiendaLatitud, BigDecimal tiendaLongitud) {
    }

    public record LineaVista(String producto, int cantidad, BigDecimal total, LocalDateTime fecha) {
    }
}
