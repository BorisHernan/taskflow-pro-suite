package pe.taskflow.board.gestion;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("tiendas")
public class Tienda {

    @Id
    private Long id;
    private String codigo;
    private String nombre;
    private String distrito;
    private String direccion;
    private BigDecimal latitud;
    private BigDecimal longitud;
    private String horario;
    private String enfoque;
}
