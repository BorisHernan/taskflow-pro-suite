package pe.taskflow.board.ventas;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Pedido de un cliente de la tienda online, con su entrega y su estado. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("ordenes")
public class Orden {

    public static final String RECOJO = "RECOJO";
    public static final String ENVIO = "ENVIO";

    public static final String RECIBIDA = "RECIBIDA";
    public static final String PREPARANDO = "PREPARANDO";
    public static final String LISTA = "LISTA";
    public static final String EN_CAMINO = "EN_CAMINO";
    public static final String ENTREGADA = "ENTREGADA";

    @Id
    private Long id;
    private String codigo;
    private Long tiendaId;
    private String clienteNombre;
    private String modalidad;
    private String direccion;
    private BigDecimal latitud;
    private BigDecimal longitud;
    private BigDecimal distanciaKm;
    private BigDecimal subtotal;
    private BigDecimal descuento;
    private BigDecimal total;
    private String cupon;
    private String estado;
    private Long tareaId;
    private LocalDateTime creadaEn;
    private LocalDateTime actualizadaEn;
}
