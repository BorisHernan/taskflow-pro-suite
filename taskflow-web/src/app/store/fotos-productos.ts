/** Fotos de cada producto en img/productos/<id>/<n>.webp: cuántas tiene (la 1 es la principal). */
const CANTIDAD: Record<number, number> = {
  7: 9,
  8: 3,
  9: 4,
  10: 5,
  11: 3,
  12: 2,
  13: 5,
  14: 3,
  15: 1,
  16: 2,
  17: 4,
  18: 2,
  19: 1,
  20: 3,
  21: 4,
  22: 7,
};

/** Con false se muestran los pictogramas en vez de las fotos (las fotos quedan guardadas). */
const MOSTRAR_FOTOS = false;

/** Fotos del producto, o lista vacía si todavía usa su ícono. */
export function fotosDe(id: number): string[] {
  if (!MOSTRAR_FOTOS) return [];
  return Array.from({ length: CANTIDAD[id] ?? 0 }, (_, i) => `img/productos/${id}/${i + 1}.webp`);
}
