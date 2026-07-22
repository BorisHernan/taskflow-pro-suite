package pe.taskflow.board.store;

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
@Table("products")
public class Product {

    @Id
    private Long id;

    private String name;

    private String description;

    private BigDecimal price;

    private Integer stock;

    // Clave de ícono (no un emoji): el frontend la mapea a un SVG propio.
    private String icon;
}
