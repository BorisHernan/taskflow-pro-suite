package pe.taskflow.board.gestion;

import lombok.RequiredArgsConstructor;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import pe.taskflow.board.auth.UsuarioActual;
import pe.taskflow.board.config.TaskEventPublisher;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import pe.taskflow.board.repository.TaskRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * Plantilla de cada sede y asignación de tareas. Cada tarea asignada tiene un tiempo
 * estimado; al cumplirse, la persona "la termina" sola (en la demo no hay empleados reales).
 */
@Service
@RequiredArgsConstructor
public class PersonalService {

    static final ZoneId LIMA = ZoneId.of("America/Lima");
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");
    /** Tipos que la persona cierra sola al cumplir su tiempo; los demás los confirma el encargado. */
    private static final Set<String> SE_CIERRAN_SOLAS = Set.of("REPOSICION", "MANUAL", "TURNO");
    private static final Map<String, Integer> MINUTOS_POR_TIPO = Map.of("PEDIDO", 8, "INCIDENCIA", 10, "TURNO", 4, "MANUAL", 5);

    private final EmpleadoRepository empleados;
    private final TaskRepository tareasRepo;
    private final TareasAutomaticas tareas;
    private final InventarioService inventario;
    private final TaskEventPublisher eventos;
    private final FiltroDeTexto filtro;
    private final DatabaseClient db;
    private final R2dbcEntityTemplate template;

    public record EmpleadoVista(
            long id, long tiendaId, String nombre, String puesto, String turno, String horario,
            /** TRABAJANDO, DISPONIBLE, FUERA_DE_TURNO, LIBRE_HOY o AUSENTE. */
            String estado, String disponibilidad, String motivo, LocalDate ausenteDesde, LocalDate ausenteHasta,
            int avanceTurno, Long tareaId, String tareaTitulo, LocalDateTime tareaAsignadaEn, Integer tareaMinutos,
            /** Puesto dentro de la tienda (solo si está trabajando ahora). */
            String puestoActual, LocalDateTime puestoDesde, Integer diaLibre) {
    }

    public record Aviso(long id, Long empleadoId, String empleado, String mensaje, LocalDateTime creadoEn) {
    }

    static final java.util.Map<String, String> NOMBRE_PUESTO_TIENDA = java.util.Map.of(
            "CAJA_1", "la caja 1", "CAJA_2", "la caja 2", "CAJA_3", "la caja 3", "CAJA_4", "la caja 4", "CAJA_5", "la caja 5",
            "ENTRADA", "la entrada (seguridad)", "PASILLOS", "los pasillos (reposición)", "ALMACEN", "el almacén",
            "DESPACHO", "despacho de pedidos online");

    private record Ocupacion(long tareaId, long empleadoId, String titulo, LocalDateTime asignadaEn, Integer minutos) {
    }

    public Flux<EmpleadoVista> listar(UsuarioActual u, Long tiendaPedida) {
        Long tienda = u.tiendaVisible(tiendaPedida);
        Mono<Map<Long, Ocupacion>> ocupados = db.sql("""
                        SELECT id, empleado_id, title, asignada_en, minutos_estimados FROM tasks
                        WHERE status = 'IN_PROGRESS' AND empleado_id IS NOT NULL""")
                .map((row, meta) -> new Ocupacion(row.get("id", Long.class), row.get("empleado_id", Long.class),
                        row.get("title", String.class), row.get("asignada_en", LocalDateTime.class),
                        row.get("minutos_estimados", Integer.class)))
                .all()
                .collectMap(Ocupacion::empleadoId, Function.identity(), java.util.HashMap::new);
        LocalTime ahora = LocalTime.now(LIMA);
        LocalDate hoy = LocalDate.now(LIMA);
        return ocupados.flatMapMany(oc -> empleados.findAll()
                .filter(e -> tienda == null || tienda.equals(e.getTiendaId()))
                .map(e -> vista(e, oc.get(e.getId()), ahora, hoy))
                .sort(java.util.Comparator.comparing(EmpleadoVista::tiendaId).thenComparing(v -> ordenEstado(v.estado()))
                        .thenComparing(EmpleadoVista::puesto).thenComparing(EmpleadoVista::nombre)));
    }

