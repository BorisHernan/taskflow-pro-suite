import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { STATUS_LABELS, TaskEvent, TaskStatus } from '../models/task.model';
import { Product } from '../models/product.model';
import { ProductService } from '../services/product.service';
import { TaskService } from '../services/task.service';

export interface Actividad {
  id: number;
  texto: string;
  demo: 'tablero' | 'tienda';
  fecha: Date;
}

const MAXIMO = 6;

/**
 * Lo que hacen los visitantes de la demo, en vivo, para la portada. Escucha
 * los mismos streams SSE del tablero y la tienda, y traduce cada mensaje a
 * una frase. Las columnas y el stock previos se guardan para saber si una
 * tarea cambió de columna o cuántas unidades se vendieron.
 */
@Injectable()
export class ActividadEnVivoService {
  private readonly taskService = inject(TaskService);
  private readonly productService = inject(ProductService);

  readonly actividad = signal<Actividad[]>([]);
  readonly conectados = signal<number | null>(null);
  // Sube con cada actividad: la portada lo usa para disparar el pulso del diagrama.
  readonly latido = signal(0);

  private columnas = new Map<number, TaskStatus>();
  private stock = new Map<number, number>();
  private subs = new Subscription();
  private siguienteId = 1;

  iniciar(): void {
    this.subs.add(
      this.taskService.getAll().subscribe((tareas) => {
        tareas.forEach((t) => t.id != null && this.columnas.set(t.id, t.status));
      }),
    );
    this.subs.add(this.taskService.streamUpdates().subscribe((e) => this.alEventoTarea(e)));
    this.subs.add(this.productService.streamUpdates().subscribe((p) => this.alProducto(p)));
  }

  detener(): void {
    this.subs.unsubscribe();
    this.subs = new Subscription();
  }

  private alEventoTarea(e: TaskEvent): void {
    if (e.type === 'PRESENCE') {
      this.conectados.set(e.viewerCount ?? null);
      return;
    }
    if (e.type === 'RESET') {
      this.columnas.clear();
      this.agregar('El tablero volvió a sus tareas iniciales.', 'tablero');
      return;
    }
    const tarea = e.task;
    if (!tarea?.id) return;

    if (e.type === 'CREATED') {
      this.agregar(`Alguien creó la tarea "${tarea.title}".`, 'tablero');
    } else if (e.type === 'DELETED') {
      this.agregar('Alguien eliminó una tarea del tablero.', 'tablero');
    } else if (e.type === 'UPDATED') {
      // Un drag & drop reordena toda la columna y emite un UPDATED por tarjeta vecina:
      // solo se cuenta el cambio de columna, que es lo que hizo la persona.
      const antes = this.columnas.get(tarea.id);
      if (antes && antes !== tarea.status) {
        this.agregar(`Alguien movió "${tarea.title}" a ${STATUS_LABELS[tarea.status]}.`, 'tablero');
      }
    }
    if (e.type === 'DELETED') this.columnas.delete(tarea.id);
    else this.columnas.set(tarea.id, tarea.status);
  }

  private alProducto(p: Product): void {
    const antes = this.stock.get(p.id);
    this.stock.set(p.id, p.stock);
    // La primera vez que llega un producto es el catálogo inicial, no una compra.
    if (antes === undefined || antes === p.stock) return;

    if (p.stock < antes) {
      const unidades = antes - p.stock;
      this.agregar(`Se ${unidades === 1 ? 'vendió 1 unidad' : `vendieron ${unidades} unidades`} de ${p.name}.`, 'tienda');
    } else {
      this.agregar(`Se repuso el stock de ${p.name}.`, 'tienda');
    }
  }

  private agregar(texto: string, demo: Actividad['demo']): void {
    const nueva: Actividad = { id: this.siguienteId++, texto, demo, fecha: new Date() };
    this.actividad.update((lista) => [nueva, ...lista].slice(0, MAXIMO));
    this.latido.update((n) => n + 1);
  }
}
