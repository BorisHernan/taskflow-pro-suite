import { ChangeDetectionStrategy, Component, ElementRef, Injectable, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/** Quién usa el monitor (otro usuario de la tienda) y en qué equipo. */
export interface UsuarioMonitor {
  nombre: string;
  rol: string;
  equipo: string;
}

/** La app real se dibuja a 1440 × 900 y se reduce para entrar en la pantalla del monitor. */
const ANCHO_APP = 1440;
const ALTO_APP = 900;
const ANCHO_PANTALLA = 720;
const ALTO_PANTALLA = 450;
const BASE = ANCHO_PANTALLA / ANCHO_APP;
const ZOOM = 0.78;

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Monitor del recorrido: la aplicación real corriendo en la "computadora" de otra persona.
 * El recorrido la maneja como lo haría esa persona (clics, escritura, opciones) mientras una
 * cámara se acerca a la zona donde trabaja. Comparte la sede de prueba con la ventana principal.
 */
@Injectable({ providedIn: 'root' })
export class MonitorService {
  /** La app del monitor se carga al empezar la demo, para que abra al instante. */
  readonly montado = signal(false);
  readonly visible = signal(false);
  readonly usuario = signal<UsuarioMonitor | null>(null);
  readonly camara = signal({ z: BASE, x: 0, y: 0 });
  readonly cursor = signal<{ x: number; y: number; clic: boolean } | null>(null);
  marco: HTMLIFrameElement | null = null;

  montar(): void {
    this.montado.set(true);
  }

  desmontar(): void {
    this.cerrar();
    this.montado.set(false);
    this.marco = null;
  }

  async abrir(u: UsuarioMonitor, ruta: string): Promise<void> {
    this.usuario.set(u);
    this.cursor.set(null);
    this.camara.set({ z: BASE, x: 0, y: 0 });
    await this.listo();
    await this.ir(ruta);
    this.visible.set(true);
    await pausa(700);
  }

  cerrar(): void {
    this.visible.set(false);
    this.cursor.set(null);
  }

  async ir(ruta: string): Promise<void> {
    const w = this.ventana();
    await w?.__tfNavegar?.(ruta);
    await pausa(900);
    this.camara.set({ z: BASE, x: 0, y: 0 });
  }

  /** Clic real sobre un elemento de la app del monitor, con el puntero y la cámara acompañando. */
  async clic(selector: string, indice = 0): Promise<void> {
    const el = await this.apuntar(selector, indice);
    if (!el) return;
    this.marcarClic();
    el.click();
    await pausa(450);
  }

  /** Escribe en un campo real, letra por letra (dispara los mismos eventos que el teclado). */
  async escribir(selector: string, texto: string): Promise<void> {
    const el = (await this.apuntar(selector)) as HTMLInputElement | null;
    if (!el) return;
    this.marcarClic();
    el.focus();
    const Evento = (this.ventana() as any).Event as typeof Event;
    for (let n = 1; n <= texto.length; n++) {
      el.value = texto.slice(0, n);
      el.dispatchEvent(new Evento('input', { bubbles: true }));
      await pausa(45);
    }
    await pausa(250);
  }

  /** Elige la opción de un desplegable real por su texto. */
  async elegir(selector: string, textoOpcion: string): Promise<void> {
    const el = (await this.apuntar(selector)) as HTMLSelectElement | null;
    if (!el) return;
    this.marcarClic();
    await pausa(250);
    const i = [...el.options].findIndex((o) => o.textContent?.includes(textoOpcion));
    if (i < 0) return;
    el.selectedIndex = i;
    const Evento = (this.ventana() as any).Event as typeof Event;
    el.dispatchEvent(new Evento('change', { bubbles: true }));
    await pausa(450);
  }

  /** Espera a que el elemento exista en la app del monitor. */
  async esperar(selector: string, maxMs = 6000, indice = 0): Promise<HTMLElement | null> {
    const inicio = performance.now();
    while (performance.now() - inicio < maxMs) {
      const el = this.marco?.contentDocument?.querySelectorAll<HTMLElement>(selector)[indice];
      if (el && el.getBoundingClientRect().width > 0) return el;
      await pausa(120);
    }
    return null;
  }

  private async apuntar(selector: string, indice = 0): Promise<HTMLElement | null> {
    const el = await this.esperar(selector, 6000, indice);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // La cámara se acerca a la zona, sin salirse de la pantalla de la app.
    const x = Math.min(0, Math.max(ANCHO_PANTALLA - ANCHO_APP * ZOOM, ANCHO_PANTALLA / 2 - cx * ZOOM));
    const y = Math.min(0, Math.max(ALTO_PANTALLA - ALTO_APP * ZOOM, ALTO_PANTALLA / 2 - cy * ZOOM));
    this.camara.set({ z: ZOOM, x, y });
    await pausa(550);
    this.cursor.set({ x: cx * ZOOM + x, y: cy * ZOOM + y, clic: false });
    await pausa(600);
    return el;
  }

  private marcarClic(): void {
    const c = this.cursor();
    if (!c) return;
    this.cursor.set({ ...c, clic: true });
    setTimeout(() => this.cursor() && this.cursor.set({ ...this.cursor()!, clic: false }), 350);
  }

  private ventana(): (Window & { __tfNavegar?: (url: string) => Promise<boolean> }) | null {
    return (this.marco?.contentWindow as any) ?? null;
  }

  /** Espera a que la app del monitor haya arrancado. */
  private async listo(): Promise<void> {
    for (let i = 0; i < 80 && !this.ventana()?.__tfNavegar; i++) await pausa(150);
  }
}

@Component({
  selector: 'app-monitor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (monitor.montado()) {
      <div class="monitor" [class.visible]="monitor.visible()" [attr.aria-hidden]="!monitor.visible()">
        @if (monitor.usuario(); as u) {
          <p class="monitor-quien"><span class="punto"></span>Pantalla de {{ u.nombre }} · {{ u.rol }}</p>
        }
        <div class="bisel">
          <div class="monitor-pantalla">
            <iframe #marco [src]="url" title="Pantalla de otro usuario" tabindex="-1" [style.transform]="transformacion()"></iframe>
            @if (monitor.cursor(); as c) {
              <span class="puntero" [class.clic]="c.clic" [style.left.px]="c.x" [style.top.px]="c.y">
                <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 3l7 17 2.5-7.5L21 10z" fill="#fff" stroke="#0b6b62" stroke-width="1.6" stroke-linejoin="round" /></svg>
              </span>
            }
          </div>
          <p class="bisel-pie">
            <span class="led"></span><span></span><span></span>
            @if (monitor.usuario(); as u) {
              <small>{{ u.equipo }} · TaskFlow</small>
            }
          </p>
        </div>
        <div class="cuello"></div>
        <div class="pie"></div>
      </div>
    }
  `,
  styleUrl: './monitor.component.scss',
})
export class MonitorComponent {
  readonly monitor = inject(MonitorService);
  /** La app real en modo monitor; arranca en la gestión y la ventana principal la navega. */
  readonly url = inject(DomSanitizer).bypassSecurityTrustResourceUrl('/gestion/operaciones?monitor=1');
  private readonly marco = viewChild<ElementRef<HTMLIFrameElement>>('marco');
  readonly transformacion = computed(() => {
    const c = this.monitor.camara();
    return `translate(${c.x}px, ${c.y}px) scale(${c.z})`;
  });

  constructor() {
    effect(() => {
      this.monitor.marco = this.marco()?.nativeElement ?? null;
    });
  }
}
