import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CartItem, Product, ReceiptData, VALID_COUPONS, DatosEntrega } from '../../models/product.model';
import { CatalogoService } from './catalogo.service';
import { Punto } from '../../models/gestion.model';
import { COBERTURA_KM, estimarEnvio } from '../../shared/entrega/entrega';
import { OrdenService } from '../../services/orden.service';
import { OrdenVista } from '../../models/orden.model';

const CLAVE_GUARDADO = 'taskflow-carrito';

/** Con 2×1 se paga una unidad por cada par: con 3 se pagan 2, con 4 también 2. */
export function unidadesPagadas(p: Product, cantidad: number): number {
  return p.promo === '2X1' ? cantidad - Math.floor(cantidad / 2) : cantidad;
}

export type Resultado = { ok: true } | { ok: false; mensaje: string };

/** Carrito de la tienda: lo comparten el catálogo, el detalle y el panel lateral. */
@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly ordenes = inject(OrdenService);
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
  /** Lo que costaría sin promociones. */
  readonly bruto = computed(() => this.items().reduce((s, i) => s + i.product.price * i.quantity, 0));
  readonly ahorroPromo = computed(() => this.items().reduce((s, i) => s + i.product.price * (i.quantity - unidadesPagadas(i.product, i.quantity)), 0));
  /** Después de las promociones: es el subtotal que guarda el servidor, y sobre él va el cupón. */
  readonly subtotal = computed(() => this.bruto() - this.ahorroPromo());
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

  totalLinea(item: CartItem): number {
    return item.product.price * unidadesPagadas(item.product, item.quantity);
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

  /** Resta una unidad desde la tarjeta del producto (si era la última, lo saca del carrito). */
  quitarUno(productId: number): void {
    const item = this.items().find((i) => i.product.id === productId);
    if (item) this.cambiarCantidad(item, -1);
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

  /** Modo de entrega elegido en el carrito y, para envío, el punto marcado en el mapa. */
  readonly modoEntrega = signal<'recojo' | 'envio'>('recojo');
  readonly destino = signal<Punto | null>(null);
  /** Datos del cliente para el pedido; la referencia solo aplica al envío. */
  readonly clienteNombre = signal(leerNombre());
  readonly referencia = signal('');

  /** Sede elegida con su ubicación, distancia al destino y tiempo estimado de envío. */
  readonly entrega = computed<DatosEntrega>(() => {
    const t = this.catalogo.tiendas().find((x) => x.id === this.catalogo.sede());
    const d = this.destino();
    const base: DatosEntrega = { modo: this.modoEntrega(), sede: t?.nombre ?? '', direccionSede: t?.direccion, horario: t?.horario };
    if (this.modoEntrega() === 'recojo' || !d || t?.latitud == null || t.longitud == null) return base;
    const e = estimarEnvio({ lat: t.latitud, lng: t.longitud }, d, this.unidades());
    return {
      ...base,
      destino: d,
      distanciaKm: e.lineaRectaKm,
      recorridoKm: e.recorridoKm,
      minutos: e.minutos,
      vehiculo: `${e.vehiculo.nombre} (${e.vehiculo.regla})`,
      fueraDeCobertura: !e.enCobertura,
    };
  });
  readonly puedePagar = computed(
    () =>
      this.clienteNombre().trim().length > 0 &&
      (this.modoEntrega() === 'recojo' || (this.destino() !== null && !this.entrega().fueraDeCobertura)),
  );

  /** Un solo pedido al servidor: o se cobra todo, o nada (el carrito queda igual). */
  async pagar(): Promise<Resultado> {
    const items = this.items();
    if (items.length === 0 || this.pagando()) return { ok: false, mensaje: 'El carrito está vacío.' };
    if (!this.clienteNombre().trim()) return { ok: false, mensaje: 'Escribe tu nombre para el pedido.' };
    if (this.entrega().fueraDeCobertura) return { ok: false, mensaje: `Solo repartimos hasta ${COBERTURA_KM} km de la sede.` };
    if (!this.puedePagar()) return { ok: false, mensaje: 'Marca en el mapa la dirección de envío.' };

    const envio = this.modoEntrega() === 'envio';
    const destino = this.destino();
    this.pagando.set(true);
    try {
      const vista = await firstValueFrom(
        this.ordenes.crear({
          tiendaId: this.catalogo.sede(),
          clienteNombre: this.clienteNombre().trim(),
          modalidad: envio ? 'ENVIO' : 'RECOJO',
          direccion: envio ? this.referencia().trim() || undefined : undefined,
          latitud: envio ? destino?.lat : undefined,
          longitud: envio ? destino?.lng : undefined,
          cupon: this.cupon()?.code,
          lineas: items.map((i) => ({ productoId: i.product.id, cantidad: i.quantity })),
        }),
      );
      try {
        localStorage.setItem(CLAVE_NOMBRE, this.clienteNombre().trim());
      } catch {}
      this.ordenes.recordar(vista.orden.codigo);
      this.boleta.set(this.armarBoleta(vista));
      this.items.set([]);
      this.cupon.set(null);
      this.abierto.set(false);
      return { ok: true };
    } catch (err) {
      return { ok: false, mensaje: mensajeDeError(err, 'No se pudo completar la compra.') + ' No se cobró nada.' };
    } finally {
      this.pagando.set(false);
    }
  }

  /** La boleta sale de lo que guardó el servidor (precios y descuento incluidos). */
  private armarBoleta(v: OrdenVista): ReceiptData {
    const o = v.orden;
    return {
      number: o.codigo,
      codigo: o.codigo,
      cliente: o.clienteNombre,
      date: new Date(o.creadaEn),
      lines: v.lineas.map((l) => ({
        name: l.producto,
        quantity: l.cantidad,
        unitPrice: l.total / l.cantidad,
        lineTotal: l.total,
      })),
      subtotal: o.subtotal,
      discount: o.descuento,
      couponCode: o.cupon ?? undefined,
      total: o.total,
      entrega: { ...this.entrega(), distanciaKm: o.distanciaKm ?? this.entrega().distanciaKm },
    };
  }
}

const CLAVE_NOMBRE = 'taskflow-cliente';

function leerNombre(): string {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) ?? '';
  } catch {
    return '';
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
