import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { StatsService } from '../services/stats.service';
import { RECORRIDO } from '../shared/recorrido';
import { ActividadEnVivoService } from './actividad-en-vivo.service';
import { DiagramaVivoComponent } from './diagrama-vivo/diagrama-vivo.component';
import { IconoComponent } from '../shared/icono/icono.component';

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

  readonly pasos = RECORRIDO;
  readonly backendBaseUrl = environment.apiUrl.replace(/\/api\/tasks\/?$/, '');

  estado = signal<EstadoServidor>('despertando');
  visitas = signal<string | null>(null);
  // Hace que "hace 5 s" se recalcule solo, sin que llegue un evento nuevo.
  ahora = signal(Date.now());
  private reloj?: ReturnType<typeof setInterval>;

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
