import { Injectable, signal } from '@angular/core';

export interface PedidoConfirmacion {
  titulo: string;
  /** Contexto para decidir: qué va a pasar y sobre qué. */
  detalle: string;
  confirmar: string;
  peligro?: boolean;
  /** Si se indica, el diálogo pide un texto (motivo, solución) antes de confirmar. */
  campo?: { etiqueta: string; placeholder?: string; obligatorio?: boolean };
}

interface Abierta extends PedidoConfirmacion {
  resolver: (r: { ok: boolean; texto: string }) => void;
}

/** Confirmación contextual para acciones con consecuencias (rechazar, recibir, registrar mermas, cerrar turno). */
@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  readonly abierta = signal<Abierta | null>(null);

  pedir(p: PedidoConfirmacion): Promise<{ ok: boolean; texto: string }> {
    return new Promise((resolver) => this.abierta.set({ ...p, resolver }));
  }

  responder(ok: boolean, texto = ''): void {
    const actual = this.abierta();
    this.abierta.set(null);
    actual?.resolver({ ok, texto });
  }
}
