import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Task, TaskEvent, TaskPositionUpdate } from '../models/task.model';

const API_URL = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<Task[]> {
    return this.http.get<Task[]>(API_URL);
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
  streamUpdates(): Observable<TaskEvent> {
    return new Observable<TaskEvent>((subscriber) => {
      const eventSource = new EventSource(`${API_URL}/stream`);

      eventSource.onmessage = (event) => {
        const taskEvent: TaskEvent = JSON.parse(event.data);
        subscriber.next(taskEvent);
      };

      eventSource.onerror = (err) => {
        // El navegador reintenta solo la conexión SSE; no es necesario
        // cerrar el observable aquí, solo lo dejamos registrado.
        console.warn('SSE: conexión interrumpida, reintentando...', err);
      };

      return () => eventSource.close();
    });
  }
}
