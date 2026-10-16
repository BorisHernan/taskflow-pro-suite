import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { RECORRIDO } from '../recorrido';

/** Barra "Paso n de 4" en cada demo: qué probar aquí y a dónde ir después. */
@Component({
  selector: 'app-guia-recorrido',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './guia-recorrido.component.html',
  styleUrl: './guia-recorrido.component.scss',
})
export class GuiaRecorridoComponent {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly total = RECORRIDO.length;

  readonly indice = computed(() => {
    const ruta = this.url().split(/[?#]/)[0];
    return RECORRIDO.findIndex((p) => p.ruta === ruta);
  });

  readonly paso = computed(() => RECORRIDO[this.indice()] ?? null);
  readonly anterior = computed(() => RECORRIDO[this.indice() - 1] ?? null);
  readonly siguiente = computed(() => RECORRIDO[this.indice() + 1] ?? null);
}
