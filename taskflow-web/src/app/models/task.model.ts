export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Task {
  id?: number;
  title: string;
  description?: string;
  status: TaskStatus;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Hecho',
};

export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

export type TaskEventType = 'CREATED' | 'UPDATED' | 'DELETED' | 'RESET';

export interface TaskEvent {
  type: TaskEventType;
  // Ausente cuando type es 'RESET': recarga la lista completa en ese caso.
  task?: Task;
}

export interface TaskPositionUpdate {
  id: number;
  status: TaskStatus;
  position: number;
}
