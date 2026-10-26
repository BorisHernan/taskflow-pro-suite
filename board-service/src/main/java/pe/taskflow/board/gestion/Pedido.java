package pe.taskflow.board.gestion;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Compra de una tienda al almacén central (reposición). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("pedidos")
public class Pedido {

    public static final String SOLICITADO = "SOLICITADO";
    public static final String APROBADO = "APROBADO";
    public static final String RECIBIDO = "RECIBIDO";
    public static final String RECHAZADO = "RECHAZADO";

    @Id
    private Long id;
    private Long tiendaId;
    private Long productoId;
    private String productoNombre;
    private Integer cantidad;
    private BigDecimal costo;
    private String estado;
    private String nota;
    private Long tareaId;
    private String solicitadoPor;
    private Long solicitadoPorEmpleado;
    private String revisadoPor;
    private LocalDateTime creadoEn;
    private LocalDateTime actualizadoEn;
}
