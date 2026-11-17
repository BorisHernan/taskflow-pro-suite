import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, RatingSummary } from '../../models/product.model';
import { IconoComponent } from '../../shared/icono/icono.component';
import { SolesPipe } from '../../shared/soles.pipe';
import { COLECCIONES, DEPARTAMENTOS } from '../categorias';
import { ProductIconComponent } from '../product-icon/product-icon.component';
import { RielProductosComponent } from '../riel-productos/riel-productos.component';
import { CarritoService } from '../servicios/carrito.service';

type Rect = [number, number, number, number];

/** Diseño pintado de un tema (2000 × 590 px): dónde van los productos y el botón, y los colores que los acompañan. */
interface Lienzo {
  fichas: Rect;
  n: number;
  hueco: number;
  boton: Rect;
  /** Parte izquierda de la imagen que se ve en pantallas angostas (donde está el texto pintado). */
  corte: number;
  tarjeta: string;
  pildora: string;
  pildoraTexto: string;
  ctaFondo: string;
  ctaTexto: string;
  fondo: string;
}

interface Tema {
  id: string;
  nombre: string;
  icono: string;
  etiqueta: string;
  titulo: string;
  detalle: string;
  cta: string;
  enlace: Record<string, string>;
  productos: Product[];
  imagen: string;
  estilo: Record<string, string>;
}

const ANCHO = 2000;
const ALTO = 590;

const LIENZOS: Record<string, Lienzo> = {
  'dos-por-uno': { fichas: [713, 142, 1943, 494], n: 5, hueco: 6.3, boton: [134, 443, 462, 521], corte: 0.351, tarjeta: '#fafafa', pildora: '#8f0200', pildoraTexto: '#ffffff', ctaFondo: '#ffffff', ctaTexto: '#a80000', fondo: '#c70a05' },
  parrilla: { fichas: [809, 134, 1954, 497], n: 4, hueco: 7.7, boton: [60, 395, 364, 465], corte: 0.4, tarjeta: '#fef9ef', pildora: '#401a07', pildoraTexto: '#fdf1e3', ctaFondo: '#f2e7d9', ctaTexto: '#240500', fondo: '#4d220d' },
  desayuno: { fichas: [801, 138, 1965, 495], n: 4, hueco: 7.3, boton: [60, 379, 348, 459], corte: 0.396, tarjeta: '#fcf4ee', pildora: '#5a2000', pildoraTexto: '#ffffff', ctaFondo: '#571f00', ctaTexto: '#ffffff', fondo: '#f57304' },
  frescos: { fichas: [804, 87, 1953, 471], n: 4, hueco: 7.7, boton: [130, 355, 385, 426], corte: 0.398, tarjeta: '#f4eddd', pildora: '#353400', pildoraTexto: '#fffbe6', ctaFondo: '#f6eddb', ctaTexto: '#353400', fondo: '#6f720f' },
  'hogar-limpio': { fichas: [766, 87, 1932, 491], n: 4, hueco: 9, boton: [267, 439, 598, 512], corte: 0.379, tarjeta: '#f9efe5', pildora: '#5c2200', pildoraTexto: '#ffffff', ctaFondo: '#5c2200', ctaTexto: '#ffffff', fondo: '#f08006' },
};

const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;

/** Variables CSS con la posición (en %) de los productos y del botón sobre la imagen del tema. */
function estilo(l: Lienzo): Record<string, string> {
  const [fx0, fy0, fx1, fy1] = l.fichas;
  const [bx0, by0, bx1, by1] = l.boton;
  return {
    '--fl': pct(fx0, ANCHO), '--ft': pct(fy0, ALTO), '--fw': pct(fx1 - fx0, ANCHO), '--fh': pct(fy1 - fy0, ALTO),
    '--n': String(l.n), '--hueco': pct(l.hueco, fx1 - fx0),
    '--bl': pct(bx0, ANCHO), '--bt': pct(by0, ALTO), '--bw': pct(bx1 - bx0, ANCHO), '--bh': pct(by1 - by0, ALTO),
    '--corte': String(l.corte), '--tarjeta': l.tarjeta, '--pildora': l.pildora, '--pildora-texto': l.pildoraTexto,
    '--cta-fondo': l.ctaFondo, '--cta-texto': l.ctaTexto, '--fondo': l.fondo,
  };
}

const SEIS_SEGUNDOS = 6;

function descuento(p: Product): number {
  return p.listPrice && p.listPrice > p.price ? Math.round((1 - p.price / p.listPrice) * 100) : 0;
}

