import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SesionService } from '../../auth/sesion.service';
import { GraficoSerieComponent } from '../../dashboard/graficos/grafico-serie.component';
import { Punto } from '../../dashboard/graficos/comun';
import { FilaInventario, Incidencia, NOMBRE_SEVERIDAD, ResumenTienda, Venta, VentaDia } from '../../models/gestion.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { GestionService, mensajeDeError } from '../gestion.service';

const DIA = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const SOLES = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });

/** Lo que importa hoy: ventas, alertas, tareas urgentes, incidencias y el turno en curso. */
@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [RouterLink, DatePipe, SolesPipe, GraficoSerieComponent],
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.scss',
})
export class ResumenComponent {
  readonly gestion = inject(GestionService);
  readonly sesion = inject(SesionService);
  readonly nombreSeveridad = NOMBRE_SEVERIDAD;
  readonly formatoSoles = (n: number) => SOLES.format(n);

  readonly filas = signal<ResumenTienda[]>([]);
  readonly ventas = signal<Venta[]>([]);
  readonly porDia = signal<VentaDia[]>([]);
  readonly alertas = signal<FilaInventario[]>([]);
  readonly incidencias = signal<Incidencia[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly hoy = new Date();
  readonly todas = computed(() => this.gestion.tiendaActiva() == null);
  readonly titulo = computed(() =>
    this.todas() ? 'Las tres tiendas, hoy' : `${this.gestion.nombreTienda(this.gestion.tiendaActiva())}, hoy`,
  );

  readonly total = computed(() => {
    const f = this.filas();
    const suma = (k: keyof ResumenTienda) => f.reduce((a, r) => a + Number(r[k] ?? 0), 0);
    return {
      ventasHoy: suma('ventasHoy'),
      comprasHoy: suma('comprasHoy'),
      alertas: suma('alertas'),
      agotados: suma('agotados'),
      tareasAbiertas: suma('tareasAbiertas'),
      tareasUrgentes: suma('tareasUrgentes'),
      incidencias: suma('incidenciasAbiertas'),
      pedidos: suma('pedidosEnCurso'),
      mermasMes: suma('mermasMes'),
    };
  });

  readonly turno = computed(() => (this.todas() ? null : (this.filas()[0]?.turnoResponsable ?? null)));

  /** Serie de 14 días con los días sin ventas en cero. */
  readonly serie = computed<Punto[]>(() => {
    const porFecha = new Map(this.porDia().map((d) => [d.fecha, Number(d.ingresos)]));
    const hoy = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (13 - i)));
      const clave = d.toISOString().slice(0, 10);
      return { etiqueta: DIA.format(d), valor: porFecha.get(clave) ?? 0 };
    });
  });

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    this.cargando.set(true);
    forkJoin({
      filas: this.gestion.resumen(),
      ventas: this.gestion.ventas(),
      porDia: this.gestion.ventasPorDia(),
      inventario: this.gestion.inventario(),
      incidencias: this.gestion.incidencias(),
    }).subscribe({
      next: (r) => {
        this.filas.set(r.filas);
        this.ventas.set(r.ventas.slice(0, 8));
        this.porDia.set(r.porDia);
        this.alertas.set(r.inventario.filter((f) => f.estado !== 'OK').slice(0, 6));
        this.incidencias.set(r.incidencias.filter((i) => i.estado !== 'RESUELTA').slice(0, 4));
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(mensajeDeError(err, 'No se pudo cargar el resumen.'));
        this.cargando.set(false);
      },
    });
  }

  verTienda(id: number): void {
    this.gestion.elegirTienda(id);
  }
}
