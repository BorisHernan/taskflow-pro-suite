import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Punto, anchoDelHost, compacto, topeRedondo } from './comun';

const M = { arriba: 16, derecha: 12, abajo: 28, izquierda: 40 };

/**
 * Serie en el tiempo como área (tendencia) o barras (comparar días).
 * Se recorre con el mouse o con las flechas del teclado.
 */
@Component({
  selector: 'app-grafico-serie',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ancho() > 0) {
      <svg
        [attr.width]="ancho()"
        [attr.height]="alto()"
        role="img"
        tabindex="0"
        [attr.aria-label]="descripcion()"
        (mousemove)="mover($event)"
        (mouseleave)="activo.set(null)"
        (keydown)="teclado($event)"
        (blur)="activo.set(null)"
      >
        <defs>
          <linearGradient [attr.id]="idGradiente" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [style.stop-color]="color()" stop-opacity="0.35" />
            <stop offset="100%" [style.stop-color]="color()" stop-opacity="0" />
          </linearGradient>
        </defs>

        @for (t of ticks(); track t.valor) {
          <line class="rejilla" [attr.x1]="m.izquierda" [attr.x2]="ancho() - m.derecha" [attr.y1]="t.y" [attr.y2]="t.y" />
          <text class="eje" [attr.x]="m.izquierda - 8" [attr.y]="t.y + 4" text-anchor="end">{{ t.texto }}</text>
        }

        @for (e of etiquetasX(); track e.i) {
          <text class="eje" [attr.x]="e.x" [attr.y]="alto() - 8" text-anchor="middle">{{ e.texto }}</text>
        }

        @if (tipo() === 'area') {
          <path class="area" [attr.d]="area()" [attr.fill]="'url(#' + idGradiente + ')'" />
          <path class="linea" [attr.d]="linea()" [style.stroke]="color()" pathLength="1" />
        } @else {
          @for (b of barras(); track b.i) {
            <rect
              class="barra"
              [class.atenuada]="activo() !== null && activo() !== b.i"
              [attr.x]="b.x"
              [attr.y]="b.y"
              [attr.width]="b.ancho"
              [attr.height]="b.alto"
              rx="3"
              [style.fill]="color()"
              [style.animation-delay.ms]="b.i * 18"
            />
          }
        }

        @if (puntoActivo(); as p) {
          <line class="guia" [attr.x1]="p.x" [attr.x2]="p.x" [attr.y1]="m.arriba" [attr.y2]="alto() - m.abajo" />
          @if (tipo() === 'area') {
            <circle class="marca" [attr.cx]="p.x" [attr.cy]="p.y" r="5" [style.stroke]="color()" />
          }
        }
      </svg>

      @if (puntoActivo(); as p) {
        <div class="tooltip" [style.left.px]="p.x" [style.top.px]="p.y" role="status">
          <span>{{ p.punto.detalle ?? p.punto.etiqueta }}</span>
          <strong>{{ formato()(p.punto.valor) }}</strong>
        </div>
      }
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    svg { display: block; overflow: visible; border-radius: var(--radius); }
    svg:focus-visible { outline: 2px solid var(--seccion); outline-offset: 4px; }
    .rejilla { stroke: var(--border); stroke-dasharray: 3 4; }
    .eje { fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
    .linea {
      fill: none;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 1;
      animation: dibujar 1.2s var(--ease) forwards;
      stroke-dashoffset: 1;
    }
    .area { animation: aparecer 1.2s var(--ease) both; }
    .barra {
      transform-box: fill-box;
      transform-origin: bottom;
      animation: crecer 0.6s var(--ease) both;
      transition: opacity 0.2s var(--ease);
    }
    .barra.atenuada { opacity: 0.35; }
    .guia { stroke: var(--text-muted); stroke-dasharray: 2 3; pointer-events: none; }
    .marca { fill: var(--surface); stroke-width: 3; pointer-events: none; }
    .tooltip {
      position: absolute;
      z-index: 2;
      display: grid;
      gap: 2px;
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      background: var(--text-primary);
      color: var(--bg);
      font-size: var(--fs-xs);
      white-space: nowrap;
      pointer-events: none;
      transform: translate(-50%, calc(-100% - 12px));
      box-shadow: var(--shadow-md);
    }
    .tooltip strong { font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
    @keyframes dibujar { to { stroke-dashoffset: 0; } }
    @keyframes aparecer { from { opacity: 0; } }
    @keyframes crecer { from { transform: scaleY(0); } }
    @media (prefers-reduced-motion: reduce) {
      .linea, .area, .barra { animation: none; stroke-dashoffset: 0; }
    }
  `,
})
export class GraficoSerieComponent {
  readonly puntos = input<Punto[]>([]);
  readonly tipo = input<'area' | 'barras'>('area');
  readonly color = input('var(--seccion)');
  readonly alto = input(220);
  readonly formato = input<(n: number) => string>((n) => n.toLocaleString('es-PE'));
  readonly descripcion = input('Gráfico');

  readonly m = M;
  readonly ancho = anchoDelHost();
  readonly activo = signal<number | null>(null);
  readonly idGradiente = 'grad-' + Math.random().toString(36).slice(2, 8);

  private readonly tope = computed(() => topeRedondo(Math.max(0, ...this.puntos().map((p) => p.valor))));
  private readonly anchoUtil = computed(() => Math.max(1, this.ancho() - M.izquierda - M.derecha));
  private readonly altoUtil = computed(() => this.alto() - M.arriba - M.abajo);

  private readonly paso = computed(() => {
    const n = this.puntos().length;
    return this.tipo() === 'barras' ? this.anchoUtil() / Math.max(1, n) : this.anchoUtil() / Math.max(1, n - 1);
  });

  x(i: number): number {
    return this.tipo() === 'barras' ? M.izquierda + this.paso() * (i + 0.5) : M.izquierda + this.paso() * i;
  }

  y(valor: number): number {
    return M.arriba + this.altoUtil() * (1 - valor / this.tope());
  }

  readonly ticks = computed(() =>
    [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const valor = this.tope() * f;
      return { valor, y: this.y(valor), texto: compacto(valor) };
    }),
  );

  readonly etiquetasX = computed(() => {
    const n = this.puntos().length;
    const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(this.anchoUtil() / 70))));
    return this.puntos()
      .map((p, i) => ({ i, x: this.x(i), texto: p.etiqueta }))
      .filter((e) => e.i % cada === 0 || e.i === n - 1)
      .filter((e, k, lista) => k === lista.length - 1 || lista[k + 1].i - e.i >= cada * 0.6);
  });

  readonly linea = computed(() =>
    this.puntos().map((p, i) => `${i === 0 ? 'M' : 'L'}${this.x(i).toFixed(1)},${this.y(p.valor).toFixed(1)}`).join(' '),
  );

  readonly area = computed(() => {
    const n = this.puntos().length;
    if (n === 0) return '';
    const base = this.y(0);
    return `${this.linea()} L${this.x(n - 1).toFixed(1)},${base} L${this.x(0).toFixed(1)},${base} Z`;
  });

  readonly barras = computed(() => {
    const anchoBarra = Math.max(2, Math.min(28, this.paso() * 0.7));
    return this.puntos().map((p, i) => {
      const y = this.y(p.valor);
      return { i, x: this.x(i) - anchoBarra / 2, y, ancho: anchoBarra, alto: Math.max(0, this.y(0) - y) };
    });
  });

  readonly puntoActivo = computed(() => {
    const i = this.activo();
    const punto = i === null ? undefined : this.puntos()[i];
    return punto ? { punto, x: this.x(i!), y: this.y(punto.valor) } : null;
  });

  mover(evento: MouseEvent): void {
    const n = this.puntos().length;
    if (!n) return;
    const rect = (evento.currentTarget as SVGElement).getBoundingClientRect();
    const relativo = evento.clientX - rect.left - M.izquierda;
    const i = this.tipo() === 'barras' ? Math.floor(relativo / this.paso()) : Math.round(relativo / this.paso());
    this.activo.set(Math.min(n - 1, Math.max(0, i)));
  }

  teclado(evento: KeyboardEvent): void {
    const n = this.puntos().length;
    if (!n || (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight')) return;
    evento.preventDefault();
    const actual = this.activo() ?? (evento.key === 'ArrowLeft' ? n : -1);
    this.activo.set(Math.min(n - 1, Math.max(0, actual + (evento.key === 'ArrowRight' ? 1 : -1))));
  }
}
