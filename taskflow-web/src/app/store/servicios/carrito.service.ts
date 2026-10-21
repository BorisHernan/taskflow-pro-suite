import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CartItem, Product, ReceiptData, VALID_COUPONS } from '../../models/product.model';
import { CatalogoService } from './catalogo.service';
import { ProductService } from '../../services/product.service';

const CLAVE_GUARDADO = 'taskflow-carrito';

export type Resultado = { ok: true } | { ok: false; mensaje: string };

/** Carrito de la tienda: lo comparten el catálogo, el detalle y el panel lateral. */
@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly api = inject(ProductService);
  private readonly catalogo = inject(CatalogoService);

  readonly items = signal<CartItem[]>(leerGuardado());
  readonly cupon = signal<{ code: string; discount: number } | null>(null);
  readonly abierto = signal(false);
  readonly pagando = signal(false);
  readonly boleta = signal<ReceiptData | null>(null);
  /** Sube con cada producto agregado: el botón del carrito lo usa para animarse. */
  readonly pulso = signal(0);
  /** Aviso flotante de la tienda ("Agregado al carrito", errores de stock…). */
  readonly aviso = signal<{ texto: string; error: boolean } | null>(null);
  private avisoTimer: ReturnType<typeof setTimeout> | undefined;

  readonly unidades = computed(() => this.items().reduce((n, i) => n + i.quantity, 0));
  readonly subtotal = computed(() => this.items().reduce((s, i) => s + i.product.price * i.quantity, 0));
  readonly descuento = computed(() => this.subtotal() * (this.cupon()?.discount ?? 0));
  readonly total = computed(() => this.subtotal() - this.descuento());

  readonly cuponesDisponibles = Object.entries(VALID_COUPONS).map(([code, discount]) => ({ code, discount }));

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(this.items()));
      } catch {
        // Sin almacenamiento (modo privado): el carrito vive solo en memoria.
      }
    });
  }

  avisar(texto: string, error = false): void {
    this.aviso.set({ texto, error });
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => this.aviso.set(null), error ? 6000 : 2500);
  }

  /** Agrega y avisa el resultado: lo usan todos los botones "Agregar al carrito". */
  agregarYAvisar(producto: Product, cantidad = 1): boolean {
    const r = this.agregar(producto, cantidad);
    this.avisar(r.ok ? `Agregaste ${cantidad > 1 ? cantidad + ' × ' : ''}${producto.name}` : r.mensaje, !r.ok);
    return r.ok;
  }

  cantidad(productId: number): number {
    return this.items().find((i) => i.product.id === productId)?.quantity ?? 0;
  }

  agregar(producto: Product, cantidad = 1): Resultado {
    const yaHay = this.cantidad(producto.id);
    if (yaHay + cantidad > producto.stock) {
      return { ok: false, mensaje: `Solo quedan ${producto.stock} unidades de "${producto.name}".` };
    }
    this.items.update((items) =>
      yaHay > 0
        ? items.map((i) => (i.product.id === producto.id ? { product: producto, quantity: yaHay + cantidad } : i))
        : [...items, { product: producto, quantity: cantidad }],
    );
    this.pulso.update((n) => n + 1);
    return { ok: true };
  }

  cambiarCantidad(item: CartItem, delta: number): Resultado {
    const nueva = item.quantity + delta;
    if (nueva <= 0) {
      this.quitar(item);
      return { ok: true };
    }
    if (nueva > item.product.stock) {
      return { ok: false, mensaje: `Solo quedan ${item.product.stock} unidades de "${item.product.name}".` };
    }
    this.items.update((items) => items.map((i) => (i.product.id === item.product.id ? { ...i, quantity: nueva } : i)));
    return { ok: true };
  }

  quitar(item: CartItem): void {
    this.items.update((items) => items.filter((i) => i.product.id !== item.product.id));
  }

  /** El stock cambia en vivo: el carrito se queda con la versión más reciente de cada producto. */
  sincronizar(productos: Product[]): void {
    // untracked: se llama desde efectos y no debe volverlos a disparar al escribir items.
    untracked(() => {
      const porId = new Map(productos.map((p) => [p.id, p]));
      const items = this.items();
      if (!items.some((i) => porId.has(i.product.id) && porId.get(i.product.id) !== i.product)) return;
      this.items.set(items.map((i) => ({ ...i, product: porId.get(i.product.id) ?? i.product })));
    });
  }

  aplicarCupon(codigo: string): Resultado {
    const code = codigo.trim().toUpperCase();
    const discount = VALID_COUPONS[code];
    if (discount === undefined) return { ok: false, mensaje: `El cupón "${codigo.trim()}" no existe o ya no es válido.` };
    this.cupon.set({ code, discount });
    return { ok: true };
  }

  quitarCupon(): void {
    this.cupon.set(null);
  }

  /** Compra producto por producto; si uno falla, en el carrito queda solo lo que no se compró. */
  async pagar(): Promise<Resultado> {
    const items = this.items();
    if (items.length === 0 || this.pagando()) return { ok: false, mensaje: 'El carrito está vacío.' };

    this.pagando.set(true);
    const comprados: CartItem[] = [];
    try {
      for (const item of items) {
        try {
          await firstValueFrom(this.api.purchase(item.product.id, item.quantity, this.catalogo.sede()));
          comprados.push(item);
        } catch (err) {
          this.items.update((actual) => actual.filter((c) => !comprados.some((p) => p.product.id === c.product.id)));
          const previos = comprados.length > 0 ? ' Los productos anteriores de esta compra ya se descontaron del stock.' : '';
          return { ok: false, mensaje: mensajeDeError(err, `No se pudo completar la compra de "${item.product.name}".`) + previos };
        }
      }
      this.boleta.set(this.armarBoleta(items));
      this.items.set([]);
      this.cupon.set(null);
      this.abierto.set(false);
      return { ok: true };
    } finally {
      this.pagando.set(false);
    }
  }

  private armarBoleta(items: CartItem[]): ReceiptData {
    const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    const cupon = this.cupon();
    const discount = subtotal * (cupon?.discount ?? 0);
    return {
      number: 'TF-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date(),
      lines: items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        unitPrice: i.product.price,
        lineTotal: i.product.price * i.quantity,
      })),
      subtotal,
      discount,
      couponCode: cupon?.code,
      total: subtotal - discount,
    };
  }
}

function leerGuardado(): CartItem[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) ?? '[]');
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
}

export function mensajeDeError(err: unknown, porDefecto: string): string {
  if (err instanceof HttpErrorResponse && err.error) {
    const body = err.error;
    if (typeof body === 'string' && body.trim()) return body;
    if (typeof body?.error === 'string') return body.error;
    if (typeof body?.message === 'string') return body.message;
  }
  return porDefecto;
}
