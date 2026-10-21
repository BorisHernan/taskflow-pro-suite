import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE, SesionService } from './sesion.service';

/** Agrega el JWT a las llamadas a la API y cierra la sesión si el servidor ya no la acepta. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  const token = sesion.token();
  if (!token || !req.url.startsWith(API_BASE) || req.url.endsWith('/api/auth/login')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) sesion.salir('expirada');
      return throwError(() => err);
    }),
  );
};
