import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TaskService } from './task.service';
import { environment } from '../../environments/environment';
import { Task, TaskEvent, TaskPositionUpdate } from '../models/task.model';

const API_URL = environment.apiUrl;

describe('TaskService', () => {
  let service: TaskService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TaskService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TaskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll pide la lista de tareas al backend', () => {
    const tasks: Task[] = [{ id: 1, title: 'Una tarea', status: 'TODO', position: 0 }];

    service.getAll().subscribe((result) => {
      expect(result).toEqual(tasks);
    });

    const req = httpMock.expectOne(API_URL);
    expect(req.request.method).toBe('GET');
    req.flush(tasks);
  });

  it('create envia un POST con la tarea nueva', () => {
    const partial: Partial<Task> = { title: 'Nueva tarea', status: 'TODO', position: 0 };
    const created: Task = { id: 5, title: 'Nueva tarea', status: 'TODO', position: 0 };

    service.create(partial).subscribe((result) => {
      expect(result).toEqual(created);
    });

    const req = httpMock.expectOne(API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(partial);
    req.flush(created);
  });

  it('update envia un PUT a /tasks/{id}', () => {
    const task: Task = { id: 3, title: 'Editada', status: 'IN_PROGRESS', position: 1 };

    service.update(3, task).subscribe((result) => {
      expect(result).toEqual(task);
    });

    const req = httpMock.expectOne(`${API_URL}/3`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(task);
    req.flush(task);
  });

  it('reorder envia un PUT en lote a /tasks/reorder', () => {
    const updates: TaskPositionUpdate[] = [
      { id: 1, status: 'DONE', position: 0 },
      { id: 2, status: 'DONE', position: 1 },
    ];
    const updated: Task[] = [
      { id: 1, title: 'A', status: 'DONE', position: 0 },
      { id: 2, title: 'B', status: 'DONE', position: 1 },
    ];

    service.reorder(updates).subscribe((result) => {
      expect(result).toEqual(updated);
    });

    const req = httpMock.expectOne(`${API_URL}/reorder`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(updates);
    req.flush(updated);
  });

  it('delete envia un DELETE a /tasks/{id}', () => {
    service.delete(7).subscribe();

    const req = httpMock.expectOne(`${API_URL}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('streamUpdates lee el stream SSE con fetch, enviando el token, y emite cada evento', async () => {
    const taskEvent: TaskEvent = { type: 'CREATED', task: { id: 1, title: 'x', status: 'TODO', position: 0 } };
    const cuerpo = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(`data:${JSON.stringify(taskEvent)}\n\n`));
      },
    });
    const fetchFalso = vi.fn(async () => new Response(cuerpo, { status: 200 }));
    const original = globalThis.fetch;
    globalThis.fetch = fetchFalso as unknown as typeof fetch;

    try {
      const recibido = await new Promise<TaskEvent>((resolve) => {
        const sub = service.streamUpdates().subscribe((e) => {
          resolve(e);
          sub.unsubscribe();
        });
      });

      expect(recibido).toEqual(taskEvent);
      expect(fetchFalso).toHaveBeenCalledWith(`${API_URL}/stream`, expect.objectContaining({ headers: expect.any(Object) }));
    } finally {
      globalThis.fetch = original;
    }
  });
});
