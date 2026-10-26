import { ViewportScroller } from '@angular/common';
import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeService } from './services/theme.service';
import { SesionService } from './auth/sesion.service';
import { AvisosComponent } from './shared/ui/avisos.component';
import { ConfirmacionComponent } from './shared/ui/confirmacion.component';
import { SelectorTemaComponent } from './shared/ui/selector-tema.component';
import { BotonCarritoComponent } from './store/boton-carrito/boton-carrito.component';
import { MenuCategoriasComponent } from './store/menu-categorias/menu-categorias.component';
import { TourComponent } from './shared/tour/tour.component';
import { EN_MONITOR } from './shared/monitor/en-monitor';
import { MonitorComponent } from './shared/monitor/monitor.component';
import { TelefonoEmpleadoComponent } from './shared/telefono/telefono-empleado.component';

const SECCIONES = ['gestion', 'tienda', 'arena', 'ingresar'];

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterOutlet,
    AvisosComponent,
    ConfirmacionComponent,
    SelectorTemaComponent,
    BotonCarritoComponent,
    MenuCategoriasComponent,
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
  /** En la tienda la cabecera muestra la marca Quechuti en vez de TaskFlow. */
  readonly enTienda = signal(false);
  readonly enMonitor = EN_MONITOR;
  private readonly router = inject(Router);
  /** Texto de la búsqueda de la tienda, para que la caja de la cabecera lo conserve. */
  readonly consulta = signal('');

  buscar(e: Event, q: string): void {
    e.preventDefault();
    this.router.navigate(['/tienda'], { queryParams: { q: q.trim() || null }, fragment: 'catalogo' });
  }

  constructor() {
    const documento = inject(DOCUMENT);
    const raiz = documento.documentElement;
    const router = inject(Router);
    inject(ViewportScroller).setOffset([0, 140]);
    // En el monitor del recorrido, la ventana principal decide qué pantalla mostrar.
    if (EN_MONITOR) (window as any).__tfNavegar = (url: string) => router.navigateByUrl(url);
    this.enGestion.set(location.pathname.startsWith('/gestion'));
    this.enTienda.set(location.pathname.startsWith('/tienda'));
    router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        const primera = e.urlAfterRedirects.split(/[/?#]/)[1] ?? '';
        raiz.dataset['seccion'] = SECCIONES.includes(primera) ? primera : 'inicio';
        this.enGestion.set(primera === 'gestion');
        this.enTienda.set(primera === 'tienda');
        // La pestaña también lleva el logo de la tienda.
        const icono = documento.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (icono) icono.href = primera === 'tienda' ? 'img/quechuti.svg' : 'favicon.svg?v=4';
        const arbol = router.parseUrl(e.urlAfterRedirects);
        this.consulta.set(primera === 'tienda' ? (arbol.queryParams['q'] ?? '') : '');
      });
  }
}
