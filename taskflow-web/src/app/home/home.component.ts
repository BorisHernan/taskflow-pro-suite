import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { SesionService } from '../auth/sesion.service';
import { StatsService } from '../services/stats.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { NombreIcono } from '../shared/icono/iconos';

type EstadoServidor = 'despertando' | 'en-linea' | 'sin-respuesta';

/** Portada de una sola pantalla: el sistema, sus dos entradas y quién lo construyó. */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, IconoComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly statsService = inject(StatsService);
  readonly sesion = inject(SesionService);

  readonly backendBaseUrl = environment.apiUrl.replace(/\/api\/tasks\/?$/, '');
  readonly anio = new Date().getFullYear();

  readonly como: [string, string][] = [
    ['Backend', 'Java 21 · Spring Boot 3 · WebFlux'],
    ['Seguridad', 'JWT, dos roles y cada sede aislada'],
    ['Tiempo real', 'Server-Sent Events autenticados'],
    ['Datos', 'PostgreSQL · Flyway · stock atómico'],
    ['Calidad', '107 pruebas automáticas · CI en GitHub'],
  ];

  /** El recorrido de una venta, en cuatro pasos. */
  readonly pasos: { icono: NombreIcono; texto: string }[] = [
    { icono: 'carrito', texto: 'Se vende' },
    { icono: 'inventario', texto: 'Stock al mínimo' },
    { icono: 'tablero', texto: 'Nace la tarea' },
    { icono: 'envio', texto: 'Se repone' },
  ];

  readonly estado = signal<EstadoServidor>('despertando');

  // Pedir las estadísticas también despierta el backend gratuito mientras el visitante lee.
  ngOnInit(): void {
    this.statsService.getStats().subscribe({
      next: () => this.estado.set('en-linea'),
      error: () => this.estado.set('sin-respuesta'),
    });
  }
}
