import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';
import {
  NOMBRE_PRIORIDAD,
  NOMBRE_TIPO,
  ORDEN_PRIORIDAD,
  Prioridad,
  STATUS_LABELS,
  STATUSES,
  Task,
  TaskPositionUpdate,
  TaskStatus,
  TipoTarea,
} from '../models/task.model';
import { SesionService } from '../auth/sesion.service';
import { GestionService, mensajeDeError } from '../gestion/gestion.service';
import { Empleado, NOMBRE_PUESTO, avanceDe } from '../models/gestion.model';
import { TaskService } from '../services/task.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { AvisosService } from '../shared/ui/avisos.service';

const ESPERA_DESHACER_MS = 5000;

/** Minúsculas y sin tildes, para que "autenticacion" encuentre "autenticación". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

type FiltroTipo = 'todas' | TipoTarea;
type Orden = 'manual' | 'prioridad' | 'recientes';

const RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [FormsModule, DragDropModule, IconoComponent, RouterLink, DatePipe],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
})
export class KanbanBoardComponent implements OnInit, OnDestroy {
  statuses = STATUSES;
  statusLabels = STATUS_LABELS;
  readonly nombreTipo = NOMBRE_TIPO;
  readonly nombrePrioridad = NOMBRE_PRIORIDAD;
  readonly prioridades: Prioridad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
  readonly gestion = inject(GestionService);
  readonly sesion = inject(SesionService);

  private readonly avisos = inject(AvisosService);

  /** Filtros reales del dominio: origen de la tarea y prioridad. */
  readonly filtroTipo = signal<FiltroTipo>('todas');
  readonly filtroPrioridad = signal<Prioridad | 'todas' | 'urgentes'>('todas');
  readonly orden = signal<Orden>('manual');
  readonly filtrosTipo: { clave: FiltroTipo; nombre: string }[] = [
    { clave: 'todas', nombre: 'Todas' },
    { clave: 'PEDIDO', nombre: 'Pedidos' },
    { clave: 'REPOSICION', nombre: 'Reposición' },
    { clave: 'INCIDENCIA', nombre: 'Incidencias' },
    { clave: 'TURNO', nombre: 'Checklist' },
    { clave: 'MANUAL', nombre: 'Manuales' },
  ];

  /** Tarea abierta en el panel de detalle. */
  readonly detalle = signal<Task | null>(null);
  private readonly panel = viewChild<ElementRef<HTMLDialogElement>>('panel');
  readonly ahora = signal(Date.now());
  readonly todasLasTiendas = computed(() => this.gestion.tiendaActiva() == null);
  readonly nombrePuesto = NOMBRE_PUESTO;

  /** Personal de la sede y unidades en almacén por producto: con eso se decide a quién asignar. */
  readonly personal = signal<Empleado[]>([]);
  private readonly almacenes = signal<Map<string, number>>(new Map());
  readonly asignando = signal<number | null>(null);
  readonly resumenPersonal = computed(() => {
    const p = this.personal();
    return {
      trabajando: p.filter((e) => e.estado === 'TRABAJANDO').length,
      disponibles: p.filter((e) => e.estado === 'DISPONIBLE').length,
      ausentes: p.filter((e) => e.estado === 'AUSENTE').length,
    };
  });
  private refrescoPersonal: ReturnType<typeof setTimeout> | undefined;
  private reloj: ReturnType<typeof setInterval> | undefined;

  tasks = signal<Task[]>([]);
  cargando = signal(true);
  connectionLive = signal(false);
  errorMessage = signal<string | null>(null);
  viewerCount = signal(1);

  newTaskTitle = '';
  newTaskDescription = '';
  newTaskPrioridad: Prioridad = 'MEDIA';
  mostrarDescripcion = signal(false);

  filtro = signal('');
  filtrando = computed(
    () => this.filtro().trim().length > 0 || this.filtroTipo() !== 'todas' || this.filtroPrioridad() !== 'todas',
  );
  /** Con filtros u otro orden que el manual, arrastrar se pausa: las posiciones no corresponderían. */
  arrastreBloqueado = computed(() => this.filtrando() || this.orden() !== 'manual');

  // Tarea borrada en pantalla que todavía se puede recuperar con "Deshacer".
  pendienteBorrar = signal<Task | null>(null);
  private borrarTimeoutId: ReturnType<typeof setTimeout> | undefined;

  private destroy$ = new Subject<void>();
  private errorTimeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor(private taskService: TaskService) {
    // El admin cambia de tienda desde el menú: el tablero se recarga con la elegida.
    let primera = true;
    effect(() => {
      this.gestion.tiendaActiva();
      this.gestion.cambios();
      if (primera) {
        primera = false;
        return;
      }
      untracked(() => this.loadAll());
    });
    // El panel de detalle sigue a la tarea: si llega un cambio por SSE, se ve al instante.
    effect(() => {
      const abierta = this.detalle();
      const d = this.panel()?.nativeElement;
      if (!d) return;
      if (abierta && !d.open) d.showModal();
      if (!abierta && d.open) d.close();
    });
  }

  ngOnInit(): void {
    this.loadAll();
    // El avance de las tareas asignadas se mueve con el tiempo.
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 1000);

    this.taskService
      .streamUpdates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => {
          this.connectionLive.set(true);
          if (event.type === 'PRESENCE') {
            this.viewerCount.set(event.viewerCount ?? 1);
          } else if (event.type === 'RESET') {
            this.loadAll();
          } else if (event.type === 'DELETED') {
            this.removeTask(event.task!.id!);
          } else if (event.task?.id !== this.pendienteBorrar()?.id) {
            this.mergeTask(event.task!);
            this.programarApoyo();
            if (this.detalle()?.id === event.task?.id) this.detalle.set(event.task!);
          }
        },
      });
  }

  ngOnDestroy(): void {
    // Si se sale con un borrado pendiente, se confirma: lo que el usuario ve ya no la tiene.
    this.confirmarBorrado();
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.errorTimeoutId);
    clearTimeout(this.refrescoPersonal);
    clearInterval(this.reloj);
  }

  /** Recarga personal y almacén poco después de un cambio (varios eventos seguidos, una sola llamada). */
  private programarApoyo(): void {
    clearTimeout(this.refrescoPersonal);
    this.refrescoPersonal = setTimeout(() => this.cargarApoyo(), 400);
  }

  cargarApoyo(): void {
    this.gestion.personal().subscribe({ next: (p) => this.personal.set(p), error: () => {} });
    this.gestion.inventario().subscribe({
      next: (filas) => this.almacenes.set(new Map(filas.map((f) => [`${f.tiendaId}-${f.productoId}`, f.almacen]))),
      error: () => {},
    });
  }

  almacenDe(t: Task): number | null {
    return t.productoId == null ? null : (this.almacenes().get(`${t.tiendaId}-${t.productoId}`) ?? null);
  }

  /** Quién puede tomar la tarea ahora: de su sede, en turno, libre y con el puesto adecuado. */
  disponiblesPara(t: Task): Empleado[] {
    return this.personal().filter(
      (e) =>
        e.tiendaId === t.tiendaId &&
        e.estado === 'DISPONIBLE' &&
        (t.tipo !== 'REPOSICION' || e.puesto === 'REPONEDOR' || e.puesto === 'ALMACENERO'),
    );
  }

  /** Se puede asignar si no está hecha ni asignada, y si es reposición, hay unidades en el almacén. */
  puedeAsignar(t: Task): boolean {
    if (t.status === 'DONE' || t.empleadoId || !t.tiendaId) return false;
    if (t.tipo === 'REPOSICION') return t.status === 'TODO' && (this.almacenDe(t) ?? 0) > 0;
    return true;
  }

  asignar(t: Task, valor: string): void {
    const id = Number(valor);
    if (!id) return;
    this.asignando.set(t.id!);
    this.gestion.asignar(t.id!, id).subscribe({
      next: (guardada) => {
        this.asignando.set(null);
        this.mergeTask(guardada);
        this.avisos.exito(`#${guardada.id} asignada a ${guardada.asignadoA}: unos ${guardada.minutosEstimados} min.`);
        this.cargarApoyo();
      },
      error: (err) => {
        this.asignando.set(null);
        this.avisos.error(mensajeDeError(err, 'No se pudo asignar la tarea.'));
        this.cargarApoyo();
      },
    });
  }

  avance(t: Task): number {
    return avanceDe(t.asignadaEn, t.minutosEstimados, this.ahora());
  }

  restante(t: Task): string {
    if (!t.asignadaEn || !t.minutosEstimados) return '';
    const fin = new Date(t.asignadaEn).getTime() + t.minutosEstimados * 60000;
    const seg = Math.max(0, Math.round((fin - this.ahora()) / 1000));
    if (seg === 0) return t.tipo === 'REPOSICION' || t.tipo === 'MANUAL' || t.tipo === 'TURNO' ? 'terminando…' : 'falta confirmar';
    return seg >= 60 ? `quedan ${Math.ceil(seg / 60)} min` : `quedan ${seg} s`;
  }

  iniciales(nombre?: string | null): string {
    return (nombre ?? '?')
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  tasksByStatus(status: TaskStatus): Task[] {
    const texto = normalizar(this.filtro().trim());
    const tipo = this.filtroTipo();
    const prioridad = this.filtroPrioridad();
    const orden = this.orden();
    return this.visibles()
      .filter((t) => t.status === status)
      .filter((t) => tipo === 'todas' || (t.tipo ?? 'MANUAL') === tipo)
      .filter((t) =>
        prioridad === 'todas'
          ? true
          : prioridad === 'urgentes'
            ? t.prioridad === 'ALTA' || t.prioridad === 'CRITICA'
            : (t.prioridad ?? 'MEDIA') === prioridad,
      )
      .filter((t) => !texto || normalizar(`#${t.id} ${t.title} ${t.description ?? ''}`).includes(texto))
      .sort((a, b) =>
        orden === 'prioridad'
          ? ORDEN_PRIORIDAD[a.prioridad ?? 'MEDIA'] - ORDEN_PRIORIDAD[b.prioridad ?? 'MEDIA'] || a.position - b.position
          : orden === 'recientes'
            ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
            : a.position - b.position,
      );
  }

  totalDe(status: TaskStatus): number {
    return this.visibles().filter((t) => t.status === status).length;
  }

  /** El stream trae las tareas de todas las tiendas que el usuario puede ver; aquí se deja la elegida. */
  private visibles(): Task[] {
    const tienda = this.gestion.tiendaActiva();
    return tienda == null ? this.tasks() : this.tasks().filter((t) => t.tiendaId === tienda);
  }

  /** Primera tarea automática pendiente: el recorrido guiado la usa como ejemplo. */
  readonly primeraAutomatica = computed(() => {
    const t = this.tasksByStatus('TODO').find((x) => x.tipo === 'REPOSICION') ?? this.tasksByStatus('TODO').find((x) => this.esAutomatica(x));
    return t?.id ?? null;
  });

  abrirDetalle(t: Task): void {
    this.ahora.set(Date.now());
    this.detalle.set(t);
  }

  /** Hace cuánto, en texto corto ("hace 3 h"). */
  haceCuanto(iso?: string | null): string {
    if (!iso) return '';
    const min = Math.round((new Date(iso).getTime() - this.ahora()) / 60000);
    if (min > -1) return 'ahora';
    if (min > -60) return RELATIVO.format(min, 'minute');
    if (min > -1440) return RELATIVO.format(Math.round(min / 60), 'hour');
    return RELATIVO.format(Math.round(min / 1440), 'day');
  }

  esAutomatica(t: Task): boolean {
    return !!t.tipo && t.tipo !== 'MANUAL';
  }

  /** El backend deja el motivo del cierre automático en la descripción (p. ej. "Stock repuesto: 12 unidades."). */
  motivoCierre(t: Task): string | null {
    if (t.status !== 'DONE') return null;
    const m = /(Stock repuesto[^.]*\.|Incidencia resuelta[^.]*\.|Llegó el pedido[^.]*\.)/.exec(t.description ?? '');
    return m ? m[1] : null;
  }

  puedeBorrar(t: Task): boolean {
    return this.sesion.esAdmin() || !t.tipo || t.tipo === 'MANUAL';
  }

  connectedLists(): string[] {
    return this.statuses.map((s) => 'list-' + s);
  }

  columnaVecina(status: TaskStatus, delta: -1 | 1): TaskStatus | null {
    return this.statuses[this.statuses.indexOf(status) + delta] ?? null;
  }

  onDrop(event: CdkDragDrop<Task[]>, targetStatus: TaskStatus): void {
    const previousSnapshot = this.tasks();

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }

    // Reindexa las posiciones (1..n) de cada columna afectada, no solo la tarea movida.
    const reindexed: Task[] = event.container.data.map((t, i) => ({ ...t, status: targetStatus, position: i + 1 }));
    if (event.previousContainer !== event.container) {
      reindexed.push(...event.previousContainer.data.map((t, i) => ({ ...t, position: i + 1 })));
    }

    this.guardarOrden(reindexed, previousSnapshot);
  }

  /** Alternativa al drag & drop (teclado y celular): manda la tarea al final de la columna vecina. */
  moverA(task: Task, delta: -1 | 1): void {
    const destino = this.columnaVecina(task.status, delta);
    if (!destino || !task.id) return;

    const previousSnapshot = this.tasks();
    const origen = this.tasks()
      .filter((t) => t.status === task.status && t.id !== task.id)
      .sort((a, b) => a.position - b.position)
      .map((t, i) => ({ ...t, position: i + 1 }));
    const movida = { ...task, status: destino, position: this.totalDe(destino) + 1 };

    this.guardarOrden([movida, ...origen], previousSnapshot);
  }

  addTask(): void {
    const title = this.newTaskTitle.trim();
    if (!title) return;
    const description = this.newTaskDescription.trim() || undefined;

    const nueva: Partial<Task> = {
      title,
      description,
      status: 'TODO',
      position: this.totalDe('TODO') + 1,
      prioridad: this.newTaskPrioridad,
      tiendaId: this.gestion.tiendaActiva(),
    };
    this.taskService.create(nueva).subscribe({
      next: (created) => {
        this.mergeTask(created);
        this.avisos.exito(`Tarea #${created.id} creada.`);
      },
      error: (err) => this.showError(this.extractErrorMessage(err, 'No se pudo crear la tarea.')),
    });

    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskPrioridad = 'MEDIA';
    this.mostrarDescripcion.set(false);
  }

  deleteTask(task: Task): void {
    if (!task.id) return;
    this.confirmarBorrado();
    this.removeTask(task.id);
    this.pendienteBorrar.set(task);
    this.borrarTimeoutId = setTimeout(() => this.confirmarBorrado(), ESPERA_DESHACER_MS);
  }

  deshacerBorrado(): void {
    const task = this.pendienteBorrar();
    if (!task) return;
    clearTimeout(this.borrarTimeoutId);
    this.pendienteBorrar.set(null);
    this.mergeTask(task);
  }

  private confirmarBorrado(): void {
    const task = this.pendienteBorrar();
    if (!task?.id) return;
    clearTimeout(this.borrarTimeoutId);
    this.pendienteBorrar.set(null);
    this.taskService.delete(task.id).subscribe({
      error: (err) => {
        this.mergeTask(task);
        this.showError(this.extractErrorMessage(err, 'No se pudo eliminar la tarea.'));
      },
    });
  }

  private guardarOrden(cambios: Task[], previousSnapshot: Task[]): void {
    // Actualiza la pantalla al instante (optimista) y confirma con el backend en una sola llamada.
    cambios.forEach((t) => this.mergeTask(t));
    const updates: TaskPositionUpdate[] = cambios.map((t) => ({ id: t.id!, status: t.status, position: t.position }));

    this.taskService.reorder(updates).subscribe({
      error: (err) => {
        this.tasks.set(previousSnapshot);
        this.showError(this.extractErrorMessage(err, 'No se pudo mover la tarea. Se revirtió el cambio.'));
      },
    });
  }

  private loadAll(): void {
    this.cargarApoyo();
    this.taskService.getAll(this.gestion.tiendaActiva()).subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.showError('No se pudieron cargar las tareas. El servidor gratuito puede estar despertando: reintenta en unos segundos.');
      },
    });
  }

  private removeTask(id: number): void {
    this.tasks.update((list) => list.filter((t) => t.id !== id));
  }

  private mergeTask(updated: Task): void {
    this.tasks.update((list) => {
      const exists = list.some((t) => t.id === updated.id);
      return exists ? list.map((t) => (t.id === updated.id ? updated : t)) : [...list, updated];
    });
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse && err.error) {
      const body = err.error;
      if (typeof body === 'string' && body.trim()) return body;
      if (typeof body?.error === 'string') return body.error;
      const firstFieldMessage = Object.values(body ?? {}).find((v) => typeof v === 'string');
      if (typeof firstFieldMessage === 'string') return firstFieldMessage;
    }
    return fallback;
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    this.avisos.error(message);
  }
}
