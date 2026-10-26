import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeService } from './services/theme.service';
import { SesionService } from './auth/sesion.service';
import { AvisosComponent } from './shared/ui/avisos.component';
import { ConfirmacionComponent } from './shared/ui/confirmacion.component';
import { SelectorTemaComponent } from './shared/ui/selector-tema.component';
import { TourComponent } from './shared/tour/tour.component';
import { EN_MONITOR } from './shared/monitor/en-monitor';
import { MonitorComponent } from './shared/monitor/monitor.component';
import { TelefonoEmpleadoComponent } from './shared/telefono/telefono-empleado.component';

const SECCIONES = ['gestion', 'tienda', 'arena', 'ingresar'];

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AvisosComponent,
    ConfirmacionComponent,
    SelectorTemaComponent,
    TourComponent,
    TelefonoEmpleadoComponent,
    MonitorComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly sesion = inject(SesionService);
  readonly themeService = inject(ThemeService);
  /** Dentro de /gestion la app usa su propio marco (barra lateral y barra superior). */
  readonly enGestion = signal(false);
  readonly enMonitor = EN_MONITOR;

  constructor() {
    const raiz = inject(DOCUMENT).documentElement;
    const router = inject(Router);
    // En el monitor del recorrido, la ventana principal decide qué pantalla mostrar.
    if (EN_MONITOR) (window as any).__tfNavegar = (url: string) => router.navigateByUrl(url);
    this.enGestion.set(location.pathname.startsWith('/gestion'));
    router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        const primera = e.urlAfterRedirects.split(/[/?#]/)[1] ?? '';
        raiz.dataset['seccion'] = SECCIONES.includes(primera) ? primera : 'inicio';
        this.enGestion.set(primera === 'gestion');
      });
  }
}
