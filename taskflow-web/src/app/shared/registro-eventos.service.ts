import { Injectable, signal } from '@angular/core';

export type Demo = 'tablero' | 'tienda' | 'estadisticas' | 'arena';
export type Canal = 'REST' | 'SSE' | 'WebSocket';

export interface EventoRegistro {
  id: number;
  demo: Demo;
  canal: Canal;
  // 'entrada' = llega del servidor, 'salida' = lo envía este navegador.
  direccion: 'entrada' | 'salida';
  detalle: string;
  fecha: Date;
}

const MAXIMO = 60;

/**
 * Registro de lo que viaja entre este navegador y el backend (REST, SSE y
 * WebSocket). Lo alimentan los servicios y el interceptor HTTP; lo muestra el
 * panel "Cómo está hecho".
 */
@Injectable({ providedIn: 'root' })
export class RegistroEventosService {
  private siguienteId = 1;
  readonly eventos = signal<EventoRegistro[]>([]);

  registrar(evento: Omit<EventoRegistro, 'id' | 'fecha'>): void {
    const nuevo: EventoRegistro = { ...evento, id: this.siguienteId++, fecha: new Date() };
    this.eventos.update((lista) => [nuevo, ...lista].slice(0, MAXIMO));
  }
}

/** A qué demo pertenece una URL del backend. */
export function demoDeUrl(url: string): Demo | null {
  if (url.includes('/api/tasks')) return 'tablero';
  if (url.includes('/api/products')) return 'tienda';
  if (url.includes('/api/stats')) return 'estadisticas';
  if (url.includes('/ws/arena')) return 'arena';
  return null;
}
