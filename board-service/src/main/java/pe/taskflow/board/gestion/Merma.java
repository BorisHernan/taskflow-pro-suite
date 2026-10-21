package pe.taskflow.board.gestion;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("mermas")
public class Merma {

    @Id
    private Long id;
    private Long tiendaId;
    private Long productoId;
    private String productoNombre;
    private Integer cantidad;
    private String motivo;
    private BigDecimal costo;
    private String nota;
    private Long turnoId;
    private String registradoPor;
    private LocalDateTime creadaEn;
}