    private static EmpleadoVista vista(Empleado e, Ocupacion o, LocalTime ahora, LocalDate hoy) {
        String estado = e.ausente(hoy) ? "AUSENTE" : e.libreHoy(hoy) ? "LIBRE_HOY" : o != null ? "TRABAJANDO"
                : e.enTurno(ahora) ? "DISPONIBLE" : "FUERA_DE_TURNO";
        boolean ausente = "AUSENTE".equals(estado);
        boolean presente = "TRABAJANDO".equals(estado) || "DISPONIBLE".equals(estado);
        return new EmpleadoVista(e.getId(), e.getTiendaId(), e.getNombre(), e.getPuesto(), e.getTurno(),
                e.inicioTurno().format(HORA) + "–" + e.finTurno().format(HORA), estado,
                ausente ? e.getDisponibilidad() : Empleado.ACTIVO, ausente ? e.getMotivo() : null,
                ausente ? e.getAusenteDesde() : null, ausente ? e.getAusenteHasta() : null,
                e.avanceTurno(ahora), o == null ? null : o.tareaId(), o == null ? null : o.titulo(),
                o == null ? null : o.asignadaEn(), o == null ? null : o.minutos(),
                presente ? e.getPuestoActual() : null, presente ? e.getPuestoDesde() : null, e.getDiaLibre());
    }

    private static int ordenEstado(String estado) {
        return switch (estado) {
            case "TRABAJANDO" -> 0;
            case "DISPONIBLE" -> 1;
            case "FUERA_DE_TURNO" -> 2;
            case "LIBRE_HOY" -> 3;
            default -> 4;
        };
    }

    /** Asigna la tarea a una persona disponible y la pasa a "En progreso". */
    public Mono<Task> asignar(UsuarioActual u, long tareaId, long empleadoId, boolean rapido) {
        return tareasRepo.findById(tareaId)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Tarea no encontrada")))
                .doOnNext(t -> u.exigirAcceso(t.getTiendaId()))
                .flatMap(t -> {
                    if ("DONE".equals(t.getStatus())) {
                        return Mono.error(Errores.conflicto("La tarea #" + t.getId() + " ya está hecha."));
                    }
                    return empleados.findById(empleadoId)
                            .switchIfEmpty(Mono.error(Errores.noEncontrado("Persona no encontrada")))
                            .flatMap(e -> validar(t, e).then(minutosPara(t)).flatMap(min -> guardarAsignacion(t, e, rapido ? 1 : min)));
                });
    }

    private Mono<Void> validar(Task t, Empleado e) {
        if (!e.getTiendaId().equals(t.getTiendaId())) {
            return Mono.error(Errores.invalido(e.getNombre() + " trabaja en otra sede."));
        }
        String falta = motivoNoPresente(e);
        if (falta != null) {
            return Mono.error(Errores.conflicto(falta));
        }
        if ("REPOSICION".equals(t.getTipo()) && !Empleado.REPONEDOR.equals(e.getPuesto()) && !Empleado.ALMACENERO.equals(e.getPuesto())) {
            return Mono.error(Errores.invalido("La reposición la hace un reponedor o el almacenero."));
        }
        return db.sql("SELECT id FROM tasks WHERE empleado_id = :e AND status = 'IN_PROGRESS' AND id <> :t LIMIT 1")
                .bind("e", e.getId())
                .bind("t", t.getId())
                .map((row, meta) -> row.get("id", Long.class))
                .one()
                .flatMap(otra -> Mono.<Void>error(Errores.conflicto(e.getNombre() + " está ocupado con la tarea #" + otra + ".")));
    }

    /** Por qué la persona no puede recibir trabajo ahora, o null si está en la tienda. */
    private static String motivoNoPresente(Empleado e) {
        LocalDate hoy = LocalDate.now(LIMA);
        if (e.ausente(hoy)) {
            return e.getNombre() + " no está disponible: " + e.getMotivo() + ".";
        }
        if (e.libreHoy(hoy)) {
            return "Hoy es el día libre de " + e.getNombre() + ".";
        }
        if (!e.enTurno(LocalTime.now(LIMA))) {
            return e.getNombre() + " está fuera de turno (" + e.inicioTurno().format(HORA) + "–" + e.finTurno().format(HORA) + ").";
        }
        return null;
    }

    /** Mueve a la persona a un puesto de la tienda (o la deja sin puesto) y se lo avisa. */
    public Mono<EmpleadoVista> moverAPuesto(UsuarioActual u, long id, String puesto) {
        return empleados.findById(id)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Persona no encontrada")))
                .doOnNext(e -> u.exigirAcceso(e.getTiendaId()))
                .flatMap(e -> {
                    String falta = motivoNoPresente(e);
                    if (falta != null) {
                        return Mono.error(Errores.conflicto(falta));
                    }
                    e.setPuestoActual(puesto);
                    e.setPuestoDesde(puesto == null ? null : LocalDateTime.now());
                    return empleados.save(e);
                })
                .flatMap(e -> avisar(e, puesto == null
                        ? e.getNombre() + ": quedas sin puesto fijo, atento a nuevas órdenes."
                        : e.getNombre() + ": ve a " + NOMBRE_PUESTO_TIENDA.get(puesto) + ".").thenReturn(e))
                .flatMap(e -> listar(u, e.getTiendaId()).filter(v -> v.id() == e.getId()).next());
    }

