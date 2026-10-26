import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, RatingSummary } from '../../models/product.model';
import { IconoComponent } from '../../shared/icono/icono.component';
import { SolesPipe } from '../../shared/soles.pipe';
import { COLECCIONES, DEPARTAMENTOS } from '../categorias';
import { ProductIconComponent } from '../product-icon/product-icon.component';
import { RielProductosComponent } from '../riel-productos/riel-productos.component';
import { CarritoService } from '../servicios/carrito.service';

interface Tema {
  id: string;
  nombre: string;
  icono: string;
  fondo: string;
  texto: string;
  etiqueta: string;
  titulo: string;
  detalle: string;
  cta: string;
  enlace: Record<string, string>;
  productos: Product[];
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
  readonly carrito = inject(CarritoService);

  readonly indice = signal(0);
  readonly pausado = signal(false);
  readonly segundos = SEIS_SEGUNDOS;
  /** Con "menos movimiento" no hay avance automático ni barra de progreso animada. */
  readonly reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly departamentos = DEPARTAMENTOS;

  private readonly disponibles = computed(() => this.productos().filter((p) => p.stock > 0));

  /** Hasta cuatro productos de las subcategorías del tema, uno por subcategoría y con las ofertas primero. */
  private delTema(subs: string[]): Product[] {
    const elegidos: Product[] = [];
    for (const sub of subs) {
      const candidatos = this.disponibles()
        .filter((p) => p.subcategory === sub)
        .sort((a, b) => (b.promo ? 2 : 0) + (descuento(b) > 0 ? 1 : 0) - ((a.promo ? 2 : 0) + (descuento(a) > 0 ? 1 : 0)));
      if (candidatos[0]) elegidos.push(candidatos[0]);
      if (elegidos.length === 4) break;
    }
    return elegidos;
  }

  private maximo(subs: string[]): number {
    return this.productos()
      .filter((p) => subs.includes(p.subcategory ?? ''))
      .reduce((m, p) => Math.max(m, descuento(p)), 0);
  }

  readonly temas = computed<Tema[]>(() => {
    const col = (id: string) => COLECCIONES.find((c) => c.id === id)!;
    const dosPorUno = this.disponibles().filter((p) => p.promo === '2X1');
    const lista: Tema[] = [
      {
        id: 'dos-por-uno', nombre: '2 × 1', icono: 'soda', fondo: '#d92300', texto: '#ffffff', etiqueta: 'Promoción',
        titulo: 'Lleva 2, paga 1',
        detalle: `${this.productos().filter((p) => p.promo === '2X1').length} productos de consumo diario con 2 × 1.`,
        cta: 'Ver todos los 2 × 1', enlace: { oferta: '2x1' }, productos: dosPorUno.slice(0, 4),
      },
    ];
    const tema = (id: string, fondo: string, texto: string, etiqueta: string, titulo: string, detalle: string): Tema => {
      const c = col(id);
      return { id, nombre: c.nombre, icono: c.icono, fondo, texto, etiqueta, titulo, detalle, cta: 'Ver la colección', enlace: { col: id }, productos: this.delTema(c.subs) };
    };
    const frescos = this.maximo(col('frescos').subs);
    const limpio = this.maximo(col('hogar-limpio').subs);
    lista.push(
      tema('desayuno', '#ff7a00', '#1f0c03', 'Para empezar bien el día', 'Desayuno completo', 'Pan, leche, huevos, yogurt y café en un solo lugar.'),
      tema('parrilla', '#3a1a0b', '#f1e8de', 'El fin de semana se acerca', 'Todo para la parrilla', 'Carnes, embutidos y cervezas para compartir.'),
      tema('hogar-limpio', '#e08c05', '#1f0c03', 'Para la casa', limpio > 0 ? `Hasta ${limpio} % en limpieza` : 'Hogar limpio', 'Detergentes, desinfectantes, papel y lavavajillas.'),
      tema('frescos', '#5f5a07', '#fff7ef', 'Frescos del día', 'Frutas y verduras', frescos > 0 ? `Seleccionados cada mañana, con hasta ${frescos} % de descuento.` : 'Seleccionados cada mañana en tu sede.'),
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
