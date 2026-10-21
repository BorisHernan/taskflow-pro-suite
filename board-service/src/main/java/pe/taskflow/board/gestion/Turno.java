package pe.taskflow.board.gestion;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("turnos")
public class Turno {

    public static final String MANANA = "MANANA";
    public static final String TARDE = "TARDE";
    public static final String NOCHE = "NOCHE";
    public static final String ABIERTO = "ABIERTO";
    public static final String CERRADO = "CERRADO";

    private static final Map<String, String> NOMBRES = Map.of(MANANA, "mañana", TARDE, "tarde", NOCHE, "noche");

    @Id
    private Long id;
    private Long tiendaId;
    private String tipo;
    private String responsable;
    private String estado;
    private String notaApertura;
    private String notaCierre;
    private String abiertoPor;
    private String cerradoPor;
    private LocalDateTime inicio;
    private LocalDateTime fin;

    public static String nombreDe(String tipo) {
        return NOMBRES.getOrDefault(tipo, tipo);
    }
}
