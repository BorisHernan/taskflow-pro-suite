import { DestroyRef, ElementRef, Signal, afterNextRender, inject, signal } from '@angular/core';

export interface Punto {
  etiqueta: string;
  /** Texto largo para el tooltip (p. ej. la fecha completa). */
  detalle?: string;
  valor: number;
}

export interface Segmento {
  etiqueta: string;
  valor: number;
  color: string;
}

/** Ancho real del host: los gráficos calculan en píxeles para que el texto no se deforme. */
export function anchoDelHost(): Signal<number> {
  const host = inject(ElementRef<HTMLElement>);
  const destroyRef = inject(DestroyRef);
  const ancho = signal(0);
  afterNextRender(() => {
    const obs = new ResizeObserver(([e]) => ancho.set(Math.floor(e.contentRect.width)));
    obs.observe(host.nativeElement);
    destroyRef.onDestroy(() => obs.disconnect());
  });
  return ancho;
}

/** Tope "redondo" para el eje Y (1, 2, 5 × 10ⁿ), con al menos `minimo`. */
export function topeRedondo(max: number, minimo = 4): number {
  const valor = Math.max(max, minimo);
  const exp = Math.pow(10, Math.floor(Math.log10(valor)));
  const f = valor / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

const COMPACTO = new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 });

export function compacto(n: number): string {
  return COMPACTO.format(n);
}
