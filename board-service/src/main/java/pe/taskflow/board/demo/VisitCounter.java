package pe.taskflow.board.demo;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

/** Fila única (id=1) con el total histórico de visitas, persistido en Postgres. */
@Data
@Table("visit_counter")
public class VisitCounter {

    @Id
    private Integer id;

    private Long totalVisits;

    private LocalDateTime lastVisitAt;
}
