import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconoComponent } from '../shared/icono/icono.component';
import { CatalogoService } from './servicios/catalogo.service';
import { CarritoService } from './servicios/carrito.service';
import { TarjetaProductoComponent } from './tarjeta-producto/tarjeta-producto.component';
import { MapaSedesComponent } from '../shared/mapa/mapa-sedes.component';
import { ProductIconComponent } from './product-icon/product-icon.component';
import { PortadaTiendaComponent } from './portada-tienda/portada-tienda.component';
import { COLECCIONES, DEPARTAMENTOS, RANGOS_PRECIO } from './categorias';

type Orden = 'destacados' | 'precio-asc' | 'precio-desc' | 'valoracion' | 'stock';

interface Estado {
  cat: string;
  sub: string;
  q: string;
  orden: Orden;
  precio: string;
  marca: string;
  oferta: string;
  col: string;
}

const POR_PAGINA = 24;

/** Catálogo: filtros, orden y página viven en la URL (se pueden compartir y el "atrás" funciona). */
@Component({
  selector: 'app-store',
  standalone: true,
  imports: [FormsModule, RouterLink, IconoComponent, TarjetaProductoComponent, MapaSedesComponent, ProductIconComponent, PortadaTiendaComponent],
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
  readonly subcategoria = computed(() => this.params().get('sub') ?? '');
  readonly busqueda = computed(() => this.params().get('q') ?? '');
  readonly orden = computed(() => (this.params().get('orden') as Orden) ?? 'destacados');
  readonly precio = computed(() => this.params().get('precio') ?? '');
  readonly marca = computed(() => this.params().get('marca') ?? '');
  /** '2x1' = solo promociones 2×1; 'dscto' = solo con precio rebajado. */
  readonly oferta = computed(() => this.params().get('oferta') ?? '');
  /** Colección por momento de compra (desayuno, parrilla…): reúne subcategorías de varios departamentos. */
  readonly coleccion = computed(() => COLECCIONES.find((c) => c.id === this.params().get('col')) ?? null);
  private readonly paginaPedida = computed(() => Math.max(1, Number(this.params().get('pag')) || 1));

  /** Filtros laterales en el celular: se abren con un botón. */
  readonly filtrosAbiertos = signal(false);
  readonly rangos = RANGOS_PRECIO;
  readonly departamentos = DEPARTAMENTOS;
  readonly departamento = computed(() => DEPARTAMENTOS.find((d) => d.nombre === this.categoria()) ?? null);
  /** Sin ningún filtro en la URL se ve la pantalla principal (spots y filas por departamento); con alguno, el catálogo. */
  readonly portadaVisible = computed(() => this.params().keys.length === 0);
  readonly titulo = computed(() =>
    this.busqueda()
      ? `Resultados para “${this.busqueda()}”`
      : this.oferta() === '2x1'
        ? 'Ofertas 2 × 1'
        : this.oferta() === 'dscto'
          ? 'Ofertas de la semana'
          : this.coleccion()?.nombre || this.subcategoria() || this.categoria() || 'Todos los productos',
  );

  private readonly porTexto = computed(() => {
    const texto = normalizar(this.busqueda().trim());
    return this.catalogo
      .productos()
      .filter((p) => !texto || normalizar(`${p.name} ${p.description ?? ''} ${p.brand ?? ''} ${p.category} ${p.subcategory ?? ''}`).includes(texto));
  });
  private readonly enDepartamento = computed(() => this.porTexto().filter((p) => !this.categoria() || p.category === this.categoria()));
  private readonly enSubcategoria = computed(() =>
    this.enDepartamento()
      .filter((p) => !this.subcategoria() || p.subcategory === this.subcategoria())
      .filter((p) => !this.coleccion() || this.coleccion()!.subs.includes(p.subcategory ?? ''))
      .filter((p) => !this.oferta() || (this.oferta() === '2x1' ? p.promo === '2X1' : !!p.listPrice && p.listPrice > p.price)),
  );
  private readonly enPrecio = computed(() => {
    const r = RANGOS_PRECIO.find((x) => x.id === this.precio());
    return r ? this.enSubcategoria().filter((p) => p.price >= r.min && p.price < r.max) : this.enSubcategoria();
  });

  readonly conteoDepartamentos = computed(() => {
    const conteo = new Map<string, number>();
    for (const p of this.porTexto()) conteo.set(p.category, (conteo.get(p.category) ?? 0) + 1);
    return DEPARTAMENTOS.map((d) => ({ ...d, total: conteo.get(d.nombre) ?? 0 })).filter((d) => d.total > 0);
  });
  /** Subcategorías del departamento abierto, con su cantidad y el ícono de su primer producto. */
  readonly subcategorias = computed(() => {
    const d = this.departamento();
    if (!d) return [];
    const por = new Map<string, { total: number; icono: string }>();
    for (const p of this.enDepartamento()) {
      const clave = p.subcategory ?? '';
      const actual = por.get(clave) ?? { total: 0, icono: p.icon || d.icono };
      por.set(clave, { ...actual, total: actual.total + 1 });
    }
    return d.subs.filter((s) => por.has(s)).map((nombre) => ({ nombre, ...por.get(nombre)! }));
  });
  readonly marcas = computed(() => {
    const conteo = new Map<string, number>();
    for (const p of this.enPrecio()) if (p.brand) conteo.set(p.brand, (conteo.get(p.brand) ?? 0) + 1);
    return [...conteo]
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))
      .slice(0, 12);
  });
  readonly departamentoTotal = computed(() => this.enDepartamento().length);
  readonly hayFiltros = computed(() => !!(this.subcategoria() || this.precio() || this.marca() || this.oferta() || this.coleccion()));

  readonly filtrados = computed(() => {
    const notas = this.catalogo.valoraciones();
    const lista = this.enPrecio().filter((p) => !this.marca() || p.brand === this.marca());

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
  /** Páginas a mostrar: la primera, la última y las vecinas de la actual; el 0 es un salto ("…"). */
  readonly paginas = computed(() => {
    const total = this.totalPaginas();
    const actual = this.pagina();
    const visibles = [...new Set([1, total, ...[-2, -1, 0, 1, 2].map((d) => actual + d)])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    return visibles.flatMap((n, i) => (i > 0 && n - visibles[i - 1] > 1 ? [0, n] : [n]));
  });
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

  /** Cambiar filtro u orden vuelve a la página 1; un departamento nuevo limpia la subcategoría y la marca. */
  filtrar(cambios: Partial<Estado>): void {
    const nuevo: Estado = { ...this.estado(), ...cambios };
    if (cambios.cat !== undefined && cambios.cat !== this.categoria()) {
      nuevo.sub = cambios.sub ?? '';
      nuevo.marca = '';
    }
    this.navegar({ ...nuevo, pag: 1 }, cambios.q !== undefined);
  }

  limpiarFiltros(): void {
    this.filtrar({ sub: '', precio: '', marca: '', oferta: '', col: '' });
  }

  irAPagina(n: number): void {
    // El router sube al inicio de la página (withInMemoryScrolling).
    this.navegar({ ...this.estado(), pag: n });
  }

  private estado(): Estado {
    return { cat: this.categoria(), sub: this.subcategoria(), q: this.busqueda(), orden: this.orden(), precio: this.precio(), marca: this.marca(), oferta: this.oferta(), col: this.coleccion()?.id ?? '' };
  }

  private navegar(p: Estado & { pag: number }, reemplazar = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        cat: p.cat || null,
        sub: p.sub || null,
        q: p.q || null,
        orden: p.orden === 'destacados' ? null : p.orden,
        precio: p.precio || null,
        marca: p.marca || null,
        oferta: p.oferta || null,
        col: p.col || null,
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