/** Pantalla principal de "Todo": temas con productos, ofertas relámpago y un grupo por departamento. */
@Component({
  selector: 'app-portada-tienda',
  standalone: true,
  imports: [RouterLink, IconoComponent, ProductIconComponent, RielProductosComponent, SolesPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portada-tienda.component.html',
  styleUrl: './portada-tienda.component.scss',
})
export class PortadaTiendaComponent {
  readonly productos = input.required<Product[]>();
  readonly valoraciones = input<Record<number, RatingSummary>>({});
  readonly cargando = input(false);
  readonly esqueletos = [1, 2, 3, 4, 5, 6];
  readonly carrito = inject(CarritoService);

  readonly indice = signal(0);
  readonly pausado = signal(false);
  readonly segundos = SEIS_SEGUNDOS;
  /** Con "menos movimiento" no hay avance automático ni barra de progreso animada. */
  readonly reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly departamentos = DEPARTAMENTOS;

  private readonly disponibles = computed(() => this.productos().filter((p) => p.stock > 0));

  /** Productos de las subcategorías del tema: uno por subcategoría con las ofertas primero y, si faltan, más de las mismas. */
  private delTema(subs: string[], n: number): Product[] {
    const peso = (p: Product) => (p.promo ? 2 : 0) + (descuento(p) > 0 ? 1 : 0);
    const porSub = subs.map((s) => this.disponibles().filter((p) => p.subcategory === s).sort((a, b) => peso(b) - peso(a)));
    const elegidos = porSub.map((c) => c[0]).filter(Boolean).slice(0, n);
    for (let k = 1; elegidos.length < n && k < n; k++) {
      for (const c of porSub) if (c[k] && elegidos.length < n) elegidos.push(c[k]);
    }
    return elegidos;
  }

  readonly temas = computed<Tema[]>(() => {
    const col = (id: string) => COLECCIONES.find((c) => c.id === id)!;
    const dosPorUno = this.disponibles().filter((p) => p.promo === '2X1');
    const base = (id: string) => ({ imagen: `img/temas/${id}.webp`, estilo: estilo(LIENZOS[id]) });
    const lista: Tema[] = [
      {
        id: 'dos-por-uno', nombre: '2 × 1', icono: 'soda', etiqueta: 'Promoción',
        titulo: 'Lleva 2, paga 1',
        detalle: `${this.productos().filter((p) => p.promo === '2X1').length} productos de consumo diario con 2 × 1.`,
        cta: 'Ver productos', enlace: { oferta: '2x1' }, productos: dosPorUno.slice(0, LIENZOS['dos-por-uno'].n), ...base('dos-por-uno'),
      },
    ];
    const tema = (id: string, etiqueta: string, titulo: string, detalle: string): Tema => {
      const c = col(id);
      return { id, nombre: c.nombre, icono: c.icono, etiqueta, titulo, detalle, cta: 'Ver la colección', enlace: { col: id }, productos: this.delTema(c.subs, LIENZOS[id].n), ...base(id) };
    };
    // Los textos grandes (y el 17 %) van pintados en la imagen; aquí quedan para los lectores de pantalla.
    lista.push(
      tema('desayuno', 'Para empezar bien el día', 'Desayuno completo', 'Pan, leche, huevos, yogurt y café en un solo lugar.'),
      tema('parrilla', 'El fin de semana se acerca', 'Todo para la parrilla', 'Carnes, embutidos y cervezas para compartir.'),
      tema('hogar-limpio', 'Tu súper, más cerca', 'Hasta 17 % en limpieza', 'Cuida tu hogar al mejor precio.'),
      tema('frescos', 'Ahorra y disfruta', 'Frutas y verduras', 'Frescura y calidad en cada compra.'),
    );
    return lista.filter((t) => t.productos.length > 0);
  });

  /** Ofertas relámpago: las dos con más descuento van grandes y las cuatro siguientes, medianas. */
  readonly relampago = computed(() =>
    this.disponibles()
      .filter((p) => descuento(p) > 0)
      .sort((a, b) => descuento(b) - descuento(a))
      .slice(0, 6)
      .map((p) => ({ ...p, descuento: descuento(p) })),
  );

  readonly dosPorUno = computed(() => this.disponibles().filter((p) => p.promo === '2X1').slice(0, 14));
  readonly conDescuento = computed(() => this.disponibles().filter((p) => descuento(p) > 0).sort((a, b) => descuento(b) - descuento(a)).slice(8, 22));

  readonly grupos = computed(() => {
    const peso = (p: Product) => (p.promo ? 2 : 0) + (descuento(p) > 0 ? 1 : 0);
    return DEPARTAMENTOS.map((d) => ({
      ...d,
      productos: this.disponibles().filter((p) => p.category === d.nombre).sort((a, b) => peso(b) - peso(a)).slice(0, 12),
      total: this.productos().filter((p) => p.category === d.nombre).length,
    })).filter((g) => g.productos.length > 0);
  });

  /** Tiempo que queda hasta la medianoche, para la cuenta regresiva de las ofertas. */
  readonly resto = signal(this.hastaMedianoche());

  constructor() {
    const t = setInterval(() => this.resto.set(this.hastaMedianoche()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  private hastaMedianoche(): string {
    const ahora = new Date();
    const fin = new Date(ahora);
    fin.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((fin.getTime() - ahora.getTime()) / 1000));
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${dos(Math.floor(s / 3600))}:${dos(Math.floor((s % 3600) / 60))}:${dos(s % 60)}`;
  }

  /** Va al tema indicado (con vuelta al principio). */
  ir(i: number): void {
    const n = this.temas().length;
    if (n) this.indice.set(((i % n) + n) % n);
  }

  /** Cuando la barra de progreso del tema activo termina, pasa al siguiente. */
  alTerminar(i: number): void {
    if (i === this.indice() && !this.pausado()) this.ir(i + 1);
  }
}
