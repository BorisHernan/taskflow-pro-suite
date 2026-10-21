package pe.taskflow.board.gestion;

import lombok.RequiredArgsConstructor;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import pe.taskflow.board.config.TaskEventPublisher;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import pe.taskflow.board.repository.TaskRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Las tareas que el sistema crea, mueve o cierra solo: alertas de stock,
 * incidencias graves y el checklist de cada turno. Cada cambio se publica
 * por SSE, así el tablero de la tienda se actualiza sin recargar.
 */
@Service
@RequiredArgsConstructor
public class TareasAutomaticas {

    public static final String SISTEMA = "sistema";

    static final Map<String, List<String>> CHECKLIST_POR_TURNO = Map.of(
            Turno.MANANA, List.of("Arqueo de caja inicial", "Revisar precios y etiquetas de la vitrina",
                    "Revisar las alertas de stock del día", "Ordenar y limpiar el piso de venta"),
            Turno.TARDE, List.of("Recibir y guardar la mercadería", "Reponer las góndolas",
                    "Revisar las alertas de stock"),
            Turno.NOCHE, List.of("Registrar las mermas del día", "Arqueo y cierre de caja",
                    "Apagar equipos y activar la alarma"));

    private final DatabaseClient db;
    private final R2dbcEntityTemplate template;
    private final TaskRepository taskRepository;
    private final TaskEventPublisher eventos;

    /** Crea la alerta de reposición, o actualiza la que ya está abierta (nunca hay dos). */
    public Mono<Task> alertaDeStock(Inventario inv, String producto) {
        String prioridad = inv.getStock() == 0 ? "CRITICA" : "ALTA";
        String estado = inv.getStock() == 0 ? "Agotado"
                : inv.getStock() == 1 ? "Queda 1 unidad" : "Quedan " + inv.getStock() + " unidades";
        String detalle = estado + " (mínimo " + inv.getStockMinimo() + "). Sugerido: pedir "
                + Math.max(1, inv.getStockObjetivo() - inv.getStock()) + ".";
        return db.sql("""
                        INSERT INTO tasks (title, description, status, position, tienda_id, tipo, prioridad, producto_id,
                                           creado_por, created_at, updated_at)
                        VALUES (:titulo, :detalle, 'TODO',
                                (SELECT COALESCE(MIN(position), 1) - 1 FROM tasks WHERE tienda_id = :tienda AND status = 'TODO'),
                                :tienda, 'REPOSICION', :prioridad, :producto, 'sistema', now(), now())
                        ON CONFLICT (tienda_id, producto_id) WHERE tipo = 'REPOSICION' AND status <> 'DONE'
                        DO UPDATE SET description = EXCLUDED.description, prioridad = EXCLUDED.prioridad, updated_at = now()
                        RETURNING *, (xmax = 0) AS insertada""")
                .bind("titulo", "Reponer " + producto)
                .bind("detalle", detalle)
                .bind("tienda", inv.getTiendaId())
                .bind("prioridad", prioridad)
                .bind("producto", inv.getProductoId())
                .map((row, meta) -> {
                    Task tarea = template.getConverter().read(Task.class, row, meta);
                    eventos.publish(Boolean.TRUE.equals(row.get("insertada", Boolean.class))
                            ? TaskEventType.CREATED : TaskEventType.UPDATED, tarea);
                    return tarea;
                })
                .one();
    }

    /** Cierra la alerta abierta de ese producto, si la hay. */
    public Mono<Task> cerrarAlerta(long tiendaId, long productoId, String motivo) {
        return db.sql("""
                        UPDATE tasks SET status = 'DONE', cerrada_en = now(), updated_at = now(),
                               description = COALESCE(description, '') || ' ' || :motivo,
                               position = (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE tienda_id = :tienda AND status = 'DONE')
                        WHERE tipo = 'REPOSICION' AND tienda_id = :tienda AND producto_id = :producto AND status <> 'DONE'
                        RETURNING *""")
                .bind("motivo", motivo)
                .bind("tienda", tiendaId)
                .bind("producto", productoId)
                .map((row, meta) -> template.getConverter().read(Task.class, row, meta))
                .one()
                .doOnNext(t -> eventos.publish(TaskEventType.UPDATED, t));
    }

    /** Mueve una tarea a otra columna (al final) y lo avisa. */
    public Mono<Task> mover(Long tareaId, String status, String nota) {
        if (tareaId == null) {
            return Mono.empty();
        }
        return db.sql("""
                        UPDATE tasks SET status = :status, updated_at = now(),
                               cerrada_en = CASE WHEN :status = 'DONE' THEN now() END,
                               description = CASE WHEN :nota = '' THEN description ELSE COALESCE(description, '') || ' ' || :nota END,
                               position = (SELECT COALESCE(MAX(t.position), 0) + 1 FROM tasks t
                                           WHERE t.tienda_id = tasks.tienda_id AND t.status = :status)
                        WHERE id = :id AND status <> :status
                        RETURNING *""")
                .bind("status", status)
                .bind("nota", nota == null ? "" : nota)
                .bind("id", tareaId)
                .map((row, meta) -> template.getConverter().read(Task.class, row, meta))
                .one()
                .doOnNext(t -> eventos.publish(TaskEventType.UPDATED, t));
    }

    public Mono<Task> crear(Task tarea) {
        LocalDateTime ahora = LocalDateTime.now();
        tarea.setId(null);
        tarea.setStatus(tarea.getStatus() == null ? "TODO" : tarea.getStatus());
        tarea.setCreatedAt(ahora);
        tarea.setUpdatedAt(ahora);
        tarea.setCreadoPor(tarea.getCreadoPor() == null ? SISTEMA : tarea.getCreadoPor());
        Mono<Integer> posicion = tarea.getPosition() != null ? Mono.just(tarea.getPosition())
                : db.sql("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM tasks WHERE tienda_id = :tienda AND status = :status")
                        .bind("tienda", tarea.getTiendaId())
                        .bind("status", tarea.getStatus())
                        .map((row, meta) -> row.get("p", Integer.class))
                        .one();
        return posicion.flatMap(p -> {
            tarea.setPosition(p);
            return taskRepository.save(tarea);
        }).doOnNext(t -> eventos.publish(TaskEventType.CREATED, t));
    }

    /** Checklist del turno: una tarea por cada paso de la rutina. */
    public Flux<Task> checklistDeTurno(Turno turno) {
        return Flux.fromIterable(CHECKLIST_POR_TURNO.getOrDefault(turno.getTipo(), List.of()))
                .concatMap(paso -> crear(Task.builder()
                        .title(paso)
                        .description("Checklist del turno " + Turno.nombreDe(turno.getTipo()) + " · " + turno.getResponsable())
                        .tiendaId(turno.getTiendaId())
                        .tipo("TURNO")
                        .prioridad("MEDIA")
                        .turnoId(turno.getId())
                        .asignadoA(turno.getResponsable())
                        .creadoPor(turno.getAbiertoPor())
                        .build()));
    }
}
