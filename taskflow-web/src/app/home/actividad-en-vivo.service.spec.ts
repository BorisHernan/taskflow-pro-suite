import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { ActividadEnVivoService } from './actividad-en-vivo.service';
import { TaskService } from '../services/task.service';
import { ProductService } from '../services/product.service';
import { Task, TaskEvent } from '../models/task.model';
import { Product } from '../models/product.model';
import { signal } from '@angular/core';
import { SesionService } from '../auth/sesion.service';

describe('ActividadEnVivoService', () => {
  let tareas$: Subject<TaskEvent>;
  let productos$: Subject<Product>;
  let service: ActividadEnVivoService;

  const tarea = (id: number, status: Task['status']): Task => ({ id, title: `Tarea ${id}`, status, position: 0 });
  const producto = (stock: number): Product => ({ id: 1, name: 'Taza', price: 15, stock, category: 'Hogar' });

  beforeEach(() => {
    tareas$ = new Subject<TaskEvent>();
    productos$ = new Subject<Product>();
    TestBed.configureTestingModule({
      providers: [
        ActividadEnVivoService,
        { provide: TaskService, useValue: { getAll: () => of([tarea(1, 'TODO'), tarea(2, 'TODO')]), streamUpdates: () => tareas$ } },
        { provide: ProductService, useValue: { streamUpdates: () => productos$ } },
        { provide: SesionService, useValue: { activa: signal(true) } },
      ],
    });
    service = TestBed.inject(ActividadEnVivoService);
    service.iniciar();
  });

  const textos = () => service.actividad().map((a) => a.texto);

  it('cuenta el cambio de columna de una tarea', () => {
    tareas$.next({ type: 'UPDATED', task: tarea(1, 'DONE') });
    expect(textos()).toEqual(['Alguien movió "Tarea 1" a Hecho.']);
    expect(service.latido()).toBe(1);
  });

  it('ignora el reordenamiento dentro de la misma columna (vecinas de un drag & drop)', () => {
    tareas$.next({ type: 'UPDATED', task: tarea(2, 'TODO') });
    expect(textos()).toEqual([]);
    expect(service.latido()).toBe(0);
  });

  it('el catálogo inicial de la tienda no cuenta como venta; la baja de stock sí', () => {
    productos$.next(producto(20));
    expect(textos()).toEqual([]);

    productos$.next(producto(18));
    expect(textos()).toEqual(['Se vendieron 2 unidades de Taza.']);
  });

  it('la presencia actualiza los conectados sin agregar actividad', () => {
    tareas$.next({ type: 'PRESENCE', viewerCount: 3 });
    expect(service.conectados()).toBe(3);
    expect(textos()).toEqual([]);
  });

  it('guarda solo las últimas 6 actividades, la más nueva primero', () => {
    for (let i = 1; i <= 8; i++) {
      tareas$.next({ type: 'CREATED', task: tarea(10 + i, 'TODO') });
    }
    expect(textos().length).toBe(6);
    expect(textos()[0]).toBe('Alguien creó la tarea "Tarea 18".');
  });

  it('detener cierra las suscripciones', () => {
    service.detener();
    expect(tareas$.observed).toBe(false);
    expect(productos$.observed).toBe(false);
  });
});
