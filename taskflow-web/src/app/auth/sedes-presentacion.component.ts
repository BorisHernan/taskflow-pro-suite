import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Tienda } from '../models/gestion.model';
import { ProductService } from '../services/product.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { MapaSedesComponent } from '../shared/mapa/mapa-sedes.component';

const ENCARGADOS: Record<string, string> = { T01: 'Luis Quispe', T02: 'María Rojas', T03: 'Carlos Díaz' };

interface FichaSede {
  tienda: Tienda;
  encargado: string;
  productos: number;
  exclusivos: number;
}

/** Las tres sedes: dónde están, en qué se diferencian y quién ve qué. Datos reales de la API pública. */
@Component({
  selector: 'app-sedes-presentacion',
  standalone: true,
  imports: [IconoComponent, MapaSedesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sedes-presentacion.component.html',
  styleUrl: './sedes-presentacion.component.scss',
})
export class SedesPresentacionComponent {
  private readonly api = inject(ProductService);

  readonly fichas = toSignal(
    this.api.getTiendas().pipe(
      switchMap((tiendas) =>
        forkJoin(tiendas.map((t) => this.api.getAll(t.id).pipe(catchError(() => of([]))))).pipe(
          map((catalogos) => {
            const nombres = catalogos.map((c) => new Set(c.map((p) => p.name)));
            return tiendas.map<FichaSede>((t, i) => ({
              tienda: t,
              encargado: ENCARGADOS[t.codigo] ?? '',
              productos: nombres[i].size,
              // Exclusivo: no lo vende ninguna otra sede.
              exclusivos: [...nombres[i]].filter((n) => nombres.every((otra, j) => j === i || !otra.has(n))).length,
            }));
          }),
        ),
      ),
      catchError(() => of([] as FichaSede[])),
    ),
    { initialValue: [] as FichaSede[] },
  );

  readonly tiendas = computed(() => this.fichas().map((f) => f.tienda));
  readonly seleccionada = signal<number | null>(null);
}
