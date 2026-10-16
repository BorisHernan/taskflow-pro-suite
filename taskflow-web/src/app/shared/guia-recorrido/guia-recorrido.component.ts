import { Component, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { RECORRIDO, urlArchivo } from '../recorrido';
import { RegistroEventosService } from '../registro-eventos.service';

/**
 * Barra "Paso n de 4" en cada demo (qué probar aquí y a dónde ir después) y
 * el panel "Cómo está hecho" con los mensajes reales que viajan y el código.
 */
@Component({
  selector: 'app-guia-recorrido',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './guia-recorrido.component.html',
  styleUrl: './guia-recorrido.component.scss',
})
export class GuiaRecorridoComponent {
  private readonly router = inject(Router);
  private readonly registro = inject(RegistroEventosService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly total = RECORRIDO.length;
  readonly urlArchivo = urlArchivo;

  readonly indice = computed(() => {
    const ruta = this.url().split(/[?#]/)[0];
    return RECORRIDO.findIndex((p) => p.ruta === ruta);
  });

  readonly paso = computed(() => RECORRIDO[this.indice()] ?? null);
  readonly anterior = computed(() => RECORRIDO[this.indice() - 1] ?? null);
  readonly siguiente = computed(() => RECORRIDO[this.indice() + 1] ?? null);

  readonly mensajes = computed(() => {
    const demo = this.paso()?.demo;
    return demo ? this.registro.eventos().filter((e) => e.demo === demo).slice(0, 25) : [];
  });

  panelAbierto = signal(false);
  private readonly tituloPanel = viewChild<ElementRef<HTMLElement>>('tituloPanel');
  private readonly botonPanel = viewChild<ElementRef<HTMLButtonElement>>('botonPanel');

  constructor() {
    // Al abrir, el foco va al título del panel para que el teclado y el lector lo encuentren.
    effect(() => {
      if (this.panelAbierto()) this.tituloPanel()?.nativeElement.focus();
    });
    // Al cambiar de demo el panel se cierra: su contenido ya no correspondería.
    effect(() => {
      this.indice();
      this.panelAbierto.set(false);
    });
  }

  alternarPanel(): void {
    this.panelAbierto.update((v) => !v);
  }

  cerrarPanel(): void {
    if (!this.panelAbierto()) return;
    this.panelAbierto.set(false);
    this.botonPanel()?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  alEscape(): void {
    this.cerrarPanel();
  }
}
