import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Segmento } from './comun';

const R = 70;
const GROSOR = 22;

/** Partes de un todo. Pasar el mouse (o el foco) por la leyenda resalta el segmento. */
@Component({
  selector: 'app-grafico-dona',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dona">
      <svg viewBox="0 0 200 200" role="img" [attr.aria-label]="descripcion()">
        <circle class="pista" cx="100" cy="100" [attr.r]="r" [attr.stroke-width]="grosor" />
        @for (a of arcos(); track a.etiqueta) {
          <circle
            class="arco"
            [class.atenuado]="activo() !== null && activo() !== a.i"
            [class.resaltado]="activo() === a.i"
            cx="100"
            cy="100"
            [attr.r]="r"
            [style.stroke]="a.color"
            [attr.stroke-width]="grosor"
            pathLength="100"
            [attr.stroke-dasharray]="a.largo + ' ' + (100 - a.largo)"
            [attr.stroke-dashoffset]="-a.inicio"
            [style.animation-delay.ms]="a.i * 90"
            (mouseenter)="activo.set(a.i)"
            (mouseleave)="activo.set(null)"
          />
        }
        <text class="centro-valor" x="100" y="100" text-anchor="middle">{{ centro().valor }}</text>
        <text class="centro-etiqueta" x="100" y="120" text-anchor="middle">{{ centro().etiqueta }}</text>
      </svg>

      <ul class="leyenda">
        @for (a of arcos(); track a.etiqueta) {
          <li>
            <button
              type="button"
              [class.activo]="activo() === a.i"
              (mouseenter)="activo.set(a.i)"
              (mouseleave)="activo.set(null)"
              (focus)="activo.set(a.i)"
              (blur)="activo.set(null)"
            >
              <span class="muestra" [style.background]="a.color"></span>
              <span class="nombre">{{ a.etiqueta }}</span>
              <span class="pct">{{ a.porcentaje }} %</span>
            </button>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host { display: block; }
    .dona { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; justify-content: center; }
    svg { width: 180px; height: 180px; flex-shrink: 0; transform: rotate(-90deg); overflow: visible; }
    .pista { fill: none; stroke: var(--surface-alt); }
    .arco {
      fill: none;
      cursor: pointer;
      transition: opacity 0.2s var(--ease), stroke-width 0.2s var(--ease);
      animation: abrir 0.9s var(--ease) both;
    }
    .arco.atenuado { opacity: 0.3; }
    .arco.resaltado { stroke-width: 30; }
    text { transform: rotate(90deg); transform-origin: 100px 100px; }
    .centro-valor { fill: var(--text-primary); font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .centro-etiqueta { fill: var(--text-muted); font-size: 11px; }
    .leyenda { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; min-width: 170px; flex: 1; }
    .leyenda button {
      display: grid;
      grid-template-columns: 12px 1fr auto;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 8px;
      border: none;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--text-secondary);
      font: inherit;
      font-size: var(--fs-sm);
      text-align: left;
      cursor: default;
      transition: background-color 0.15s var(--ease);
    }
    .leyenda button.activo { background: var(--surface-hover); color: var(--text-primary); }
    .muestra { width: 12px; height: 12px; border-radius: 4px; }
    .pct { font-weight: 700; font-variant-numeric: tabular-nums; }
    @keyframes abrir { from { stroke-dasharray: 0 100; } }
    @media (prefers-reduced-motion: reduce) { .arco { animation: none; } }
  `,
})
export class GraficoDonaComponent {
  readonly segmentos = input<Segmento[]>([]);
  readonly etiquetaTotal = input('total');
  readonly formato = input<(n: number) => string>((n) => n.toLocaleString('es-PE'));
  readonly descripcion = input('Gráfico de dona');

  readonly r = R;
  readonly grosor = GROSOR;
  readonly activo = signal<number | null>(null);

  private readonly total = computed(() => this.segmentos().reduce((s, x) => s + x.valor, 0));

  readonly arcos = computed(() => {
    const total = this.total() || 1;
    let acumulado = 0;
    return this.segmentos().map((s, i) => {
      const largo = (s.valor / total) * 100;
      const arco = { ...s, i, inicio: acumulado, largo, porcentaje: Math.round(largo) };
      acumulado += largo;
      return arco;
    });
  });

  readonly centro = computed(() => {
    const i = this.activo();
    const a = i === null ? null : this.arcos()[i];
    return a
      ? { valor: this.formato()(a.valor), etiqueta: a.etiqueta }
      : { valor: this.formato()(this.total()), etiqueta: this.etiquetaTotal() };
  });
}
