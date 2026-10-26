import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, filter, merge, share, tap, timer } from 'rxjs';
import { DemoBackend } from '../shared/demo/demo-backend.service';
import { SesionService } from '../auth/sesion.service';
import { EstadoConexion, sseConToken } from '../shared/sse';
import { environment } from '../../environments/environment';
import { STATUS_LABELS, Task, TaskEvent, TaskPositionUpdate } from '../models/task.model';
import { RegistroEventosService } from '../shared/registro-eventos.service';

const API_URL = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly registro = inject(RegistroEventosService);
  private readonly sesion = inject(SesionService);
  private readonly demo = inject(DemoBackend);

  constructor(private http: HttpClient) {}

  /** tienda: solo la usa el admin para filtrar; una tienda siempre recibe las suyas. */
  getAll(tienda?: number | null): Observable<Task[]> {
    const params = tienda == null ? new HttpParams() : new HttpParams().set('tienda', tienda);
    return this.http.get<Task[]>(API_URL, { params });
  }

  create(task: Partial<Task>): Observable<Task> {
    return this.http.post<Task>(API_URL, task);
  }

  update(id: number, task: Task): Observable<Task> {
    return this.http.put<Task>(`${API_URL}/${id}`, task);
  }

  reorder(updates: TaskPositionUpdate[]): Observable<Task[]> {
    return this.http.put<Task[]>(`${API_URL}/reorder`, updates);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }

  /**
   * Se conecta al endpoint de Server-Sent Events del backend.
   * Cada vez que alguien crea, actualiza, mueve o borra una tarea (desde
   * cualquier pestaña o cliente), este observable emite el evento tipado
   * correspondiente en tiempo real.
   */
  /** Estado de la conexión en tiempo real, para el indicador de la barra superior. */
  readonly conexion = signal<EstadoConexion>('conectando');

  // Una sola conexión compartida por todas las pantallas que la usen; se cierra 5 s después de que nadie la escuche.
  private compartido: Observable<TaskEvent> | null = null;
  private tokenCompartido: string | null = null;

  streamUpdates(): Observable<TaskEvent> {
    const token = this.sesion.token();
    if (!this.compartido || this.tokenCompartido !== token) {
      this.tokenCompartido = token;
      // Con token: el servidor filtra y cada tienda recibe solo los cambios de sus tareas.
      this.compartido = sseConToken<TaskEvent>(`${API_URL}/stream`, token, (e) => this.conexion.set(e)).pipe(
        tap((e) => this.registro.registrar({ demo: 'tablero', canal: 'SSE', direccion: 'entrada', detalle: describirEvento(e) })),
        share({ resetOnRefCountZero: () => timer(5000) }),
      );
    }
    return merge(this.compartido.pipe(filter(() => !this.demo.activo())), this.demo.eventos$);
  }
}

function describirEvento(e: TaskEvent): string {
  if (e.type === 'PRESENCE') return `PRESENCE · ${e.viewerCount ?? 0} conectados`;
  if (e.type === 'RESET') return 'RESET · el tablero volvió a los datos iniciales';
  if (!e.task) return e.type;
  const columna = e.task.status ? ` → ${STATUS_LABELS[e.task.status]}` : '';
  return `${e.type} · "${e.task.title ?? `tarea ${e.task.id}`}"${e.type === 'DELETED' ? '' : columna}`;
}
