// Recorrido guiado: un solo lugar con los pasos, para que la portada y la
// barra de guía de cada demo digan exactamente lo mismo.
export interface PasoRecorrido {
  ruta: string;
  titulo: string;
  queEs: string;
  pruebaEsto: string;
  tecnica: string;
}

export const RECORRIDO: PasoRecorrido[] = [
  {
    ruta: '/tablero',
    titulo: 'Tablero Kanban en tiempo real',
    queEs: 'Un tablero compartido por todos los visitantes.',
    pruebaEsto: 'Abre esta página en otra pestaña o en tu celular y mueve una tarjeta: se mueve en las dos al instante.',
    tecnica: 'Server-Sent Events sobre Spring WebFlux',
  },
  {
    ruta: '/tienda',
    titulo: 'Tienda con stock compartido',
    queEs: 'Carrito, cupones y boleta simulados, con stock real en la base de datos.',
    pruebaEsto: 'Compra algo con el cupón PORTAFOLIO15 y mira cómo baja el stock para todos.',
    tecnica: 'SSE + R2DBC sobre PostgreSQL',
  },
  {
    ruta: '/estadisticas',
    titulo: 'Métricas del sistema',
    queEs: 'Contadores en vivo de lo que pasa en la demo.',
    pruebaEsto: 'Revisa cuántas personas visitaron la demo: el total histórico se guarda en Postgres.',
    tecnica: 'Micrometer + Spring Actuator',
  },
  {
    ruta: '/arena',
    titulo: 'Arena multijugador',
    queEs: 'Un mini agar.io contra otros visitantes y bots con IA.',
    pruebaEsto: 'Escribe tu nombre y juega: come círculos más chicos y llega a tamaño 2000 para ganar.',
    tecnica: 'WebSocket bidireccional a 10 ticks por segundo',
  },
];
