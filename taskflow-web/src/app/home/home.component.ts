import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { SesionService } from '../auth/sesion.service';
import { StatsService } from '../services/stats.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { NombreIcono } from '../shared/icono/iconos';
import { ActividadEnVivoService } from './actividad-en-vivo.service';
import { DiagramaVivoComponent } from './diagrama-vivo/diagrama-vivo.component';

const FORMATO_NUMERO = new Intl.NumberFormat('es-PE');
const FORMATO_RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

type EstadoServidor = 'despertando' | 'en-linea' | 'sin-respuesta';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DiagramaVivoComponent, IconoComponent],
  providers: [ActividadEnVivoService],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly statsService = inject(StatsService);
  readonly vivo = inject(ActividadEnVivoService);
  readonly sesion = inject(SesionService);

  readonly backendBaseUrl = environment.apiUrl.replace(/\/api\/tasks\/?$/, '');
  readonly anio = new Date().getFullYear();

  readonly flujos: { icono: NombreIcono; titulo: string; texto: string }[] = [
    {
      icono: 'inventario',
      titulo: 'Alertas de stock',
      texto: 'Cuando una venta o una merma deja un producto en su mínimo, se crea la tarea de reposición en el tablero de esa tienda.',
    },
    {
      icono: 'envio',
      titulo: 'Compras con aprobación',
      texto: 'La tienda pide reposición, la administración aprueba y, al recibir el pedido, el stock sube y la alerta se cierra.',
    },
    {
      icono: 'incidencia',
      titulo: 'Incidencias',
      texto: 'Las de severidad alta o crítica abren una tarea; resolverla cierra la incidencia y queda registrada la solución.',
    },
    {
      icono: 'reloj',
      titulo: 'Turnos',
      texto: 'Abrir un turno genera su checklist; al cerrarlo se obtiene el resumen de ventas, mermas e incidencias del turno.',
    },
  ];

  readonly roles = [
    {
      nombre: 'Administración',
      cuenta: 'admin',
      puede: [
        'Ve las tres tiendas juntas o una a la vez',
        'Aprueba o rechaza los pedidos de reposición',
        'Ajusta el stock mínimo y objetivo de cada producto',
        'Consulta estadísticas y descarga reportes en CSV',
      ],
    },
    {
      nombre: 'Encargado de tienda',
      cuenta: 'miraflores, sanisidro o surco',
      puede: [
        'Gestiona las tareas de su sede en tiempo real',
        'Revisa su inventario y pide reposición',
        'Registra mermas e incidencias',
        'Abre y cierra turnos con su checklist',
      ],
    },
  ];

  readonly stack: [string, string][] = [
    ['Backend', 'Java 21, Spring Boot 3, Spring WebFlux, Spring Security (JWT), R2DBC, Flyway'],
    ['Base de datos', 'PostgreSQL con migraciones versionadas e índices parciales'],
    ['Frontend', 'Angular 22 con signals y componentes standalone, RxJS'],
    ['Tiempo real', 'Server-Sent Events autenticados y WebSocket para el juego'],
    ['Calidad', 'JUnit 5, Mockito, pruebas de integración con PostgreSQL embebido, Vitest, CI en GitHub Actions'],
    ['Despliegue', 'Docker en Render, Vercel y PostgreSQL en Neon'],
  ];

  estado = signal<EstadoServidor>('despertando');
  visitas = signal<string | null>(null);
  ahora = signal(Date.now());
  private reloj?: ReturnType<typeof setInterval>;

  // Pedir las estadísticas también despierta el backend gratuito mientras el visitante lee.
  ngOnInit(): void {
    this.statsService.getStats().subscribe({
      next: (stats) => {
        this.visitas.set(FORMATO_NUMERO.format(stats.totalVisitsAllTime));
        this.estado.set('en-linea');
      },
      error: () => this.estado.set('sin-respuesta'),
    });
    this.vivo.iniciar();
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 5000);
  }

  ngOnDestroy(): void {
    this.vivo.detener();
    clearInterval(this.reloj);
  }

  haceCuanto(fecha: Date): string {
    const segundos = Math.round((fecha.getTime() - this.ahora()) / 1000);
    if (segundos > -10) return 'ahora';
    if (segundos > -60) return FORMATO_RELATIVO.format(segundos, 'second');
    return FORMATO_RELATIVO.format(Math.round(segundos / 60), 'minute');
  }
}
