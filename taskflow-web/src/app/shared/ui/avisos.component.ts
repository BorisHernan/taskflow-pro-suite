import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconoComponent } from '../icono/icono.component';
import { AvisosService } from './avisos.service';

/** Pila de notificaciones abajo a la derecha. Los errores se anuncian como alerta para lectores de pantalla. */
@Component({
  selector: 'app-avisos',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pila" aria-live="polite">
      @for (a of avisos.avisos(); track a.id) {
        <div class="aviso" [class.error]="a.tipo === 'error'" [attr.role]="a.tipo === 'error' ? 'alert' : 'status'">
          <app-icono [nombre]="a.tipo === 'error' ? 'error' : 'hecho'" [tamano]="18" />
          <p>{{ a.texto }}</p>
          <button type="button" class="btn btn-icon btn-sm" (click)="avisos.cerrar(a.id)" aria-label="Cerrar aviso">
            <app-icono nombre="cerrar" [tamano]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .pila {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 80;
      display: grid;
      gap: 8px;
      width: min(400px, calc(100vw - 32px));
    }
    .aviso {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: start;
      gap: 10px;
      padding: 12px 8px 12px 14px;
      border: 1px solid var(--tf-border);
      border-left: 3px solid var(--tf-success);
      border-radius: var(--radius);
      background: var(--tf-surface);
      box-shadow: var(--tf-shadow-pop);
      animation: entra 0.18s var(--ease);
    }
    .aviso app-icono {
      margin-top: 1px;
      color: var(--tf-success);
    }
    .aviso.error {
      border-left-color: var(--tf-danger);
    }
    .aviso.error app-icono:first-child {
      color: var(--tf-danger);
    }
    p {
      margin: 0;
      font-size: 14px;
      line-height: 1.45;
    }
    @keyframes entra {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    @media (max-width: 640px) {
      .pila {
        right: 16px;
        bottom: 16px;
      }
    }
  `,
})
export class AvisosComponent {
  readonly avisos = inject(AvisosService);
}
