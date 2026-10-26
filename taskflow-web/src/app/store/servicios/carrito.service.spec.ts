import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { effect, signal } from '@angular/core';
import { CarritoService } from './carrito.service';
import { CatalogoService } from './catalogo.service';
import { Product } from '../../models/product.model';

const producto = (id: number, stock: number, price = 10): Product => ({
  id, name: `Producto ${id}`, price, stock, category: 'Hogar',
});

describe('CarritoService', () => {
  let carrito: CarritoService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: CatalogoService, useValue: { sede: signal(2), tiendas: signal([]) } }],
    });
    carrito = TestBed.inject(CarritoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('suma unidades del mismo producto y calcula el total', () => {
    carrito.agregar(producto(1, 5, 20));
    carrito.agregar(producto(1, 5, 20), 2);
    carrito.agregar(producto(2, 5, 5));

    expect(carrito.unidades()).toBe(4);
    expect(carrito.subtotal()).toBe(65);
  });

  it('no deja pasar del stock disponible', () => {
    const r = carrito.agregar(producto(1, 2), 3);

    expect(r.ok).toBe(false);
    expect(carrito.unidades()).toBe(0);
  });

  it('aplica cupones válidos sin importar mayúsculas y rechaza los inexistentes', () => {
    carrito.agregar(producto(1, 5, 100));

    expect(carrito.aplicarCupon('portafolio15').ok).toBe(true);
    expect(carrito.total()).toBe(85);
    expect(carrito.aplicarCupon('GRATIS').ok).toBe(false);
  });

  it('sincronizar desde un efecto no entra en bucle', () => {
    carrito.agregar(producto(1, 5));
    const productos = signal([producto(1, 3)]);
    let ejecuciones = 0;
    TestBed.runInInjectionContext(() =>
      effect(() => {
        ejecuciones++;
        carrito.sincronizar(productos());
      }),
    );

    TestBed.tick();

    expect(ejecuciones).toBe(1);
    expect(carrito.items()[0].product.stock).toBe(3);
  });

  const vista = (total: number) => ({
    orden: {
      id: 7, codigo: 'TF-ABC234', tiendaId: 2, clienteNombre: 'Lucía', modalidad: 'RECOJO', subtotal: 200, descuento: 20,
      total, cupon: 'BIENVENIDO10', estado: 'RECIBIDA', creadaEn: '2026-10-25T10:00:00', actualizadaEn: '2026-10-25T10:00:00',
    },
    lineas: [{ producto: 'Producto 1', cantidad: 2, total: 200, fecha: '2026-10-25T10:00:00' }],
    tiendaNombre: 'Tienda San Isidro',
  });

  it('al pagar envía un solo pedido y arma la boleta con lo que guardó el servidor', async () => {
    carrito.agregar(producto(1, 5, 100), 2);
    carrito.aplicarCupon('BIENVENIDO10');
    carrito.clienteNombre.set('Lucía');

    const pago = carrito.pagar();
    const pedido = http.expectOne((r) => r.url.endsWith('/api/ordenes'));
    expect(pedido.request.body).toEqual(
      expect.objectContaining({ tiendaId: 2, clienteNombre: 'Lucía', modalidad: 'RECOJO', cupon: 'BIENVENIDO10', lineas: [{ productoId: 1, cantidad: 2 }] }),
    );
    pedido.flush(vista(180));
    const r = await pago;

    expect(r.ok).toBe(true);
    expect(carrito.boleta()?.codigo).toBe('TF-ABC234');
    expect(carrito.boleta()?.total).toBe(180);
    expect(carrito.items()).toEqual([]);
  });

  it('si el pedido falla no se cobra nada y el carrito queda igual', async () => {
    carrito.agregar(producto(1, 5));
    carrito.agregar(producto(2, 5));
    carrito.clienteNombre.set('Lucía');

    const pago = carrito.pagar();
    http.expectOne((r) => r.url.endsWith('/api/ordenes')).flush({ error: 'Solo quedan 0 unidades' }, { status: 409, statusText: 'Conflict' });
    const r = await pago;

    expect(r.ok).toBe(false);
    expect(carrito.items().map((i) => i.product.id)).toEqual([1, 2]);
  });

  it('sin nombre no deja pagar', () => {
    carrito.agregar(producto(1, 5));
    carrito.clienteNombre.set(' ');
    expect(carrito.puedePagar()).toBe(false);
  });
});
