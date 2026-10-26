import { Injectable, signal } from '@angular/core';

export interface Aviso {
  id: number;
  tipo: 'exito' | 'error';
  texto: string;
}

/**
 * Notificaciones de resultado de acciones manuales. Solo se llaman después
 * de la respuesta del servidor: nunca se anuncia un éxito antes de tiempo.
 */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  readonly avisos = signal<Aviso[]>([]);
  private siguiente = 1;

  exito(texto: string): void {
    this.agregar('exito', texto, 5000);
  }

  error(texto: string): void {
    this.agregar('error', texto, 8000);
  }

  cerrar(id: number): void {
    this.avisos.update((lista) => lista.filter((a) => a.id !== id));
  }

  private agregar(tipo: Aviso['tipo'], texto: string, ms: number): void {
    const aviso = { id: this.siguiente++, tipo, texto };
    // Como máximo tres a la vez: el más viejo sale primero.
    this.avisos.update((lista) => [...lista.slice(-2), aviso]);
    setTimeout(() => this.cerrar(aviso.id), ms);
  }
}
