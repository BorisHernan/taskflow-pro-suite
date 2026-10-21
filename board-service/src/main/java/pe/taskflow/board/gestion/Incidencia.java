package pe.taskflow.board.gestion;

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
@Table("incidencias")
public class Incidencia {

    public static final String ABIERTA = "ABIERTA";
    public static final String EN_CURSO = "EN_CURSO";
    public static final String RESUELTA = "RESUELTA";

    @Id
    private Long id;
    private Long tiendaId;
    private String titulo;
    private String descripcion;
    private String categoria;
    private String severidad;
    private String estado;
    private String solucion;
    private Long tareaId;
    private Long turnoId;
    private String reportadaPor;
    private LocalDateTime creadaEn;
    private LocalDateTime resueltaEn;

    public boolean grave() {
        return "ALTA".equals(severidad) || "CRITICA".equals(severidad);
    }
}
