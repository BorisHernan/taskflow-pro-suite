import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmacionService } from './confirmacion.service';

/** Diálogo nativo (<dialog>): foco atrapado, Escape para cancelar y fondo inerte sin código extra. */
@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialogo aria-labelledby="confirmacion-titulo" (cancel)="$event.preventDefault(); servicio.responder(false)">
      @if (servicio.abierta(); as c) {
        <form method="dialog" (ngSubmit)="aceptar()">
          <h2 id="confirmacion-titulo">{{ c.titulo }}</h2>
          <p class="detalle">{{ c.detalle }}</p>
          @if (c.campo) {
            <label class="campo">
              {{ c.campo.etiqueta }}{{ c.campo.obligatorio ? '' : ' (opcional)' }}
              <textarea class="input" name="texto" rows="3" maxlength="500" [(ngModel)]="texto" [placeholder]="c.campo.placeholder ?? ''"></textarea>
            </label>
          }
          <div class="botones">
            <button type="button" class="btn btn-secondary" (click)="servicio.responder(false)">Cancelar</button>
            <button type="submit" class="btn" [class.btn-primary]="!c.peligro" [class.btn-peligro]="c.peligro"
              [disabled]="!!c.campo?.obligatorio && !texto.trim()">
              {{ c.confirmar }}
            </button>
          </div>
        </form>
      }
    </dialog>
  `,
  styles: `
    dialog {
      width: min(480px, calc(100vw - 32px));
      padding: 24px;
      border: 1px solid var(--tf-border);
      border-radius: 14px;
      background: var(--tf-surface);
      color: var(--tf-text);
      box-shadow: var(--tf-shadow-pop);
    }
    dialog::backdrop {
      background: rgb(16 24 22 / 0.5);
    }
    h2 {
      margin: 0;
      font-size: 18px;
    }
    .detalle {
      margin: 8px 0 0;
      font-size: 14px;
      line-height: 1.55;
      color: var(--tf-text-secondary);
    }
    .campo {
      margin-top: 16px;
    }
    .botones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 20px;
    }
  `,
})
export class ConfirmacionComponent {
  readonly servicio = inject(ConfirmacionService);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  texto = '';

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.servicio.abierta()) {
        this.texto = '';
        if (!d.open) d.showModal();
      } else if (d.open) {
        d.close();
      }
    });
  }

  aceptar(): void {
    this.servicio.responder(true, this.texto.trim());
  }
}
