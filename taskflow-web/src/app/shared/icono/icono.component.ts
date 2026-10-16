import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { IconNode } from 'lucide';
import { ICONOS, NombreIcono } from './iconos';

/** Icono SVG de lucide. Decorativo (aria-hidden): el texto accesible va en el botón o enlace que lo contiene. */
@Component({
  selector: 'app-icono',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      [attr.width]="tamano()"
      [attr.height]="tamano()"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="grosor()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (nodo of nodos(); track $index) {
        @switch (nodo[0]) {
          @case ('path') { <svg:path [attr.d]="nodo[1]['d']" /> }
          @case ('circle') { <svg:circle [attr.cx]="nodo[1]['cx']" [attr.cy]="nodo[1]['cy']" [attr.r]="nodo[1]['r']" /> }
          @case ('rect') {
            <svg:rect [attr.x]="nodo[1]['x']" [attr.y]="nodo[1]['y']" [attr.width]="nodo[1]['width']"
              [attr.height]="nodo[1]['height']" [attr.rx]="nodo[1]['rx']" [attr.ry]="nodo[1]['ry']" />
          }
          @case ('line') { <svg:line [attr.x1]="nodo[1]['x1']" [attr.y1]="nodo[1]['y1']" [attr.x2]="nodo[1]['x2']" [attr.y2]="nodo[1]['y2']" /> }
          @case ('polyline') { <svg:polyline [attr.points]="nodo[1]['points']" /> }
          @case ('polygon') { <svg:polygon [attr.points]="nodo[1]['points']" /> }
          @case ('ellipse') { <svg:ellipse [attr.cx]="nodo[1]['cx']" [attr.cy]="nodo[1]['cy']" [attr.rx]="nodo[1]['rx']" [attr.ry]="nodo[1]['ry']" /> }
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      line-height: 0;
    }
  `,
})
export class IconoComponent {
  readonly nombre = input<NombreIcono>();
  /** Icono de lucide pasado directo, para los que viven en un chunk lazy (p. ej. productos). */
  readonly icono = input<IconNode>();
  readonly tamano = input(18);
  readonly grosor = input(2);

  readonly nodos = computed(
    () => (this.icono() ?? ICONOS[this.nombre() ?? 'paquete']) as unknown as [string, Record<string, string>][],
  );
}
