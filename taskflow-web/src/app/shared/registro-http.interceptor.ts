import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { RegistroEventosService, demoDeUrl } from './registro-eventos.service';

/** Anota cada llamada REST al backend (método, ruta, estado y tiempo) en el registro de eventos. */
export const registroHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const demo = demoDeUrl(req.url);
  if (!demo) return next(req);

  const registro = inject(RegistroEventosService);
  const ruta = new URL(req.url, location.origin).pathname;
  const inicio = performance.now();
  const ms = () => Math.round(performance.now() - inicio);

  return next(req).pipe(
    tap({
      next: (evento) => {
        if (evento instanceof HttpResponse) {
          registro.registrar({ demo, canal: 'REST', direccion: 'salida', detalle: `${req.method} ${ruta} → ${evento.status} en ${ms()} ms` });
        }
      },
      error: (err: HttpErrorResponse) =>
        registro.registrar({ demo, canal: 'REST', direccion: 'salida', detalle: `${req.method} ${ruta} → ${err.status || 'sin respuesta'} en ${ms()} ms` }),
    }),
  );
};
