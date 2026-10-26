/** Departamentos de la tienda con sus subcategorías: de aquí salen el menú y los filtros. */
export interface Departamento {
  nombre: string;
  /** Clave de ícono de producto (ver ProductIconComponent). */
  icono: string;
  subs: string[];
}

export const DEPARTAMENTOS: Departamento[] = [
  { nombre: 'Despensa', icono: 'wheat', subs: ['Arroz y menestras', 'Aceites y vinagres', 'Fideos y pastas', 'Conservas', 'Salsas y condimentos', 'Harinas y azúcar', 'Desayuno y untables', 'Frutos secos'] },
  { nombre: 'Lácteos y huevos', icono: 'milk', subs: ['Leches', 'Yogures', 'Quesos y mantequilla', 'Huevos'] },
  { nombre: 'Frutas y verduras', icono: 'apple', subs: ['Frutas', 'Verduras', 'Tubérculos'] },
  { nombre: 'Carnes y pescados', icono: 'beef', subs: ['Pollo', 'Res y cerdo', 'Pescados y mariscos', 'Embutidos'] },
  { nombre: 'Panadería', icono: 'croissant', subs: ['Panes', 'Pasteles y tortas'] },
  { nombre: 'Bebidas', icono: 'soda', subs: ['Gaseosas', 'Aguas', 'Jugos', 'Cervezas', 'Café y té'] },
  { nombre: 'Snacks y dulces', icono: 'cookie', subs: ['Galletas', 'Chocolates y dulces', 'Snacks', 'Cereales'] },
  { nombre: 'Congelados', icono: 'icecream', subs: ['Helados', 'Verduras congeladas', 'Pizzas y snacks'] },
  { nombre: 'Limpieza', icono: 'sparkles', subs: ['Detergentes', 'Desinfectantes', 'Papel y descartables', 'Lavavajillas'] },
  { nombre: 'Cuidado personal', icono: 'bath', subs: ['Higiene bucal', 'Cuidado del cabello', 'Jabones y baño', 'Bebés'] },
  { nombre: 'Mascotas', icono: 'dog', subs: ['Perros', 'Gatos'] },
  { nombre: 'Hogar', icono: 'cup', subs: ['Cocina y mesa', 'Decoración', 'Dormitorio'] },
  { nombre: 'Electrohogar', icono: 'fridge', subs: ['Refrigeración', 'Cocina y cocción', 'Lavado y planchado', 'Ventilación y clima'] },
  { nombre: 'Tecnología', icono: 'laptop', subs: ['Computación', 'Audio y video', 'Celulares y energía'] },
  { nombre: 'Oficina', icono: 'notebook', subs: ['Escritorio', 'Papelería'] },
  { nombre: 'Ropa', icono: 'shirt', subs: ['Polos y poleras', 'Ropa de dormir', 'Complementos'] },
  { nombre: 'Juegos', icono: 'dices', subs: ['Juegos de mesa', 'Juguetes', 'Videojuegos'] },
  { nombre: 'Deportes y aire libre', icono: 'dumbbell', subs: ['Fitness', 'Ciclismo', 'Camping', 'Fútbol y balones'] },
  { nombre: 'Accesorios', icono: 'watch', subs: ['Llaveros y pines', 'Bolsos y mochilas', 'Relojes y lentes', 'Regalos y detalles'] },
];

/** Rangos del filtro de precio (mínimo incluido, máximo excluido), en soles. */
export const RANGOS_PRECIO = [
  { id: '0', etiqueta: 'Hasta S/ 5', min: 0, max: 5 },
  { id: '1', etiqueta: 'S/ 5 a S/ 10', min: 5, max: 10 },
  { id: '2', etiqueta: 'S/ 10 a S/ 20', min: 10, max: 20 },
  { id: '3', etiqueta: 'S/ 20 a S/ 50', min: 20, max: 50 },
  { id: '4', etiqueta: 'Más de S/ 50', min: 50, max: Infinity },
];

/** Colecciones por momento de compra: agrupan subcategorías de varios departamentos. */
export interface Coleccion {
  id: string;
  nombre: string;
  icono: string;
  subs: string[];
}

export const COLECCIONES: Coleccion[] = [
  { id: 'desayuno', nombre: 'Para el desayuno', icono: 'croissant', subs: ['Panes', 'Leches', 'Yogures', 'Huevos', 'Café y té', 'Cereales', 'Desayuno y untables'] },
  { id: 'parrilla', nombre: 'Para la parrilla', icono: 'beef', subs: ['Res y cerdo', 'Pollo', 'Embutidos', 'Cervezas', 'Salsas y condimentos'] },
  { id: 'hogar-limpio', nombre: 'Hogar limpio', icono: 'sparkles', subs: ['Detergentes', 'Desinfectantes', 'Papel y descartables', 'Lavavajillas'] },
  { id: 'frescos', nombre: 'Frescos del día', icono: 'apple', subs: ['Frutas', 'Verduras', 'Tubérculos', 'Pescados y mariscos'] },
];
