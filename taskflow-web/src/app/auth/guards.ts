import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionService } from './sesion.service';

/** Sin sesión, manda al login y vuelve a la página pedida al entrar. */
export const conSesion: CanActivateFn = (_ruta, estado) => {
  const sesion = inject(SesionService);
  return sesion.activa() || inject(Router).createUrlTree(['/ingresar'], { queryParams: { volver: estado.url } });
};

export const soloAdmin: CanActivateFn = () => {
  const sesion = inject(SesionService);
  return sesion.esAdmin() || inject(Router).createUrlTree(['/gestion']);
};
