import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconoComponent } from '../../shared/icono/icono.component';

/** Cinco estrellas con relleno parcial (4,3 pinta 4 estrellas y un tercio de la quinta). */
@Component({
  selector: 'app-estrellas',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="estrellas" role="img" [attr.aria-label]="etiqueta()">
      <span class="fondo" aria-hidden="true">
        @for (n of cinco; track n) { <app-icono nombre="estrella" [tamano]="tamano()" /> }
      </span>
      <span class="relleno" aria-hidden="true" [style.width.%]="porcentaje()">
        @for (n of cinco; track n) { <app-icono nombre="estrella" [tamano]="tamano()" /> }
      </span>
    </span>
  `,
  styles: `
    :host { display: inline-flex; vertical-align: middle; }
    .estrellas { position: relative; display: inline-flex; line-height: 0; }
    .fondo, .relleno { display: inline-flex; gap: 1px; }
    .fondo { color: var(--border-strong); }
    .relleno {
      position: absolute;
      inset: 0 auto 0 0;
      overflow: hidden;
      color: #f59e0b;
      transition: width 0.4s var(--ease);
    }
    .relleno ::ng-deep svg { fill: currentColor; flex-shrink: 0; }
  `,
})
export class EstrellasComponent {
  readonly valor = input(0);
  readonly tamano = input(14);

  readonly cinco = [1, 2, 3, 4, 5];
  readonly porcentaje = computed(() => Math.max(0, Math.min(5, this.valor())) * 20);
  readonly etiqueta = computed(() => `${this.valor().toLocaleString('es-PE', { maximumFractionDigits: 1 })} de 5 estrellas`);
}
