package pe.taskflow.board.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("tasks")
public class Task {

    @Id
    private Long id;

    @NotBlank(message = "El título es obligatorio")
    private String title;

    private String description;

    @Pattern(regexp = "TODO|IN_PROGRESS|DONE", message = "status debe ser TODO, IN_PROGRESS o DONE")
    private String status;

    private Integer position;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    // IP del visitante que creó la tarea, usada para limitar abuso en el demo público.
    // Se ignora cualquier valor que venga del cliente; el servidor siempre la sobreescribe.
    private String createdByIp;

    // Gestión de tiendas. null = tarea general (solo la ve el administrador).
    private Long tiendaId;

    @Pattern(regexp = "MANUAL|REPOSICION|INCIDENCIA|TURNO|PEDIDO", message = "tipo inválido")
    private String tipo;

    @Pattern(regexp = "BAJA|MEDIA|ALTA|CRITICA", message = "prioridad debe ser BAJA, MEDIA, ALTA o CRITICA")
    private String prioridad;

    private Long productoId;

    // Id de la incidencia que originó la tarea (tipo INCIDENCIA).
    private Long referenciaId;

    private Long turnoId;

    private String creadoPor;

    private String asignadoA;

    // Persona de la sede que la está haciendo, desde cuándo y cuánto debería tardar.
    private Long empleadoId;

    private LocalDateTime asignadaEn;

    private Integer minutosEstimados;

    private LocalDateTime cerradaEn;
}
