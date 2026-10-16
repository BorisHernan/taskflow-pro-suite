import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';

type Tramo = 'datos' | 'cliente';

interface Pulso {
  id: number;
  tramo: Tramo;
}

const DURACION_MS = 900;
const DESFASE_MS = 450;

/**
 * Arquitectura de la demo con un pulso por cada evento real: primero de
 * PostgreSQL a la API (el cambio se guardó) y luego de la API al navegador
 * (llega por SSE). Si el sistema pide menos movimiento, los pulsos no se ven.
 */
@Component({
  selector: 'app-diagrama-vivo',
  standalone: true,
  templateUrl: './diagrama-vivo.component.html',
  styleUrl: './diagrama-vivo.component.scss',
})
export class DiagramaVivoComponent {
  readonly latido = input(0);

  pulsos = signal<Pulso[]>([]);
  private siguienteId = 1;
  private temporizadores: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    effect(() => {
      if (this.latido() > 0) this.disparar();
    });
    inject(DestroyRef).onDestroy(() => this.temporizadores.forEach(clearTimeout));
  }

  pulsosDe(tramo: Tramo): Pulso[] {
    return this.pulsos().filter((p) => p.tramo === tramo);
  }

  private disparar(): void {
    this.agregar('datos');
    this.programar(() => this.agregar('cliente'), DESFASE_MS);
  }

  private agregar(tramo: Tramo): void {
    const pulso = { id: this.siguienteId++, tramo };
    this.pulsos.update((lista) => [...lista, pulso]);
    this.programar(() => this.pulsos.update((lista) => lista.filter((p) => p.id !== pulso.id)), DURACION_MS);
  }

  private programar(fn: () => void, ms: number): void {
    this.temporizadores.push(setTimeout(fn, ms));
  }
}
