import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ActivatedRouteSnapshot, provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { registroHttpInterceptor } from './shared/registro-http.interceptor';

/** Ruta más profunda activa: la que de verdad cambia entre pantallas. */
function hoja(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return snapshot.firstChild ? hoja(snapshot.firstChild) : snapshot;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        // Filtros y páginas (solo cambian los query params) no animan la pantalla entera.
        onViewTransitionCreated: ({ transition, from, to }) => {
          const a = hoja(from);
          const b = hoja(to);
          if (a.routeConfig === b.routeConfig && JSON.stringify(a.params) === JSON.stringify(b.params)) {
            transition.skipTransition();
          }
        },
      }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([registroHttpInterceptor])),
  ],
};
