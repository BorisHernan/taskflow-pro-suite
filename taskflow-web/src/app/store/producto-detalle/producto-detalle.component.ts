import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { Review, STOCK_BAJO } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { SolesPipe } from '../../shared/soles.pipe';
import { IconoComponent } from '../../shared/icono/icono.component';
import { ProductIconComponent } from '../product-icon/product-icon.component';
import { EstrellasComponent } from '../estrellas/estrellas.component';
import { TarjetaProductoComponent } from '../tarjeta-producto/tarjeta-producto.component';
import { CatalogoService } from '../servicios/catalogo.service';
import { CarritoService, mensajeDeError } from '../servicios/carrito.service';
import { fotosDe } from '../fotos-productos';

const RESENAS_POR_PAGINA = 5;
const RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const FECHA = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short' });

/** El backend guarda LocalDateTime en UTC (sin zona): se interpreta como UTC. */
function aFecha(texto: string): Date {
  return new Date(/(Z|[+-]\d\d:\d\d)$/.test(texto) ? texto : texto + 'Z');
}

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [
    RouterLink, FormsModule, SolesPipe, IconoComponent, ProductIconComponent,
    EstrellasComponent, TarjetaProductoComponent,
  ],
  templateUrl: './producto-detalle.component.html',
  styleUrl: './producto-detalle.component.scss',
})
export class ProductoDetalleComponent implements OnInit {
  readonly catalogo = inject(CatalogoService);
  readonly carrito = inject(CarritoService);
  private readonly api = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => Number(p.get('id')))), { requireSync: true });
  readonly producto = computed(() => this.catalogo.producto(this.id()));
  readonly stockBajo = STOCK_BAJO;
  readonly fotos = computed(() => fotosDe(this.id()));
  /** Foto elegida en la galería (vuelve a la principal al cambiar de producto). */
  readonly fotoActual = signal(0);

  readonly cantidad = signal(1);
  readonly enCarrito = computed(() => this.carrito.cantidad(this.id()));
  readonly descuento = computed(() => {
    const p = this.producto();
    return p?.listPrice && p.listPrice > p.price ? Math.round((1 - p.price / p.listPrice) * 100) : 0;
  });
  readonly maximo = computed(() => Math.max(0, (this.producto()?.stock ?? 0) - this.enCarrito()));

  // Reseñas
  readonly resenas = signal<Review[]>([]);
  readonly cargandoResenas = signal(true);
  readonly filtroEstrellas = signal<number | null>(null);
  readonly paginaResenas = signal(1);

  readonly promedio = computed(() => {
    const r = this.resenas();
    return r.length ? r.reduce((s, x) => s + x.rating, 0) / r.length : 0;
  });

  /** Cuántas reseñas hay de 5, 4, 3, 2 y 1 estrellas (para las barras). */
  readonly distribucion = computed(() => {
    const total = this.resenas().length;
    return [5, 4, 3, 2, 1].map((estrellas) => {
      const cuenta = this.resenas().filter((r) => r.rating === estrellas).length;
      return { estrellas, cuenta, porcentaje: total ? Math.round((cuenta / total) * 100) : 0 };
    });
  });

  readonly resenasFiltradas = computed(() => {
    const f = this.filtroEstrellas();
    return f ? this.resenas().filter((r) => r.rating === f) : this.resenas();
  });
  readonly totalPaginasResenas = computed(() => Math.max(1, Math.ceil(this.resenasFiltradas().length / RESENAS_POR_PAGINA)));
  readonly resenasVisibles = computed(() => {
    const desde = (this.paginaResenas() - 1) * RESENAS_POR_PAGINA;
    return this.resenasFiltradas().slice(desde, desde + RESENAS_POR_PAGINA);
  });

  readonly relacionados = computed(() => {
    const actual = this.producto();
    if (!actual) return [];
    const otros = this.catalogo.productos().filter((p) => p.id !== actual.id);
    const misma = otros.filter((p) => p.category === actual.category);
    return [...misma, ...otros.filter((p) => p.category !== actual.category)].slice(0, 4);
  });

  // Formulario
  autor = '';
  comentario = '';
  readonly calificacion = signal(0);
  readonly calificacionHover = signal(0);
  readonly enviando = signal(false);
  readonly errorResena = signal<string | null>(null);
  readonly etiquetas = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

  constructor() {
    effect(() => {
      this.id();
      this.fotoActual.set(0);
    });
    // Al cambiar de producto (clic en un relacionado) se recargan sus reseñas.
    effect((onCleanup) => {
      const id = this.id();
      this.cantidad.set(1);
      this.filtroEstrellas.set(null);
      this.paginaResenas.set(1);
      this.cargandoResenas.set(true);
      const sub = this.api.getReviews(id).subscribe({
        next: (lista) => {
          this.resenas.set(lista);
          this.cargandoResenas.set(false);
        },
        error: () => {
          this.resenas.set([]);
          this.cargandoResenas.set(false);
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
    effect(() => this.carrito.sincronizar(this.catalogo.productos()));
  }

  ngOnInit(): void {
    this.catalogo.cargar();
    this.catalogo.vivo$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  cambiarCantidad(delta: number): void {
    this.cantidad.update((c) => Math.min(Math.max(1, c + delta), Math.max(1, this.maximo())));
  }

  agregar(abrirCarrito = false): void {
    const p = this.producto();
    if (!p) return;
    if (this.carrito.agregarYAvisar(p, this.cantidad())) {
      this.cantidad.set(1);
      if (abrirCarrito) this.carrito.abierto.set(true);
    }
  }

  filtrarPorEstrellas(estrellas: number): void {
    this.filtroEstrellas.update((actual) => (actual === estrellas ? null : estrellas));
    this.paginaResenas.set(1);
  }

  publicar(): void {
    const p = this.producto();
    if (!p || this.enviando()) return;
    if (this.calificacion() === 0) {
      this.errorResena.set('Elige de 1 a 5 estrellas.');
      return;
    }
    if (!this.autor.trim() || !this.comentario.trim()) {
      this.errorResena.set('Escribe tu nombre y un comentario.');
      return;
    }

    this.enviando.set(true);
    this.errorResena.set(null);
    this.api
      .addReview(p.id, { author: this.autor.trim(), rating: this.calificacion(), comment: this.comentario.trim() })
      .subscribe({
        next: (nueva) => {
          this.resenas.update((lista) => [nueva, ...lista]);
          this.filtroEstrellas.set(null);
          this.paginaResenas.set(1);
          this.comentario = '';
          this.calificacion.set(0);
          this.enviando.set(false);
          this.carrito.avisar('¡Gracias! Tu reseña ya es pública.');
          this.catalogo.recargarValoraciones();
        },
        error: (err) => {
          this.errorResena.set(mensajeDeError(err, 'No se pudo publicar la reseña. Intenta de nuevo.'));
          this.enviando.set(false);
        },
      });
  }

  irAResenas(): void {
    document.getElementById('resenas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** "hace 3 días", "ayer", "hace 5 minutos". */
  hace(fecha: string): string {
    const segundos = (aFecha(fecha).getTime() - Date.now()) / 1000;
    const pasos: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
    ];
    for (const [unidad, s] of pasos) {
      if (Math.abs(segundos) >= s) return RELATIVO.format(Math.round(segundos / s), unidad);
    }
    return 'hace un momento';
  }

  fechaCompleta(fecha: string): string {
    return FECHA.format(aFecha(fecha));
  }

  inicial(nombre: string): string {
    return nombre.trim().charAt(0).toUpperCase() || '?';
  }

  /** Color estable por autor para su avatar. */
  tono(nombre: string): number {
    let h = 0;
    for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }
}
