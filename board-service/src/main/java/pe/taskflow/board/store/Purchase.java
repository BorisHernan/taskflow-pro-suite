package pe.taskflow.board.store;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Una línea de compra del historial (no se borra nunca). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("purchases")
public class Purchase {

    @Id
    private Long id;

    private Long productId;

    private String productName;

    private String category;

    private Integer quantity;

    private BigDecimal total;

    private Long tiendaId;

    private Long turnoId;

    private LocalDateTime createdAt;
}
