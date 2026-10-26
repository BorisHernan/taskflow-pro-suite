import { describe, expect, it } from 'vitest';
import { Product } from '../../models/product.model';
import { unidadesPagadas } from './carrito.service';

const producto = (promo?: string): Product => ({ id: 1, name: 'Galletas', price: 3, stock: 20, category: 'Snacks y dulces', promo });

describe('promoción 2×1', () => {
  it('por cada par se paga una unidad', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => unidadesPagadas(producto('2X1'), n))).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('sin promoción se paga cada unidad', () => {
    expect([1, 2, 3].map((n) => unidadesPagadas(producto(), n))).toEqual([1, 2, 3]);
  });
});
