import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconoComponent } from '../icono/icono.component';
import { NombreIcono } from '../icono/iconos';

/**
 * Estados de una vista sin datos: cargando, vacío (con acción útil opcional)
 * o error recuperable con reintento. Nunca se deja el contenido en blanco.
 */
@Component({
  selector: 'app-estado-vista',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="estado-vista" [attr.data-tipo]="tipo()" [attr.role]="tipo() === 'error' ? 'alert' : 'status'">
      @if (tipo() === 'cargando') {
        <span class="girador" aria-hidden="true"></span>
      } @else {
        <span class="icono"><app-icono [nombre]="tipo() === 'error' ? 'error' : icono()" [tamano]="22" /></span>
      }
      <p class="titulo">{{ titulo() }}</p>
      @if (texto()) {
        <p class="texto">{{ texto() }}</p>
      }
      @if (tipo() === 'error') {
        <button type="button" class="btn btn-secondary btn-sm" (click)="reintentar.emit()">Reintentar</button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .estado-vista {
      display: grid;
      justify-items: center;
      gap: 6px;
      padding: 32px 16px;
      text-align: center;
    }
    .icono {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      margin-bottom: 4px;
      border-radius: 50%;
      background: var(--tf-surface-alt);
      color: var(--tf-text-secondary);
    }
    [data-tipo='error'] .icono {
      background: var(--tf-danger-bg);
      color: var(--tf-danger);
    }
    .titulo {
      margin: 0;
      font-weight: 600;
    }
    .texto {
      max-width: 52ch;
      margin: 0 0 6px;
      font-size: 14px;
      color: var(--tf-text-secondary);
    }
    .girador {
      width: 22px;
      height: 22px;
      margin-bottom: 4px;
      border: 2px solid var(--tf-border);
      border-top-color: var(--tf-primary);
      border-radius: 50%;
      animation: girar 0.8s linear infinite;
    }
    @keyframes girar {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .girador {
        animation-duration: 2.4s;
      }
    }
  `,
})
export class EstadoVistaComponent {
  readonly tipo = input<'cargando' | 'vacio' | 'error'>('vacio');
  readonly titulo = input.required<string>();
  readonly texto = input('');
  readonly icono = input<NombreIcono>('info');
  readonly reintentar = output<void>();
}
