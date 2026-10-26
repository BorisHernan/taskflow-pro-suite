import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { IconoComponent } from '../icono/icono.component';
import { NombreIcono } from '../icono/iconos';

/** Botón de tema: recorre claro, oscuro y sistema, y dice en cuál está. */
@Component({
  selector: 'app-selector-tema',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn btn-ghost btn-sm selector" (click)="tema.toggle()"
      [attr.aria-label]="tema.etiqueta() + '. Pulsa para cambiar.'" [title]="tema.etiqueta()">
      <app-icono [nombre]="icono()" [tamano]="16" />
      <span class="texto">{{ corto() }}</span>
    </button>
  `,
  styles: `
    .selector {
      border: 1px solid var(--tf-border);
    }
    @media (max-width: 640px) {
      .texto {
        display: none;
      }
    }
  `,
})
export class SelectorTemaComponent {
  readonly tema = inject(ThemeService);
  readonly icono = computed<NombreIcono>(() => ({ light: 'sol', dark: 'luna', system: 'sistema' } as const)[this.tema.preference()]);
  readonly corto = computed(() => ({ light: 'Claro', dark: 'Oscuro', system: 'Sistema' })[this.tema.preference()]);
}
