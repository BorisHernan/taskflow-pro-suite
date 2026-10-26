package pe.taskflow.board.gestion;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDate;
import java.time.LocalTime;

/** Persona de la plantilla de una sede. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("empleados")
public class Empleado {

    public static final String REPONEDOR = "REPONEDOR";
    public static final String ALMACENERO = "ALMACENERO";
    public static final String ACTIVO = "ACTIVO";

    @Id
    private Long id;
    private Long tiendaId;
    private String nombre;
    private String puesto;
    private String turno;
    private String disponibilidad;
    private String motivo;
    private LocalDate ausenteDesde;
    private LocalDate ausenteHasta;
    /** Dónde está dentro de la tienda: CAJA_1…CAJA_5, ENTRADA, PASILLOS, ALMACEN o DESPACHO. */
    private String puestoActual;
    private java.time.LocalDateTime puestoDesde;
    /** Día libre de la semana (1 = lunes … 7 = domingo). */
    private Integer diaLibre;

    /** Horario de cada turno (el de noche cruza la medianoche). */
    public LocalTime inicioTurno() {
        return switch (turno) {
            case "MANANA" -> LocalTime.of(7, 0);
            case "TARDE" -> LocalTime.of(15, 0);
            default -> LocalTime.of(23, 0);
        };
    }

    public LocalTime finTurno() {
        return inicioTurno().plusHours(8);
    }

    public boolean enTurno(LocalTime ahora) {
        LocalTime ini = inicioTurno();
        LocalTime fin = finTurno();
        return ini.isBefore(fin) ? !ahora.isBefore(ini) && ahora.isBefore(fin) : !ahora.isBefore(ini) || ahora.isBefore(fin);
    }

    /** Porcentaje del turno ya trabajado (0 si está fuera de turno). */
    public int avanceTurno(LocalTime ahora) {
        if (!enTurno(ahora)) {
            return 0;
        }
        int desde = ahora.toSecondOfDay() - inicioTurno().toSecondOfDay();
        if (desde < 0) {
            desde += 24 * 3600;
        }
        return Math.min(100, desde * 100 / (8 * 3600));
    }

    public boolean libreHoy(LocalDate hoy) {
        return diaLibre != null && diaLibre == hoy.getDayOfWeek().getValue();
    }

    /** Una ausencia con fecha de retorno vencida ya no cuenta. */
    public boolean ausente(LocalDate hoy) {
        return !ACTIVO.equals(disponibilidad) && (ausenteHasta == null || !ausenteHasta.isBefore(hoy));
    }
}
