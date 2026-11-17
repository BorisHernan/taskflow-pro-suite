import { Injectable, computed, inject } from '@angular/core';
import { Product } from '../models/product.model';
import { FOTOS_ARTICULOS } from './fotos-articulos';
import { CatalogoService } from './servicios/catalogo.service';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Artículos ordenados del nombre más largo al más corto, para que "Arroz extra" gane a "Arroz". */
const ARTICULOS = Object.entries(FOTOS_ARTICULOS)
  .map(([slug, a]) => ({ slug, base: sinTildes(a.base) }))
  .sort((a, b) => b.base.length - a.base.length);

/** Artículo cuyas fotos usa un producto: su nombre empieza con el del artículo ("Yuca Campo Real Bolsa 1 kg"). */
export function articuloDe(nombre: string): string | null {
  const n = sinTildes(nombre);
  return ARTICULOS.find((a) => n === a.base || n.startsWith(a.base + ' '))?.slug ?? null;
}

/**
 * Fotos de los productos. Las de un artículo se reparten entre sus marcas (cada marca recibe las suyas, sin
 * repetirse con otra) y las presentaciones de una misma marca arrancan por fotos distintas.
 */
@Injectable({ providedIn: 'root' })
export class FotosProductos {
  private readonly catalogo = inject(CatalogoService);

  /** Marcas de cada artículo, en orden alfabético para que el reparto no cambie entre visitas. */
  private readonly marcas = computed(() => {
    const porArticulo = new Map<string, Set<string>>();
    for (const p of this.catalogo.productos()) {
      const slug = articuloDe(p.name);
      if (slug) porArticulo.set(slug, (porArticulo.get(slug) ?? new Set()).add(p.brand ?? ''));
    }
    return new Map([...porArticulo].map(([slug, marcas]) => [slug, [...marcas].sort()]));
  });

  fotosDe(p: Pick<Product, 'id' | 'name' | 'brand'>): string[] {
    const slug = articuloDe(p.name);
    if (!slug) return [];
    const cantidad = FOTOS_ARTICULOS[slug].cantidad;
    const marcas = this.marcas().get(slug) ?? [];
    const posicion = Math.max(0, marcas.indexOf(p.brand ?? ''));
    let propias = Array.from({ length: cantidad }, (_, j) => j).filter((j) => j % Math.max(1, marcas.length) === posicion);
    if (!propias.length) propias = [posicion % cantidad];
    return propias.map((_, i) => propias[(i + p.id) % propias.length]).map((j) => `img/articulos/${slug}/${j + 1}.webp`);
  }
}
