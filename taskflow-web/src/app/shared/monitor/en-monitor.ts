/**
 * La app corre dentro del monitor del recorrido (la pantalla de "otro usuario").
 * Se decide una sola vez al arrancar: ahí no hay recorrido ni teléfono, y la sede de prueba
 * es la misma de la ventana principal.
 */
export const EN_MONITOR =
  typeof window !== 'undefined' && window.parent !== window && new URLSearchParams(window.location.search).has('monitor');
