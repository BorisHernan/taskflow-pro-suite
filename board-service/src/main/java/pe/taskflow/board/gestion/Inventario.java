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
@Table("inventario")
public class Inventario {

    @Id
    private Long id;
    private Long tiendaId;
    private Long productoId;
    private Integer stock;
    private Integer stockMinimo;
    private Integer stockObjetivo;
    private LocalDateTime actualizadoEn;

    public boolean bajoMinimo() {
        return stock <= stockMinimo;
    }
}