    public Flux<Aviso> avisos(UsuarioActual u, Long tiendaPedida) {
        DatabaseClient.GenericExecuteSpec consulta = db.sql("""
                SELECT a.id, a.empleado_id, e.nombre, a.mensaje, a.creado_en FROM avisos_personal a
                LEFT JOIN empleados e ON e.id = a.empleado_id
                WHERE a.tienda_id = COALESCE(:tienda, a.tienda_id) ORDER BY a.creado_en DESC, a.id DESC LIMIT 30""");
        return Sql.bindOrNull(consulta, "tienda", u.tiendaVisible(tiendaPedida), Long.class)
                .map((row, meta) -> new Aviso(row.get("id", Long.class), row.get("empleado_id", Long.class),
                        row.get("nombre", String.class), row.get("mensaje", String.class), row.get("creado_en", LocalDateTime.class)))
                .all();
    }

    Mono<Void> avisar(Empleado e, String mensaje) {
        return db.sql("INSERT INTO avisos_personal (tienda_id, empleado_id, mensaje, creado_en) VALUES (:t, :e, :m, :ahora)")
                .bind("t", e.getTiendaId())
                .bind("e", e.getId())
                .bind("m", mensaje.length() > 240 ? mensaje.substring(0, 240) : mensaje)
                .bind("ahora", LocalDateTime.now())
                .then();
    }

    /** Tiempo estimado; la reposición depende de cuántas unidades hay que mover desde el almacén. */
    private Mono<Integer> minutosPara(Task t) {
        if (!"REPOSICION".equals(t.getTipo()) || t.getProductoId() == null) {
            return Mono.just(MINUTOS_POR_TIPO.getOrDefault(t.getTipo(), 5));
        }
        return db.sql("""
                        SELECT almacen, LEAST(almacen, GREATEST(stock_objetivo - stock, 1)) AS q
                        FROM inventario WHERE tienda_id = :tienda AND producto_id = :producto""")
                .bind("tienda", t.getTiendaId())
                .bind("producto", t.getProductoId())
                .map((row, meta) -> row.get("q", Integer.class))
                .one()
                .defaultIfEmpty(0)
                .flatMap(q -> q <= 0
                        ? Mono.error(Errores.conflicto("No hay unidades en el almacén. Pide la compra al distribuidor."))
                        : Mono.just(3 + Math.min(5, q / 10)));
    }

    private Mono<Task> guardarAsignacion(Task t, Empleado e, int minutos) {
        LocalDateTime ahora = LocalDateTime.now();
        return db.sql("""
                        UPDATE tasks SET status = 'IN_PROGRESS', empleado_id = :empleado, asignado_a = :nombre,
                               asignada_en = :ahora, minutos_estimados = :minutos, updated_at = :ahora, cerrada_en = NULL,
                               position = CASE WHEN status = 'IN_PROGRESS' THEN position
                                   ELSE (SELECT COALESCE(MAX(x.position), 0) + 1 FROM tasks x
                                         WHERE x.tienda_id = tasks.tienda_id AND x.status = 'IN_PROGRESS') END
                        WHERE id = :id RETURNING *""")
                .bind("empleado", e.getId())
                .bind("nombre", e.getNombre())
                .bind("ahora", ahora)
                .bind("minutos", minutos)
                .bind("id", t.getId())
                .map((row, meta) -> template.getConverter().read(Task.class, row, meta))
                .one()
                // Un pedido online asignado pasa a "Preparando" para el cliente.
                .flatMap(guardada -> db.sql("UPDATE ordenes SET estado = 'PREPARANDO', actualizada_en = now() WHERE tarea_id = :id AND estado = 'RECIBIDA'")
                        .bind("id", guardada.getId())
                        .then()
                        .thenReturn(guardada))
                .flatMap(guardada -> avisar(e, e.getNombre() + ": tienes la orden #" + guardada.getId() + " · " + guardada.getTitle()
                        + " (unos " + minutos + " min).").thenReturn(guardada))
                .doOnNext(guardada -> eventos.publish(TaskEventType.UPDATED, guardada));
    }

