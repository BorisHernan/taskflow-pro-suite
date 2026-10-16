import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { KanbanBoardComponent } from './kanban-board.component';
import { TaskService } from '../services/task.service';
import { Task } from '../models/task.model';
import { TAREAS_EJEMPLO } from './tareas-ejemplo';

describe('KanbanBoardComponent', () => {
  let servicio: {
    getAll: ReturnType<typeof vi.fn>;
    streamUpdates: ReturnType<typeof vi.fn>;
    reorder: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let componente: KanbanBoardComponent;

  const tareas: Task[] = [
    { id: 1, title: 'Diseñar el modelo de datos', status: 'TODO', position: 1 },
    { id: 2, title: 'Agregar autenticación', description: 'Con JWT', status: 'TODO', position: 2 },
    { id: 3, title: 'Crear board-service', status: 'IN_PROGRESS', position: 1 },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    servicio = {
      getAll: vi.fn(() => of(tareas)),
      streamUpdates: vi.fn(() => NEVER),
      reorder: vi.fn(() => of([])),
      delete: vi.fn(() => of(undefined)),
      create: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: TaskService, useValue: servicio }] });
    componente = TestBed.runInInjectionContext(() => new KanbanBoardComponent(TestBed.inject(TaskService)));
    componente.ngOnInit();
  });

  afterEach(() => vi.useRealTimers());

  it('la búsqueda ignora tildes y mayúsculas, y también mira la descripción', () => {
    componente.filtro.set('AUTENTICACION');
    expect(componente.tasksByStatus('TODO').map((t) => t.id)).toEqual([2]);

    componente.filtro.set('jwt');
    expect(componente.tasksByStatus('TODO').map((t) => t.id)).toEqual([2]);
  });

  it('mover con botones manda la tarea al final de la columna vecina y reindexa la de origen', () => {
    componente.moverA(tareas[0], 1);

    expect(servicio.reorder).toHaveBeenCalledWith([
      { id: 1, status: 'IN_PROGRESS', position: 2 },
      { id: 2, status: 'TODO', position: 1 },
    ]);
    expect(componente.tasksByStatus('IN_PROGRESS').map((t) => t.id)).toEqual([3, 1]);
  });

  it('"Sorpréndeme" crea una tarea de ejemplo que no esté ya en el tablero', () => {
    servicio.create.mockImplementation((t: Task) => of({ ...t, id: 99 }));

    componente.sorprender();

    const creada = servicio.create.mock.calls[0][0] as Task;
    expect(TAREAS_EJEMPLO.some((e) => e.title === creada.title && e.description === creada.description)).toBe(true);
    expect(tareas.some((t) => t.title === creada.title)).toBe(false);
    expect(creada.status).toBe('TODO');
    expect(componente.newTaskTitle).toBe('');
  });

  it('no hay columna vecina a la izquierda de "Por hacer"', () => {
    expect(componente.columnaVecina('TODO', -1)).toBeNull();
    expect(componente.columnaVecina('TODO', 1)).toBe('IN_PROGRESS');
  });

  it('eliminar quita la tarea al instante, pero el borrado real espera 5 s', () => {
    componente.deleteTask(tareas[0]);

    expect(componente.tasksByStatus('TODO').map((t) => t.id)).toEqual([2]);
    expect(servicio.delete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);
    expect(servicio.delete).toHaveBeenCalledWith(1);
    expect(componente.pendienteBorrar()).toBeNull();
  });

  it('deshacer devuelve la tarea y nunca la borra en el servidor', () => {
    componente.deleteTask(tareas[0]);
    componente.deshacerBorrado();
    vi.advanceTimersByTime(10000);

    expect(servicio.delete).not.toHaveBeenCalled();
    expect(componente.tasksByStatus('TODO').map((t) => t.id)).toEqual([1, 2]);
  });

  it('salir de la página confirma el borrado pendiente', () => {
    componente.deleteTask(tareas[0]);
    componente.ngOnDestroy();
    expect(servicio.delete).toHaveBeenCalledWith(1);
  });
});
