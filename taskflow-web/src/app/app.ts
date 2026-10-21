import { Component, DOCUMENT, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeService } from './services/theme.service';
import { SesionService } from './auth/sesion.service';
import { GuiaRecorridoComponent } from './shared/guia-recorrido/guia-recorrido.component';
import { IconoComponent } from './shared/icono/icono.component';

const SECCIONES = ['gestion', 'tienda', 'arena', 'ingresar'];

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, GuiaRecorridoComponent, IconoComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly sesion = inject(SesionService);

  constructor(public themeService: ThemeService) {
    // Marca la sección actual en <html>: el CSS toma de ahí el color de identidad de cada pantalla.
    const raiz = inject(DOCUMENT).documentElement;
    inject(Router)
      .events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        const primera = e.urlAfterRedirects.split(/[/?#]/)[1] ?? '';
        raiz.dataset['seccion'] = SECCIONES.includes(primera) ? primera : 'inicio';
      });
  }
}
