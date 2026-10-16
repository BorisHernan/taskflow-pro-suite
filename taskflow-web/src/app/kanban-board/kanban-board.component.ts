import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';
import { STATUS_LABELS, STATUSES, Task, TaskPositionUpdate, TaskStatus } from '../models/task.model';
import { TaskService } from '../services/task.service';
import { IconoComponent } from '../shared/icono/icono.component';

const ESPERA_DESHACER_MS = 5000;

/** Minúsculas y sin tildes, para que "autenticacion" encuentre "autenticación". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

import { TAREAS_EJEMPLO } from './tareas-ejemplo';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [FormsModule, DragDropModule, IconoComponent],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
})
export class KanbanBoardComponent implements OnInit, OnDestroy {
  statuses = STATUSES;
  statusLabels = STATUS_LABELS;

  tasks = signal<Task[]>([]);
  cargando = signal(true);
  connectionLive = signal(false);
  errorMessage = signal<string | null>(null);
  viewerCount = signal(1);

  newTaskTitle = '';
  newTaskDescription = '';
  mostrarDescripcion = signal(false);
  /** Cuenta las tiradas del botón "Sorpréndeme" (reinicia la animación del dado). */
  dado = signal(0);

  filtro = signal('');
  filtrando = computed(() => this.filtro().trim().length > 0);

  // Tarea borrada en pantalla que todavía se puede recuperar con "Deshacer".
  pendienteBorrar = signal<Task | null>(null);
  private borrarTimeoutId: ReturnType<typeof setTimeout> | undefined;

  private destroy$ = new Subject<void>();
  private errorTimeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor(private taskService: TaskService) {}

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
    return this.tasks()
      .filter((t) => t.status === status)
      .filter((t) => !texto || normalizar(`${t.title} ${t.description ?? ''}`).includes(texto))
      .sort((a, b) => a.position - b.position);
  }

  totalDe(status: TaskStatus): number {
    return this.tasks().filter((t) => t.status === status).length;
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

  /** Crea al instante una tarea de ejemplo que todavía no esté en el tablero. */
  sorprender(): void {
    const enTablero = new Set(this.tasks().map((t) => t.title));
    const libres = TAREAS_EJEMPLO.filter((t) => !enTablero.has(t.title));
    const elegida = (libres.length ? libres : TAREAS_EJEMPLO)[Math.floor(Math.random() * (libres.length || TAREAS_EJEMPLO.length))];
    this.dado.update((n) => n + 1);
    this.newTaskTitle = elegida.title;
    this.newTaskDescription = elegida.description;
    this.addTask();
  }

  addTask(): void {
    const title = this.newTaskTitle.trim();
    if (!title) return;
    const description = this.newTaskDescription.trim() || undefined;

    this.taskService.create({ title, description, status: 'TODO', position: this.totalDe('TODO') + 1 }).subscribe({
      next: (created) => this.mergeTask(created),
      error: (err) => this.showError(this.extractErrorMessage(err, 'No se pudo crear la tarea.')),
    });

    this.newTaskTitle = '';
    this.newTaskDescription = '';
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
    this.taskService.getAll().subscribe({
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