    /** Cierra las tareas cuyo tiempo ya se cumplió. La reposición mueve stock del almacén al piso. */
    public Flux<Task> completarVencidas() {
        return db.sql("""
                        SELECT t.*, e.nombre AS empleado_nombre FROM tasks t JOIN empleados e ON e.id = t.empleado_id
                        WHERE t.status = 'IN_PROGRESS' AND t.asignada_en IS NOT NULL
                        AND t.asignada_en + t.minutos_estimados * INTERVAL '1 minute' <= :ahora""")
                .bind("ahora", LocalDateTime.now())
                .map((row, meta) -> Map.entry(template.getConverter().read(Task.class, row, meta), row.get("empleado_nombre", String.class)))
                .all()
                .filter(par -> SE_CIERRAN_SOLAS.contains(par.getKey().getTipo()))
                .concatMap(par -> "REPOSICION".equals(par.getKey().getTipo())
                        ? completarReposicion(par.getKey(), par.getValue())
                        : tareas.mover(par.getKey().getId(), "DONE", "Hecho por " + par.getValue() + "."));
    }

    private Mono<Task> completarReposicion(Task t, String quien) {
        return db.sql("""
                        UPDATE inventario i SET almacen = i.almacen - x.q
                        FROM (SELECT id, LEAST(almacen, GREATEST(stock_objetivo - stock, 0)) AS q FROM inventario
                              WHERE tienda_id = :tienda AND producto_id = :producto) x
                        WHERE i.id = x.id RETURNING x.q""")
                .bind("tienda", t.getTiendaId())
                .bind("producto", t.getProductoId())
                .map((row, meta) -> row.get("q", Integer.class))
                .one()
                .defaultIfEmpty(0)
                .flatMap(q -> (q > 0 ? inventario.sumar(t.getTiendaId(), t.getProductoId(), q).then() : Mono.<Void>empty())
                        .then(db.sql("""
                                        UPDATE tasks SET description = COALESCE(description, '') || ' ' || :nota,
                                               status = CASE WHEN status = 'DONE' THEN 'DONE' ELSE 'TODO' END,
                                               empleado_id = CASE WHEN status = 'DONE' THEN empleado_id END,
                                               asignada_en = CASE WHEN status = 'DONE' THEN asignada_en END,
                                               updated_at = now()
                                        WHERE id = :id RETURNING *""")
                                .bind("nota", q > 0 ? quien + " repuso " + q + " u. desde el almacén." : quien + " no encontró unidades en el almacén.")
                                .bind("id", t.getId())
                                .map((row, meta) -> template.getConverter().read(Task.class, row, meta))
                                .one()))
                .doOnNext(guardada -> eventos.publish(TaskEventType.UPDATED, guardada));
    }

    /** Registra una ausencia; si tenía una tarea en curso, queda libre para reasignarla. */
    public Mono<EmpleadoVista> ausencia(UsuarioActual u, long id, Solicitudes.Ausencia req) {
        filtro.revisar(req.motivo());
        return empleados.findById(id)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Persona no encontrada")))
                .doOnNext(e -> u.exigirAcceso(e.getTiendaId()))
                .flatMap(e -> {
                    e.setDisponibilidad(req.disponibilidad());
                    e.setMotivo(req.motivo().trim());
                    e.setAusenteDesde(LocalDate.now(LIMA));
                    e.setAusenteHasta(req.hasta());
                    return empleados.save(e);
                })
                .flatMap(e -> db.sql("""
                                UPDATE tasks SET status = 'TODO', empleado_id = NULL, asignada_en = NULL, minutos_estimados = NULL,
                                       description = COALESCE(description, '') || ' ' || :nota, updated_at = now()
                                WHERE empleado_id = :e AND status = 'IN_PROGRESS' RETURNING *""")
                        .bind("nota", "Quedó libre: " + e.getNombre() + " se ausentó.")
                        .bind("e", e.getId())
                        .map((row, meta) -> template.getConverter().read(Task.class, row, meta))
                        .all()
                        .doOnNext(t -> eventos.publish(TaskEventType.UPDATED, t))
                        .then(Mono.just(vista(e, null, LocalTime.now(LIMA), LocalDate.now(LIMA)))));
    }

    public Mono<EmpleadoVista> reincorporar(UsuarioActual u, long id) {
        return empleados.findById(id)
                .switchIfEmpty(Mono.error(Errores.noEncontrado("Persona no encontrada")))
                .doOnNext(e -> u.exigirAcceso(e.getTiendaId()))
                .flatMap(e -> {
                    e.setDisponibilidad(Empleado.ACTIVO);
                    e.setMotivo(null);
                    e.setAusenteDesde(null);
                    e.setAusenteHasta(null);
                    return empleados.save(e);
                })
                .map(e -> vista(e, null, LocalTime.now(LIMA), LocalDate.now(LIMA)));
    }

    /** Nombre de una persona de la sede (para registrar quién pide una compra). */
    public Mono<Empleado> deLaSede(long empleadoId, long tiendaId) {
        return empleados.findById(empleadoId)
                .filter(e -> e.getTiendaId() == tiendaId)
                .switchIfEmpty(Mono.error(Errores.invalido("Esa persona no es de esta sede.")));
    }
}
