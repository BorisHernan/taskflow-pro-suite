import { Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';
import {
  NOMBRE_PRIORIDAD,
  NOMBRE_TIPO,
  Prioridad,
  STATUS_LABELS,
  STATUSES,
  Task,
  TaskPositionUpdate,
  TaskStatus,
  TipoTarea,
} from '../models/task.model';
import { SesionService } from '../auth/sesion.service';
import { GestionService } from '../gestion/gestion.service';
import { TaskService } from '../services/task.service';
import { IconoComponent } from '../shared/icono/icono.component';

const ESPERA_DESHACER_MS = 5000;

/** Minúsculas y sin tildes, para que "autenticacion" encuentre "autenticación". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

type FiltroTipo = 'todas' | 'urgentes' | TipoTarea;

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [FormsModule, DragDropModule, IconoComponent, RouterLink],
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

  /** Filtro por tipo de tarea: las automáticas (reposición, incidencias, checklist) o las urgentes. */
  readonly filtroTipo = signal<FiltroTipo>('todas');
  readonly filtrosTipo: { clave: FiltroTipo; nombre: string }[] = [
    { clave: 'todas', nombre: 'Todas' },
    { clave: 'urgentes', nombre: 'Urgentes' },
    { clave: 'REPOSICION', nombre: 'Reposición' },
    { clave: 'INCIDENCIA', nombre: 'Incidencias' },
    { clave: 'TURNO', nombre: 'Checklist' },
    { clave: 'MANUAL', nombre: 'Manuales' },
  ];
  readonly todasLasTiendas = computed(() => this.gestion.tiendaActiva() == null);

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
  filtrando = computed(() => this.filtro().trim().length > 0 || this.filtroTipo() !== 'todas');

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
      if (primera) {
        primera = false;
        return;
      }
      untracked(() => this.loadAll());
    });
  }

  ngOnInit(): void {
    this.loadAll();

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
  }

  tasksByStatus(status: TaskStatus): Task[] {
    const texto = normalizar(this.filtro().trim());
    const tipo = this.filtroTipo();
    return this.visibles()
      .filter((t) => t.status === status)
      .filter((t) =>
        tipo === 'todas' ? true : tipo === 'urgentes' ? t.prioridad === 'ALTA' || t.prioridad === 'CRITICA' : (t.tipo ?? 'MANUAL') === tipo,
      )
      .filter((t) => !texto || normalizar(`${t.title} ${t.description ?? ''}`).includes(texto))
      .sort((a, b) => a.position - b.position);
  }

  totalDe(status: TaskStatus): number {
    return this.visibles().filter((t) => t.status === status).length;
  }

  /** El stream trae las tareas de todas las tiendas que el usuario puede ver; aquí se deja la elegida. */
  private visibles(): Task[] {
    const tienda = this.gestion.tiendaActiva();
    return tienda == null ? this.tasks() : this.tasks().filter((t) => t.tiendaId === tienda);
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
      next: (created) => this.mergeTask(created),
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
    clearTimeout(this.errorTimeoutId);
    this.errorTimeoutId = setTimeout(() => this.errorMessage.set(null), 6000);
  }
}
