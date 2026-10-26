import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { SesionService } from '../auth/sesion.service';
import { StatsService } from '../services/stats.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { NombreIcono } from '../shared/icono/iconos';

type EstadoServidor = 'despertando' | 'en-linea' | 'sin-respuesta';

/** Portada corta: el sistema, quién lo construyó y cómo funciona. */
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
    ['Backend', 'Java 21, Spring Boot 3 y WebFlux: una API reactiva que no bloquea hilos.'],
    ['Seguridad', 'Login con JWT y dos roles; cada sede está aislada en el servidor.'],
    ['Tiempo real', 'Server-Sent Events autenticados: los cambios llegan sin recargar.'],
    ['Datos', 'PostgreSQL con migraciones Flyway; el stock se descuenta de forma atómica.'],
    ['Calidad', '59 pruebas de backend y 48 de frontend, ejecutadas en CI con GitHub Actions.'],
  ];

  readonly flujo: { icono: NombreIcono; titulo: string; texto: string }[] = [
    { icono: 'carrito', titulo: 'Se vende en la tienda online', texto: 'La compra descuenta el stock de la sede elegida.' },
    { icono: 'inventario', titulo: 'El stock llega al mínimo', texto: 'El sistema lo detecta producto por producto y sede por sede.' },
    { icono: 'tablero', titulo: 'Aparece la tarea de reposición', texto: 'En el tablero de esa sede, en tiempo real y con su prioridad.' },
    { icono: 'envio', titulo: 'Se pide, se aprueba y se recibe', texto: 'El stock sube y la tarea se cierra sola, con el motivo registrado.' },
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
