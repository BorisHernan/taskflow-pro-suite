import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, share, switchMap, tap, timer } from 'rxjs';
import { Tienda } from '../../models/gestion.model';
import { Product, RatingSummary } from '../../models/product.model';
import { ProductService } from '../../services/product.service';

/**
 * Catálogo compartido entre el listado y el detalle: se carga una vez y el SSE
 * lo mantiene al día, sin reconectar al pasar de una página a otra.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly api = inject(ProductService);

  /** Sede donde compra el visitante: el stock que ve y el que se descuenta son los de esa tienda. */
  readonly sede = signal<number>(leerSede());
  readonly tiendas = toSignal(this.api.getTiendas().pipe(catchError(() => of([] as Tienda[]))), { initialValue: [] as Tienda[] });
  readonly nombreSede = computed(() => this.tiendas().find((t) => t.id === this.sede())?.nombre ?? '');

  readonly productos = signal<Product[]>([]);
  readonly valoraciones = signal<Record<number, RatingSummary>>({});
  readonly enVivo = signal(false);
  readonly error = signal<string | null>(null);
  readonly cargado = computed(() => this.productos().length > 0);

  readonly categorias = computed(() => {
    const conteo = new Map<string, number>();
    for (const p of this.productos()) conteo.set(p.category, (conteo.get(p.category) ?? 0) + 1);
    return [...conteo]
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  /** Abierto mientras alguna página de la tienda lo use (y 5 s más, para el cambio de página). */
  readonly vivo$: Observable<Product> = toObservable(this.sede).pipe(
    switchMap((tienda) => this.api.streamUpdates(tienda)),
    tap((actualizado) => {
      this.enVivo.set(true);
      this.productos.update((lista) => lista.map((p) => (p.id === actualizado.id ? actualizado : p)));
    }),
    share({ resetOnRefCountZero: () => timer(5000) }),
  );

  elegirSede(id: number): void {
    if (id === this.sede()) return;
    this.sede.set(id);
    try {
      localStorage.setItem(CLAVE_SEDE, String(id));
    } catch {}
    this.productos.set([]);
    this.enVivo.set(false);
    this.cargar();
  }

  cargar(): void {
    if (this.cargado()) return;
    this.api.getAll(this.sede()).subscribe({
      next: (lista) => {
        this.productos.set(lista);
        this.error.set(null);
      },
      error: () => this.error.set('No se pudo cargar el catálogo. El servidor puede estar despertando: reintenta en un minuto.'),
    });
    this.recargarValoraciones();
  }

  recargarValoraciones(): void {
    this.api.getRatings().subscribe({
      next: (lista) => this.valoraciones.set(Object.fromEntries(lista.map((r) => [r.productId, r]))),
      error: () => {},
    });
  }

  producto(id: number): Product | undefined {
    return this.productos().find((p) => p.id === id);
  }
}

const CLAVE_SEDE = 'taskflow-sede';

function leerSede(): number {
  try {
    return Number(localStorage.getItem(CLAVE_SEDE)) || 1;
  } catch {
    return 1;
  }
}
