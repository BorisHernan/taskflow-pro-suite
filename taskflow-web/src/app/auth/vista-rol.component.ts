import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

/** Zona de la captura (en píxeles de la imagen original de 1440 × 900). */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ANCHO = 1440;
const ALTO = 900;
const MARGEN = 40;

/**
 * Captura real con "cámara": sin zona activa muestra la pantalla completa;
 * con una zona, se acerca hasta encuadrarla y la marca con un recuadro.
 */
@Component({
  selector: 'app-vista-rol',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lienzo" [style.transform]="transformacion()">
      <img [src]="imagen()" [alt]="alt()" width="1440" height="900" />
      @if (zona(); as z) {
        <span class="marca" [style.left.px]="z.x" [style.top.px]="z.y" [style.width.px]="z.w" [style.height.px]="z.h"></span>
      }
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      aspect-ratio: 16 / 7;
      background: var(--tf-surface-alt);
    }
    .lienzo {
      position: absolute;
      top: 0;
      left: 0;
      width: 1440px;
      height: 900px;
      transform-origin: 0 0;
      transition: transform 0.9s cubic-bezier(0.65, 0, 0.35, 1);
    }
    img {
      display: block;
      width: 1440px;
      height: 900px;
    }
    .marca {
      position: absolute;
      border: 3px solid var(--tf-primary);
      border-radius: 10px;
      box-shadow: 0 0 0 9999px rgb(16 24 22 / 0.28);
      animation: aparece 0.5s ease 0.5s both;
    }
    @keyframes aparece {
      from {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .lienzo {
        transition: none;
      }
      .marca {
        animation: none;
      }
    }
  `,
})
export class VistaRolComponent {
  readonly imagen = input.required<string>();
  readonly alt = input.required<string>();
  readonly zona = input<Region | null>(null);

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly tamano = signal({ w: 0, h: 0 });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement as HTMLElement;
      const medir = () => this.tamano.set({ w: el.clientWidth, h: el.clientHeight });
      const observador = new ResizeObserver(medir);
      observador.observe(el);
      medir();
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  /** Escala y desplazamiento para encuadrar la zona (o toda la pantalla, arriba a la izquierda). */
  readonly transformacion = computed(() => {
    const { w, h } = this.tamano();
    if (!w) return 'scale(0.3)';
    const base = w / ANCHO;
    const z = this.zona();
    if (!z) return `translate(0px, 0px) scale(${base})`;
    const s = Math.max(base, Math.min(w / (z.w + MARGEN * 2), h / (z.h + MARGEN * 2), base * 2.6));
    const cx = z.x + z.w / 2;
    const cy = z.y + z.h / 2;
    // Centra la zona sin mostrar fuera de los bordes de la captura.
    const tx = Math.min(0, Math.max(w - ANCHO * s, w / 2 - cx * s));
    const ty = Math.min(0, Math.max(h - ALTO * s, h / 2 - cy * s));
    return `translate(${tx}px, ${ty}px) scale(${s})`;
  });
}
