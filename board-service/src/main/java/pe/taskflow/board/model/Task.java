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
}
