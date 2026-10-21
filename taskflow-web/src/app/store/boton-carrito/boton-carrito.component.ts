import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { SolesPipe } from '../../shared/soles.pipe';
import { IconoComponent } from '../../shared/icono/icono.component';
import { CarritoPanelComponent } from '../carrito-panel/carrito-panel.component';
import { CarritoService } from '../servicios/carrito.service';

/** Botón del carrito de la cabecera + el panel lateral y el aviso flotante de la tienda. */
@Component({
  selector: 'app-boton-carrito',
  standalone: true,
  imports: [SolesPipe, IconoComponent, CarritoPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn btn-secondary boton"
      [class.salta]="salta()"
      (click)="carrito.abierto.set(true)"
      [attr.aria-label]="'Abrir el carrito, ' + carrito.unidades() + ' productos'"
    >
      <span class="icono">
        <app-icono nombre="carrito" [tamano]="18" />
        @if (carrito.unidades() > 0) {
          <span class="contador">{{ carrito.unidades() }}</span>
        }
      </span>
      <span class="texto">{{ carrito.unidades() > 0 ? (carrito.total() | soles) : 'Carrito' }}</span>
    </button>

    <app-carrito-panel />

    @if (carrito.aviso(); as a) {
      <div class="toast aviso" [class.aviso-error]="a.error" role="status">
        <app-icono [nombre]="a.error ? 'alerta' : 'check'" [tamano]="16" />
        <span>{{ a.texto }}</span>
        @if (!a.error) {
          <button type="button" class="btn btn-sm" (click)="carrito.abierto.set(true)">Ver carrito</button>
        }
      </div>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .boton { gap: 16px; font-variant-numeric: tabular-nums; }
    .icono { position: relative; display: inline-flex; color: var(--seccion); }
    .contador {
      position: absolute;
      top: -8px;
      right: -10px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 999px;
      background: var(--seccion);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
      text-align: center;
    }
    .salta { animation: salto 0.45s var(--ease); }
    .salta .contador { animation: pop 0.45s var(--ease); }
    @keyframes salto {
      30% { transform: translateY(-4px) scale(1.04); }
      60% { transform: translateY(1px); }
    }
    @keyframes pop {
      40% { transform: scale(1.45); }
    }
    .aviso-error { background: var(--danger); color: #fff; }
    @media (prefers-reduced-motion: reduce) {
      .salta, .salta .contador { animation: none; }
    }
  `,
})
export class BotonCarritoComponent {
  readonly carrito = inject(CarritoService);
  readonly salta = signal(false);

  constructor() {
    let anterior = untracked(this.carrito.pulso);
    effect((onCleanup) => {
      const pulso = this.carrito.pulso();
      if (pulso === anterior) return;
      anterior = pulso;
      this.salta.set(false);
      // Un frame después, para que la animación se reinicie aunque se agregue seguido.
      const t = setTimeout(() => this.salta.set(true), 16);
      const fin = setTimeout(() => this.salta.set(false), 500);
      onCleanup(() => {
        clearTimeout(t);
        clearTimeout(fin);
      });
    });
  }
}
