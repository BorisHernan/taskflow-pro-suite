import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';
import { STATUS_LABELS, STATUSES, Task, TaskPositionUpdate, TaskStatus } from '../models/task.model';
import { TaskService } from '../services/task.service';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
})
export class KanbanBoardComponent implements OnInit, OnDestroy {
  statuses = STATUSES;
  statusLabels = STATUS_LABELS;

  tasks = signal<Task[]>([]);
  newTaskTitle = '';
  connectionLive = signal(false);
  errorMessage = signal<string | null>(null);
  showInfo = signal(false);

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
          if (event.type === 'RESET') {
            this.loadAll();
          } else if (event.type === 'DELETED') {
            this.removeTask(event.task!.id!);
          } else {
            this.mergeTask(event.task!);
          }
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.errorTimeoutId);
  }

  tasksByStatus(status: TaskStatus): Task[] {
    return this.tasks()
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);
  }

  connectedLists(): string[] {
    return this.statuses.map((s) => 'list-' + s);
  }

  onDrop(event: CdkDragDrop<Task[]>, targetStatus: TaskStatus): void {
    const previousSnapshot = this.tasks();

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }

    // Reindexa las posiciones (1..n) de cada columna afectada por el drop,
    // no solo la tarea movida, para que el orden se mantenga consistente.
    const reindexed: Task[] = event.container.data.map((t, i) => ({
      ...t,
      status: targetStatus,
      position: i + 1,
    }));

    if (event.previousContainer !== event.container) {
      reindexed.push(
        ...event.previousContainer.data.map((t, i) => ({ ...t, position: i + 1 }))
      );
    }

    // Actualiza el estado local al instante (optimista) y confirma con el backend.
    reindexed.forEach((t) => this.mergeTask(t));

    const updates: TaskPositionUpdate[] = reindexed.map((t) => ({
      id: t.id!,
      status: t.status,
      position: t.position,
    }));

    this.taskService.reorder(updates).subscribe({
      error: (err) => {
        this.tasks.set(previousSnapshot);
        this.showError(this.extractErrorMessage(err, 'No se pudo mover la tarea. Se revirtió el cambio.'));
      },
    });
  }

  addTask(): void {
    const title = this.newTaskTitle.trim();
    if (!title) return;

    this.taskService
      .create({ title, status: 'TODO', position: this.tasksByStatus('TODO').length + 1 })
      .subscribe({
        next: (created) => this.mergeTask(created),
        error: (err) => this.showError(this.extractErrorMessage(err, 'No se pudo crear la tarea.')),
      });

    this.newTaskTitle = '';
  }

  deleteTask(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    if (!task.id) return;
    this.taskService.delete(task.id).subscribe({
      next: () => this.removeTask(task.id!),
      error: (err) => this.showError(this.extractErrorMessage(err, 'No se pudo eliminar la tarea.')),
    });
  }

  private loadAll(): void {
    this.taskService.getAll().subscribe({
      next: (tasks) => this.tasks.set(tasks),
      error: () => this.showError('No se pudieron cargar las tareas. Verifica que el backend esté corriendo.'),
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
