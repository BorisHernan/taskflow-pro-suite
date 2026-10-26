import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { SesionService } from '../../auth/sesion.service';
import { IconoComponent } from '../icono/icono.component';
import { TourService } from './tour.service';
import { DemoBackend } from '../demo/demo-backend.service';
import { TelefonoService } from '../telefono/telefono-empleado.component';

interface Caja {
  top: number;
  left: number;
  width: number;
  height: number;
}

const MARGEN = 8;
const ANCHO_GLOBO = 340;
const ANCHO_CONSOLA = 340;
/** Los logs técnicos de la demo existen pero, por ahora, no se muestran en el recorrido. */
const MOSTRAR_LOGS_TECNICOS = false;

/**
 * Capa del recorrido: un foco que viaja de un elemento al siguiente (como una
 * cámara), un globo con el texto y la bienvenida que recomienda el recorrido.
 */
@Component({
  selector: 'app-tour',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tour.component.html',
  styleUrl: './tour.component.scss',
})
export class TourComponent {
  readonly tour = inject(TourService);
  readonly sesion = inject(SesionService);
  readonly demo = inject(DemoBackend);
  private readonly telefono = inject(TelefonoService);
  private readonly globo = viewChild<ElementRef<HTMLElement>>('globo');

  /** Posición del foco en la pantalla; se actualiza mientras se hace scroll. */
  readonly caja = signal<Caja | null>(null);

  readonly etiquetaTipo = { historia: 'HISTORIA', api: 'API', regla: 'REGLA', tarea: 'TAREA', sse: 'EN VIVO', aviso: 'AVISO' } as const;
  private readonly consola = viewChild<ElementRef<HTMLElement>>('consola');
  /** Los logs técnicos empiezan plegados; se abren con un botón. */
  readonly verLogs = signal(false);
  readonly mostrarLogs = MOSTRAR_LOGS_TECNICOS;
  readonly monitorEnfocado = computed(() => !!this.tour.elemento()?.classList.contains('otra-pantalla'));

  /** Opción del menú lateral de la pantalla actual (null si el menú no se ve, como en celular). */
  readonly menu = signal<(Caja & { texto: string }) | null>(null);

  /** El globo va debajo del elemento si cabe; si no, encima. En celular, abajo fijo. */
  readonly posicionGlobo = computed(() => {
    const c = this.caja();
    if (!c || innerWidth < 640) return null;
    const abajo = c.top + c.height + 14;
    const cabeAbajo = abajo + 280 < innerHeight;
    // Con el teléfono del empleado a la izquierda, el globo no lo tapa.
    const minimo = this.telefono.empleado() ? (innerWidth >= 1100 ? 340 : 270) : 16;
    const derecha = this.demo.activo() && (this.mostrarLogs || !!this.tour.escena()) && innerWidth >= 1200 ? ANCHO_CONSOLA : 0;
    const left = Math.min(Math.max(minimo, c.left), innerWidth - derecha - ANCHO_GLOBO - 16);
    // Con el monitor de otro usuario, el globo va a su izquierda para no tapar la pantalla ni el pie.
    if (this.tour.elemento()?.closest('.monitor') && c.left - ANCHO_GLOBO - 24 >= minimo) {
      return { top: Math.max(16, c.top + 40), left: c.left - ANCHO_GLOBO - 24 };
    }
    if (cabeAbajo) return { top: abajo, left };
    const arriba = c.top - 14 - 270;
    if (arriba >= 16) return { top: arriba, left };
    // Elemento muy alto: el globo va a un costado para no taparlo.
    const top = Math.min(Math.max(16, c.top + 24), innerHeight - 300);
    if (c.left - ANCHO_GLOBO - 16 >= minimo) return { top, left: c.left - ANCHO_GLOBO - 16 };
    if (c.left + c.width + 16 + ANCHO_GLOBO <= innerWidth - derecha - 16) return { top, left: c.left + c.width + 16 };
    return { top: Math.max(16, arriba), left };
  });

  constructor() {
    let marco = 0;
    const seguir = () => {
      const el = this.tour.elemento();
      if (el?.isConnected && el.getBoundingClientRect().width > 0) {
        const r = el.getBoundingClientRect();
        const nueva = { top: r.top - MARGEN, left: r.left - MARGEN, width: r.width + MARGEN * 2, height: r.height + MARGEN * 2 };
        const actual = this.caja();
        if (!actual || Object.keys(nueva).some((k) => Math.abs(nueva[k as keyof Caja] - actual[k as keyof Caja]) > 0.5)) {
          this.caja.set(nueva);
        }
      }
      this.seguirMenu();
      marco = requestAnimationFrame(seguir);
    };
    marco = requestAnimationFrame(seguir);
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(marco));

    // Al cambiar de paso, el foco pasa al globo para teclado y lector de pantalla.
    effect(() => {
      this.tour.indice();
      if (this.tour.elemento()) queueMicrotask(() => this.globo()?.nativeElement.focus());
    });
    effect(() => {
      if (!this.tour.activo()) this.caja.set(null);
    });
    // El registro baja solo a la última línea; con la consola abierta, la página le deja espacio.
    effect(() => {
      this.demo.registro();
      this.verLogs();
      const el = this.consola()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
    // La página solo se corre si se muestran los logs; el monitor de otro usuario va encima.
    effect(() => document.body.classList.toggle('con-consola', this.demo.activo() && this.mostrarLogs));
  }

  private seguirMenu(): void {
    const link = this.tour.activo() ? document.querySelector<HTMLElement>('a.en-recorrido') : null;
    const r = link?.getBoundingClientRect();
    if (!link || !r || r.width === 0 || r.right <= 0) {
      if (this.menu()) this.menu.set(null);
      return;
    }
    const actual = this.menu();
    if (!actual || Math.abs(actual.top - r.top) > 0.5 || Math.abs(actual.left - r.left) > 0.5 || actual.width !== r.width) {
      this.menu.set({ top: r.top, left: r.left, width: r.width, height: r.height, texto: link.innerText.trim() });
    }
  }

  @HostListener('document:keydown', ['$event'])
  teclado(e: KeyboardEvent): void {
    if (!this.tour.activo()) return;
    if (e.key === 'Escape') this.tour.salir();
    else if (e.key === 'ArrowRight') this.tour.siguiente();
    else if (e.key === 'ArrowLeft') this.tour.atras();
  }
}
