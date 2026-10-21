package pe.taskflow.board.gestion;

import lombok.RequiredArgsConstructor;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import pe.taskflow.board.auth.UsuarioActual;
import pe.taskflow.board.model.Task;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Incidencias de tienda. Las de severidad ALTA o CRITICA abren una tarea en el
 * tablero; resolver la incidencia cierra la tarea y cerrar la tarea resuelve
 * la incidencia.
 */
@Service
@RequiredArgsConstructor
public class IncidenciaService {

    private final IncidenciaRepository repository;
    private final TareasAutomaticas tareas;
    private final TurnoService turnos;
    private final FiltroDeTexto filtro;
    private final DatabaseClient db;
    private final R2dbcEntityTemplate template;

    public Mono<Incidencia> crear(UsuarioActual u, Solicitudes.NuevaIncidencia req) {
        long tienda = u.tiendaParaRegistrar(req.tiendaId());
        filtro.revisar(req.titulo(), req.descripcion());
        return registrar(tienda, req.titulo().trim(), req.descripcion(), req.categoria(), req.severidad(), u.usuario());
    }

    /** También la usan otros módulos (p. ej. una merma por robo). */
    public Mono<Incidencia> registrar(long tienda, String titulo, String descripcion, String categoria, String severidad,
                                      String usuario) {
        return turnos.idAbierto(tienda)
                .map(Optional::of)
                .defaultIfEmpty(Optional.empty())
                .flatMap(turno -> repository.save(Incidencia.builder()
                        .tiendaId(tienda)
                        .titulo(titulo)
                        .descripcion(descripcion)
                        .categoria(categoria)
                        .severidad(severidad)
                        .estado(Incidencia.ABIERTA)
                        .turnoId(turno.orElse(null))
                        .reportadaPor(usuario)
                        .creadaEn(LocalDateTime.now())
                        .build()))
                .flatMap(inc -> inc.grave() ? conTarea(inc) : Mono.just(inc));
    }

    private Mono<Incidencia> conTarea(Incidencia inc) {
        return tareas.crear(Task.builder()
                        .title("Atender: " + inc.getTitulo())
                        .description("Incidencia #" + inc.getId() + " · " + inc.getCategoria().toLowerCase()
                                + (inc.getDescripcion() == null ? "" : " · " + inc.getDescripcion()))
                        .tiendaId(inc.getTiendaId())
                        .tipo("INCIDENCIA")
                        .prioridad(inc.getSeveridad())
                        .referenciaId(inc.getId())
                        .turnoId(inc.getTurnoId())
                        .creadoPor(inc.getReportadaPor())
                        .build())
                .flatMap(t -> {
                    inc.setTareaId(t.getId());
                    return repository.save(inc);
                });
    }

    public Mono<Incidencia> cambiarEstado(UsuarioActual u, long id, Solicitudes.CambioIncidencia req) {
        filtro.revisar(req.solucion());
        return repository.findById(id)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Incidencia no encontrada")))
                .doOnNext(inc -> u.exigirAcceso(inc.getTiendaId()))
                .flatMap(inc -> {
                    inc.setEstado(req.estado());
                    if (Incidencia.RESUELTA.equals(req.estado())) {
                        inc.setResueltaEn(LocalDateTime.now());
                        inc.setSolucion(req.solucion() == null || req.solucion().isBlank() ? "Resuelta." : req.solucion().trim());
                    } else {
                        inc.setResueltaEn(null);
                    }
                    return repository.save(inc);
                })
                .flatMap(inc -> tareas.mover(inc.getTareaId(), columnaDe(inc.getEstado()), null).thenReturn(inc));
    }

    /** Cuando la tarea enlazada llega a "Hecho" desde el tablero. */
    public Mono<Void> alCerrarTarea(Task t) {
        if (!"INCIDENCIA".equals(t.getTipo()) || t.getReferenciaId() == null || !"DONE".equals(t.getStatus())) {
            return Mono.empty();
        }
        return db.sql("""
                        UPDATE incidencias SET estado = 'RESUELTA', resuelta_en = now(),
                               solucion = COALESCE(solucion, 'Cerrada desde el tablero.')
                        WHERE id = :id AND estado <> 'RESUELTA'""")
                .bind("id", t.getReferenciaId())
                .then();
    }

    public Flux<Incidencia> listar(UsuarioActual u, Long tiendaPedida) {
        Long tienda = u.tiendaVisible(tiendaPedida);
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                SELECT * FROM incidencias WHERE tienda_id = COALESCE(:tienda, tienda_id)
                ORDER BY CASE estado WHEN 'RESUELTA' THEN 1 ELSE 0 END,
                         CASE severidad WHEN 'CRITICA' THEN 0 WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
                         creada_en DESC
                LIMIT 200""");
        return Sql.bindOrNull(consulta, "tienda", tienda, Long.class)
                .map((row, meta) -> template.getConverter().read(Incidencia.class, row, meta))
                .all();
    }

    static String columnaDe(String estado) {
        return switch (estado) {
            case Incidencia.RESUELTA -> "DONE";
            case Incidencia.EN_CURSO -> "IN_PROGRESS";
            default -> "TODO";
        };
    }
}
