import { Component, DestroyRef, ElementRef, OnDestroy, OnInit, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { StatsService } from '../services/stats.service';
import { RECORRIDO } from '../shared/recorrido';
import { ActividadEnVivoService } from './actividad-en-vivo.service';
import { DiagramaVivoComponent } from './diagrama-vivo/diagrama-vivo.component';

const FORMATO_NUMERO = new Intl.NumberFormat('es-PE');
const FORMATO_RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

type EstadoServidor = 'despertando' | 'en-linea' | 'sin-respuesta';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DiagramaVivoComponent],
  providers: [ActividadEnVivoService],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly statsService = inject(StatsService);
  readonly vivo = inject(ActividadEnVivoService);

  readonly pasos = RECORRIDO;
  readonly nombresCortos = ['Tablero', 'Tienda', 'Estadísticas', 'Arena'];
  readonly capturas = [
    { src: 'img/demo-tablero.jpg', alt: 'Tablero kanban con tareas en tres columnas' },
    { src: 'img/demo-tienda.jpg', alt: 'Catálogo de la tienda con productos y stock' },
    { src: 'img/demo-estadisticas.jpg', alt: 'Panel de estadísticas con gráficos de ventas y visitas' },
    { src: 'img/demo-arena.jpg', alt: 'Partida de la arena multijugador con células y bots' },
  ];
  readonly escalones = [
    { linea: 'Alguien mueve una tarjeta.', texto: 'Desde cualquier navegador. La pantalla cambia al instante y el orden se confirma en una sola llamada.' },
    { linea: 'Spring la guarda sin esperar.', texto: 'WebFlux y R2DBC: ningún hilo queda bloqueado mientras responde PostgreSQL.' },
    { linea: 'El servidor la difunde.', texto: 'Un Sink de Reactor emite el cambio por Server-Sent Events a cada visitante conectado.' },
    { linea: 'Tu pantalla cambia sola.', texto: 'Sin recargar. Es lo que aparece arriba, en la lista de lo último que hicieron los visitantes.' },
  ];
  readonly stackBackend: [string, string][] = [
    ['Java 21', 'lenguaje'],
    ['Spring Boot 3', 'base'],
    ['Spring WebFlux', 'API reactiva'],
    ['R2DBC y Flyway', 'datos y migraciones'],
    ['PostgreSQL en Neon', 'base de datos'],
    ['JUnit 5 y Mockito', 'tests'],
  ];
  readonly stackFrontend: [string, string][] = [
    ['Angular 22', 'signals, sin zone.js'],
    ['RxJS', 'streams SSE'],
    ['WebSocket', 'arena a 10 ticks/s'],
    ['Vitest', 'tests'],
    ['Docker en Render', 'backend'],
    ['Vercel', 'frontend'],
  ];
  readonly anio = new Date().getFullYear();
  /** Fila del listado de demos cuya captura se muestra al costado. */
  readonly vistaPrevia = signal<number | null>(null);
  readonly backendBaseUrl = environment.apiUrl.replace(/\/api\/tasks\/?$/, '');

  estado = signal<EstadoServidor>('despertando');
  visitas = signal<string | null>(null);
  // Hace que "hace 5 s" se recalcule solo, sin que llegue un evento nuevo.
  ahora = signal(Date.now());
  private reloj?: ReturnType<typeof setInterval>;

  constructor() {
    // Cada bloque marcado con data-revelar entra una sola vez al llegar a la pantalla.
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      host.classList.add('con-js');
      if (!('IntersectionObserver' in window)) return;
      const observador = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (!e.isIntersecting) continue;
            e.target.classList.add('revelado');
            observador.unobserve(e.target);
          }
        },
        { rootMargin: '0px 0px -12% 0px' },
      );
      host.querySelectorAll('[data-revelar]').forEach((el) => observador.observe(el));
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  // Pedir las estadísticas también despierta el backend de Render (plan gratuito):
  // mientras el visitante lee la portada, el servidor ya va arrancando.
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
