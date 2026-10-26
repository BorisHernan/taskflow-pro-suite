import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconoComponent } from '../shared/icono/icono.component';
import { CatalogoService } from './servicios/catalogo.service';
import { CarritoService } from './servicios/carrito.service';
import { TarjetaProductoComponent } from './tarjeta-producto/tarjeta-producto.component';
import { BotonCarritoComponent } from './boton-carrito/boton-carrito.component';
import { MapaSedesComponent } from '../shared/mapa/mapa-sedes.component';

type Orden = 'destacados' | 'precio-asc' | 'precio-desc' | 'valoracion' | 'stock';

const POR_PAGINA = 12;

/** Catálogo: filtros, orden y página viven en la URL (se pueden compartir y el "atrás" funciona). */
@Component({
  selector: 'app-store',
  standalone: true,
  imports: [FormsModule, RouterLink, IconoComponent, TarjetaProductoComponent, BotonCarritoComponent, MapaSedesComponent],
  templateUrl: './store.component.html',
  styleUrl: './store.component.scss',
})
export class StoreComponent implements OnInit {
  readonly catalogo = inject(CatalogoService);
  /** Panel con el mapa de las sedes. */
  readonly verMapa = signal(false);
  readonly sedeActual = computed(() => this.catalogo.tiendas().find((t) => t.id === this.catalogo.sede()) ?? null);
  private readonly carrito = inject(CarritoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly categoria = computed(() => this.params().get('cat') ?? '');
  readonly busqueda = computed(() => this.params().get('q') ?? '');
  readonly orden = computed(() => (this.params().get('orden') as Orden) ?? 'destacados');
  private readonly paginaPedida = computed(() => Math.max(1, Number(this.params().get('pag')) || 1));

  readonly stockMaximo = computed(() => Math.max(1, ...this.catalogo.productos().map((p) => p.stock)));

  readonly filtrados = computed(() => {
    const texto = normalizar(this.busqueda().trim());
    const cat = this.categoria();
    const notas = this.catalogo.valoraciones();
    const lista = this.catalogo
      .productos()
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !texto || normalizar(`${p.name} ${p.description ?? ''} ${p.category}`).includes(texto));

    switch (this.orden()) {
      case 'precio-asc':
        return [...lista].sort((a, b) => a.price - b.price);
      case 'precio-desc':
        return [...lista].sort((a, b) => b.price - a.price);
      case 'valoracion':
        return [...lista].sort((a, b) => (notas[b.id]?.average ?? 0) - (notas[a.id]?.average ?? 0));
      case 'stock':
        return [...lista].sort((a, b) => a.stock - b.stock);
      default:
        return lista;
    }
  });

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / POR_PAGINA)));
  readonly pagina = computed(() => Math.min(this.paginaPedida(), this.totalPaginas()));
  readonly visibles = computed(() => this.filtrados().slice((this.pagina() - 1) * POR_PAGINA, this.pagina() * POR_PAGINA));
  readonly paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i + 1));
  readonly rango = computed(() => {
    const total = this.filtrados().length;
    const desde = total === 0 ? 0 : (this.pagina() - 1) * POR_PAGINA + 1;
    return { desde, hasta: Math.min(total, this.pagina() * POR_PAGINA), total };
  });

  constructor() {
    // El carrito siempre con el stock más reciente.
    effect(() => this.carrito.sincronizar(this.catalogo.productos()));
  }

  ngOnInit(): void {
    this.catalogo.cargar();
    this.catalogo.vivo$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  /** Cambiar filtro u orden vuelve a la página 1; la búsqueda reemplaza la URL para no llenar el historial. */
  filtrar(cambios: { cat?: string; q?: string; orden?: Orden }): void {
    this.navegar({ ...this.estado(), ...cambios, pag: 1 }, cambios.q !== undefined);
  }

  irAPagina(n: number): void {
    // El router sube al inicio de la página (withInMemoryScrolling).
    this.navegar({ ...this.estado(), pag: n });
  }

  private estado() {
    return { cat: this.categoria(), q: this.busqueda(), orden: this.orden() };
  }

  private navegar(p: { cat: string; q: string; orden: Orden; pag: number }, reemplazar = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        cat: p.cat || null,
        q: p.q || null,
        orden: p.orden === 'destacados' ? null : p.orden,
        pag: p.pag > 1 ? p.pag : null,
      },
      replaceUrl: reemplazar,
    });
  }

  reintentar(): void {
    this.catalogo.cargar();
  }
}

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
