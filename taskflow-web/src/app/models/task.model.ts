export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type TipoTarea = 'MANUAL' | 'REPOSICION' | 'INCIDENCIA' | 'TURNO';
export type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export interface Task {
  id?: number;
  title: string;
  description?: string;
  status: TaskStatus;
  position: number;
  createdAt?: string;
  updatedAt?: string;
  // Gestión de tiendas: null = tarea general (solo la ve el admin).
  tiendaId?: number | null;
  tipo?: TipoTarea;
  prioridad?: Prioridad;
  productoId?: number | null;
  referenciaId?: number | null;
  turnoId?: number | null;
  creadoPor?: string;
  asignadoA?: string | null;
  cerradaEn?: string | null;
}

export const NOMBRE_TIPO: Record<TipoTarea, string> = {
  MANUAL: 'Tarea',
  REPOSICION: 'Reposición',
  INCIDENCIA: 'Incidencia',
  TURNO: 'Checklist',
};

export const NOMBRE_PRIORIDAD: Record<Prioridad, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', CRITICA: 'Crítica' };

export const ORDEN_PRIORIDAD: Record<Prioridad, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Hecho',
};

export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

export type TaskEventType = 'CREATED' | 'UPDATED' | 'DELETED' | 'RESET' | 'PRESENCE';

export interface TaskEvent {
  type: TaskEventType;
  // Ausente cuando type es 'RESET' o 'PRESENCE'.
  task?: Task;
  // Solo presente cuando type es 'PRESENCE': visitantes conectados en este momento.
  viewerCount?: number;
}

export interface TaskPositionUpdate {
  id: number;
  status: TaskStatus;
  position: number;
}
