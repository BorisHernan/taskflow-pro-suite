import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { StatsService } from '../services/stats.service';
import { RECORRIDO } from '../shared/recorrido';

const FORMATO_NUMERO = new Intl.NumberFormat('es-PE');

type EstadoServidor = 'despertando' | 'en-linea' | 'sin-respuesta';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly statsService = inject(StatsService);

  readonly pasos = RECORRIDO;
  readonly backendBaseUrl = environment.apiUrl.replace(/\/api\/tasks\/?$/, '');

  estado = signal<EstadoServidor>('despertando');
  visitas = signal<string | null>(null);

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
  }
}
