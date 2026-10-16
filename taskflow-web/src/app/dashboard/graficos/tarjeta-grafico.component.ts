import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IconoComponent } from '../../shared/icono/icono.component';

/**
 * Marco de cada gráfico: título, una lectura automática ("lo importante") y un
 * panel "¿Cómo leerlo?" que explica qué se muestra y de dónde salen los datos.
 */
@Component({
  selector: 'app-tarjeta-grafico',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card tarjeta">
      <header>
        <div>
          <h2>{{ titulo() }}</h2>
          @if (subtitulo()) {
            <p class="subtitulo">{{ subtitulo() }}</p>
          }
        </div>
        <ng-content select="[acciones]" />
        <button
          type="button"
          class="btn btn-icon btn-sm ayuda-boton"
          [class.activo]="ayudaAbierta()"
          [attr.aria-expanded]="ayudaAbierta()"
          [attr.aria-label]="'Cómo leer: ' + titulo()"
          (click)="ayudaAbierta.set(!ayudaAbierta())"
        >
          <app-icono nombre="info" [tamano]="16" />
        </button>
      </header>

      @if (ayudaAbierta()) {
        <div class="ayuda">
          <p><strong>Qué muestra:</strong> {{ ayuda() }}</p>
          @if (comoLeer()) {
            <p><strong>Cómo leerlo:</strong> {{ comoLeer() }}</p>
          }
          @if (fuente()) {
            <p class="fuente"><app-icono nombre="baseDatos" [tamano]="13" /> {{ fuente() }}</p>
          }
        </div>
      }

      <div class="contenido"><ng-content /></div>

      @if (lectura()) {
        <p class="lectura"><app-icono nombre="chispas" [tamano]="14" /> {{ lectura() }}</p>
      }
    </article>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .tarjeta { display: flex; flex-direction: column; gap: 14px; height: 100%; padding: 20px; box-sizing: border-box; }
    header { display: flex; align-items: flex-start; gap: 10px; }
    header > div { flex: 1; min-width: 0; }
    h2 { margin: 0; font-size: var(--fs-base); }
    .subtitulo { margin: 2px 0 0; font-size: var(--fs-xs); color: var(--text-muted); }
    .ayuda-boton.activo { background: var(--seccion-suave); color: var(--seccion); }
    .ayuda {
      display: grid;
      gap: 6px;
      padding: 12px 14px;
      border-left: 3px solid var(--seccion);
      border-radius: var(--radius-sm);
      background: var(--seccion-suave);
      font-size: var(--fs-sm);
      line-height: 1.5;
      color: var(--text-secondary);
      animation: tf-entrar 0.25s var(--ease);
    }
    .ayuda p { margin: 0; }
    .ayuda strong { color: var(--text-primary); }
    .fuente { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; color: var(--seccion); opacity: 0.85; }
    .contenido { flex: 1; min-width: 0; }
    .lectura {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      padding-top: 12px;
      border-top: 1px dashed var(--border);
      font-size: var(--fs-sm);
      color: var(--text-secondary);
    }
    .lectura app-icono { margin-top: 2px; color: var(--seccion); }
  `,
})
export class TarjetaGraficoComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
  readonly ayuda = input.required<string>();
  readonly comoLeer = input('');
  readonly fuente = input('');
  readonly lectura = input('');

  readonly ayudaAbierta = signal(false);
}
