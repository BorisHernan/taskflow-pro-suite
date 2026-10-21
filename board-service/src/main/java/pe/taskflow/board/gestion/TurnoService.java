package pe.taskflow.board.gestion;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import pe.taskflow.board.auth.UsuarioActual;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Turnos de trabajo: al abrir uno se genera su checklist en el tablero; ventas,
 * mermas e incidencias que ocurren mientras está abierto quedan asociadas a él,
 * y al cerrarlo se arma el resumen.
 */
@Service
@RequiredArgsConstructor
public class TurnoService {

    private final TurnoRepository turnoRepository;
    private final TareasAutomaticas tareas;
    private final DatabaseClient db;
    private final FiltroDeTexto filtro;

    public record Resumen(Turno turno, long ventas, long unidades, BigDecimal ingresos, long mermas, BigDecimal costoMermas,
                          long incidencias, long tareas, long tareasHechas, List<String> pendientes) {
    }

    public Mono<Turno> abrir(UsuarioActual u, Solicitudes.AbrirTurno req) {
        long tienda = u.tiendaParaRegistrar(req.tiendaId());
        filtro.revisar(req.responsable(), req.nota());
        Turno nuevo = Turno.builder()
                .tiendaId(tienda)
                .tipo(req.tipo())
                .responsable(req.responsable().trim())
                .estado(Turno.ABIERTO)
                .notaApertura(req.nota())
                .abiertoPor(u.usuario())
                .inicio(LocalDateTime.now())
                .build();
        return turnoRepository.save(nuevo)
                .onErrorMap(DataIntegrityViolationException.class,
                        e -> Errores.conflicto("Ya hay un turno abierto en esta tienda. Ciérralo antes de abrir otro."))
                .flatMap(t -> tareas.checklistDeTurno(t).then(Mono.just(t)));
    }

    public Mono<Resumen> cerrar(UsuarioActual u, long id, Solicitudes.CerrarTurno req) {
        filtro.revisar(req.nota());
        return turnoRepository.findById(id)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Turno no encontrado")))
                .doOnNext(t -> u.exigirAcceso(t.getTiendaId()))
                .filter(t -> Turno.ABIERTO.equals(t.getEstado()))
                .switchIfEmpty(Mono.error(Errores.conflicto("El turno ya estaba cerrado.")))
                .flatMap(t -> {
                    t.setEstado(Turno.CERRADO);
                    t.setNotaCierre(req.nota());
                    t.setCerradoPor(u.usuario());
                    t.setFin(LocalDateTime.now());
                    return turnoRepository.save(t);
                })
                .flatMap(this::resumen);
    }

    public Mono<Turno> actual(UsuarioActual u, Long tiendaPedida) {
        Long tienda = u.tiendaVisible(tiendaPedida);
        return tienda == null ? Mono.empty() : turnoRepository.findFirstByTiendaIdAndEstado(tienda, Turno.ABIERTO);
    }

    public Flux<Turno> historial(UsuarioActual u, Long tiendaPedida) {
        Long tienda = u.tiendaVisible(tiendaPedida);
        return tienda == null ? turnoRepository.findTop30ByOrderByInicioDesc() : turnoRepository.findTop30ByTiendaIdOrderByInicioDesc(tienda);
    }

    public Mono<Resumen> resumen(UsuarioActual u, long id) {
        return turnoRepository.findById(id)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Turno no encontrado")))
                .doOnNext(t -> u.exigirAcceso(t.getTiendaId()))
                .flatMap(this::resumen);
    }

    /** Id del turno abierto de la tienda (vacío si no hay ninguno). */
    public Mono<Long> idAbierto(long tiendaId) {
        return turnoRepository.findFirstByTiendaIdAndEstado(tiendaId, Turno.ABIERTO).map(Turno::getId);
    }

    private Mono<Resumen> resumen(Turno t) {
        Mono<List<String>> pendientes = db.sql("SELECT title FROM tasks WHERE turno_id = :id AND status <> 'DONE' ORDER BY position")
                .bind("id", t.getId())
                .map((row, meta) -> row.get("title", String.class))
                .all()
                .collectList();
        return pendientes.flatMap(lista -> db.sql("""
                        SELECT (SELECT COUNT(*) FROM purchases WHERE turno_id = :id) AS ventas,
                               (SELECT COALESCE(SUM(quantity), 0) FROM purchases WHERE turno_id = :id) AS unidades,
                               (SELECT COALESCE(SUM(total), 0) FROM purchases WHERE turno_id = :id) AS ingresos,
                               (SELECT COUNT(*) FROM mermas WHERE turno_id = :id) AS mermas,
                               (SELECT COALESCE(SUM(costo), 0) FROM mermas WHERE turno_id = :id) AS costo_mermas,
                               (SELECT COUNT(*) FROM incidencias WHERE turno_id = :id) AS incidencias,
                               (SELECT COUNT(*) FROM tasks WHERE turno_id = :id) AS tareas,
                               (SELECT COUNT(*) FROM tasks WHERE turno_id = :id AND status = 'DONE') AS tareas_hechas""")
                .bind("id", t.getId())
                .map((row, meta) -> new Resumen(t,
                        row.get("ventas", Long.class), numero(row.get("unidades", Number.class)), row.get("ingresos", BigDecimal.class),
                        row.get("mermas", Long.class), row.get("costo_mermas", BigDecimal.class),
                        row.get("incidencias", Long.class), row.get("tareas", Long.class), row.get("tareas_hechas", Long.class),
                        lista))
                .one());
    }

    private static long numero(Number n) {
        return n == null ? 0 : n.longValue();
    }
}
