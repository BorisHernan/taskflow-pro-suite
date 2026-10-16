package pe.taskflow.board.store;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
@Table("product_reviews")
public class ProductReview {

    @Id
    private Long id;

    private Long productId;

    private String author;

    private Integer rating;

    private String comment;

    private LocalDateTime createdAt;

    @JsonIgnore
    private String createdByIp;

    // Reseñas de ejemplo de la migración (no escritas por visitantes).
    @JsonIgnore
    private boolean seed;
}
