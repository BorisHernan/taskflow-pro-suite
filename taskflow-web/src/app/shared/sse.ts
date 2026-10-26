import { Observable } from 'rxjs';

export type EstadoConexion = 'conectando' | 'conectado' | 'reconectando' | 'sin-permiso';

/**
 * Server-Sent Events con cabecera Authorization: EventSource no permite
 * enviarla, así que se lee el stream con fetch. Reintenta solo si se corta.
 */
export function sseConToken<T>(
  url: string,
  token: string | null,
  alEstado: (e: EstadoConexion) => void = () => {},
  reintentoMs = 3000,
): Observable<T> {
  return new Observable<T>((suscriptor) => {
    let control: AbortController | null = null;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    let cerrado = false;

    const conectar = async () => {
      control = new AbortController();
      try {
        const respuesta = await fetch(url, {
          headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: control.signal,
        });
        if (respuesta.status === 401 || respuesta.status === 403) {
          alEstado('sin-permiso');
          suscriptor.error(new Error(`SSE ${respuesta.status}`));
          return;
        }
        if (!respuesta.ok || !respuesta.body) throw new Error(`SSE ${respuesta.status}`);
        alEstado('conectado');

        const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
        let pendiente = '';
        for (;;) {
          const { value, done } = await lector.read();
          if (done) break;
          pendiente += value;
          const bloques = pendiente.split(/\r?\n\r?\n/);
          pendiente = bloques.pop() ?? '';
          for (const bloque of bloques) {
            const datos = bloque
              .split(/\r?\n/)
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).replace(/^ /, ''))
              .join('\n');
            if (datos) suscriptor.next(JSON.parse(datos) as T);
          }
        }
      } catch (e) {
        if (cerrado) return;
        console.warn('SSE: conexión interrumpida, reintentando…', e);
      }
      if (!cerrado) {
        alEstado('reconectando');
        reintento = setTimeout(conectar, reintentoMs);
      }
    };

    alEstado('conectando');
    conectar();
    return () => {
      cerrado = true;
      clearTimeout(reintento);
      control?.abort();
    };
  });
}
