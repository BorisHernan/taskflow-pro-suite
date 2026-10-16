import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { HistorialStats, StatsSnapshot } from '../models/stats.model';
import { StatsService } from '../services/stats.service';
import { SolesPipe } from '../shared/soles.pipe';
import { IconoComponent } from '../shared/icono/icono.component';
import { NombreIcono } from '../shared/icono/iconos';
import { Punto, Segmento } from './graficos/comun';
import { GraficoSerieComponent } from './graficos/grafico-serie.component';
import { GraficoDonaComponent } from './graficos/grafico-dona.component';
import { TarjetaGraficoComponent } from './graficos/tarjeta-grafico.component';

interface Kpi {
  clave: keyof StatsSnapshot;
  etiqueta: string;
  icono: NombreIcono;
  moneda?: boolean;
  persistido?: boolean;
}

const EMPTY_STATS: StatsSnapshot = {
  tasksCreated: 0,
  purchases: 0,
  unitsSold: 0,
  revenue: 0,
  totalVisitors: 0,
  totalVisitsAllTime: 0,
};

const CADA_MS = 15000;
const DIAS = 30;
const FORMATO_NUMERO = new Intl.NumberFormat('es-PE');
const FORMATO_SOLES = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });
const FORMATO_RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const DIA_CORTO = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DIA_LARGO = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Paleta categórica de los gráficos (definida en el SCSS, con versión para modo oscuro). */
const PALETA = ['var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g4)', 'var(--g5)', 'var(--g6)', 'var(--g7)'];

const ESTADOS: Record<string, { etiqueta: string; color: string }> = {
  TODO: { etiqueta: 'Por hacer', color: 'var(--g4)' },
  IN_PROGRESS: { etiqueta: 'En progreso', color: 'var(--g2)' },
  DONE: { etiqueta: 'Hecho', color: 'var(--g1)' },
};

const unidades = (n: number) => FORMATO_NUMERO.format(Math.round(n));
const soles = (n: number) => FORMATO_SOLES.format(n);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SolesPipe, FormsModule, IconoComponent, GraficoSerieComponent, GraficoDonaComponent, TarjetaGraficoComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly kpis: Kpi[] = [
    { clave: 'totalVisitsAllTime', etiqueta: 'Visitas totales', icono: 'baseDatos', persistido: true },
    { clave: 'purchases', etiqueta: 'Compras realizadas', icono: 'carrito', persistido: true },
    { clave: 'unitsSold', etiqueta: 'Unidades vendidas', icono: 'paquete', persistido: true },
    { clave: 'revenue', etiqueta: 'Ingresos simulados', icono: 'billete', moneda: true, persistido: true },
    { clave: 'tasksCreated', etiqueta: 'Tareas creadas', icono: 'tablero' },
    { clave: 'totalVisitors', etiqueta: 'Conexiones en vivo', icono: 'ojo' },
  ];

  readonly unidades = unidades;
  readonly soles = soles;

  stats = signal<StatsSnapshot | null>(null);
  animatedStats = signal<StatsSnapshot>(EMPTY_STATS);
  historial = signal<HistorialStats | null>(null);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  /** Qué mide el gráfico de ventas por día. */
  medidaVentas = signal<'ingresos' | 'unidades'>('ingresos');

  autoActualizar = signal(true);
  ultimaActualizacion = signal<Date | null>(null);
  private ahora = signal(Date.now());
  private intervalo?: ReturnType<typeof setInterval>;
  private reloj?: ReturnType<typeof setInterval>;

  readonly haceCuanto = computed(() => {
    const fecha = this.ultimaActualizacion();
    if (!fecha) return '';
    const segundos = Math.round((fecha.getTime() - this.ahora()) / 1000);
    return segundos > -5 ? 'ahora' : FORMATO_RELATIVO.format(segundos, 'second');
  });

  // ── Series por día (los días sin datos cuentan como 0) ─────────────

  /** Últimos 30 días en UTC (así agrupa Postgres), del más antiguo a hoy. */
  private readonly dias = computed(() => {
    this.ultimaActualizacion();
    const hoy = new Date();
    return Array.from({ length: DIAS }, (_, i) => {
      const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - (DIAS - 1 - i)));
      return d.toISOString().slice(0, 10);
    });
  });

  private serie(valores: Map<string, number>): Punto[] {
    return this.dias().map((dia) => {
      const fecha = new Date(dia + 'T00:00:00Z');
      return { etiqueta: DIA_CORTO.format(fecha), detalle: DIA_LARGO.format(fecha), valor: valores.get(dia) ?? 0 };
    });
  }

  readonly serieVisitas = computed(() =>
    this.serie(new Map((this.historial()?.visitasPorDia ?? []).map((v) => [v.fecha, v.total]))),
  );

  readonly serieVentas = computed(() => {
    const medida = this.medidaVentas();
    return this.serie(new Map((this.historial()?.ventasPorDia ?? []).map((v) => [v.fecha, Number(v[medida])])));
  });

  readonly formatoVentas = computed(() => (this.medidaVentas() === 'ingresos' ? soles : unidades));

  // ── Agrupaciones ────────────────────────────────────────────────

  readonly segmentosCategoria = computed<Segmento[]>(() =>
    (this.historial()?.ventasPorCategoria ?? []).map((c, i) => ({
      etiqueta: c.nombre,
      valor: Number(c.ingresos),
      color: PALETA[i % PALETA.length],
    })),
  );

  readonly segmentosTareas = computed<Segmento[]>(() =>
    ['TODO', 'IN_PROGRESS', 'DONE'].map((clave) => ({
      etiqueta: ESTADOS[clave].etiqueta,
      valor: this.historial()?.tareasPorEstado.find((t) => t.clave === clave)?.total ?? 0,
      color: ESTADOS[clave].color,
    })),
  );

  readonly topProductos = computed(() => {
    const lista = this.historial()?.topProductos ?? [];
    const max = Math.max(1, ...lista.map((p) => p.unidades));
    return lista.map((p) => ({ ...p, porcentaje: Math.round((p.unidades / max) * 100) }));
  });

  readonly resenas = computed(() => {
    const lista = this.historial()?.resenasPorEstrellas ?? [];
    const total = lista.reduce((s, r) => s + r.total, 0);
    const filas = [5, 4, 3, 2, 1].map((e) => {
      const cuenta = lista.find((r) => r.clave === String(e))?.total ?? 0;
      return { estrellas: e, cuenta, porcentaje: total ? Math.round((cuenta / total) * 100) : 0 };
    });
    const promedio = total ? filas.reduce((s, f) => s + f.estrellas * f.cuenta, 0) / total : 0;
    return { filas, total, promedio };
  });

  readonly stockCategorias = computed(() =>
    (this.historial()?.stockPorCategoria ?? []).map((c) => ({
      ...c,
      porcentaje: c.inicial ? Math.round((c.stock / c.inicial) * 100) : 0,
    })),
  );

  // ── Lecturas automáticas ("lo importante" de cada gráfico) ──────

  readonly lecturaVisitas = computed(() => {
    const serie = this.serieVisitas();
    const total = serie.reduce((s, p) => s + p.valor, 0);
    if (total === 0) return 'Todavía no hay visitas en este periodo: cada persona nueva se guarda desde hoy.';
    const pico = serie.reduce((a, b) => (b.valor > a.valor ? b : a));
    const conDatos = serie.filter((p) => p.valor > 0).length;
    return `${unidades(total)} personas distintas en ${conDatos} ${conDatos === 1 ? 'día' : 'días'} con actividad. El pico fue el ${pico.detalle} con ${unidades(pico.valor)}.`;
  });

  readonly lecturaVentas = computed(() => {
    const serie = this.serieVentas();
    const total = serie.reduce((s, p) => s + p.valor, 0);
    if (total === 0) return 'Aún no hay ventas en los últimos 30 días. Compra algo en la tienda y vuelve aquí.';
    const mejor = serie.reduce((a, b) => (b.valor > a.valor ? b : a));
    return `Total del periodo: ${this.formatoVentas()(total)}. El mejor día fue el ${mejor.detalle} (${this.formatoVentas()(mejor.valor)}).`;
  });

  readonly lecturaCategorias = computed(() => {
    const segs = this.segmentosCategoria();
    const total = segs.reduce((s, x) => s + x.valor, 0);
    if (!total) return 'Sin ventas registradas todavía.';
    const lider = segs.reduce((a, b) => (b.valor > a.valor ? b : a));
    return `${lider.etiqueta} concentra el ${Math.round((lider.valor / total) * 100)} % de los ingresos.`;
  });

  readonly lecturaTop = computed(() => {
    const [primero, segundo] = this.topProductos();
    if (!primero) return 'Sin ventas registradas todavía.';
    return segundo
      ? `${primero.nombre} lidera con ${unidades(primero.unidades)} unidades; le sigue ${segundo.nombre}.`
      : `${primero.nombre} es el único vendido hasta ahora (${unidades(primero.unidades)} unidades).`;
  });

  readonly lecturaTareas = computed(() => {
    const segs = this.segmentosTareas();
    const total = segs.reduce((s, x) => s + x.valor, 0);
    if (!total) return 'El tablero está vacío.';
    return `${Math.round((segs[2].valor / total) * 100)} % de las ${total} tareas ya están hechas.`;
  });

  readonly lecturaResenas = computed(() => {
    const r = this.resenas();
    if (!r.total) return 'Aún no hay reseñas.';
    const positivas = r.filas[0].cuenta + r.filas[1].cuenta;
    return `Promedio de ${r.promedio.toFixed(1)} estrellas; el ${Math.round((positivas / r.total) * 100)} % de las opiniones son de 4 o 5.`;
  });

  readonly lecturaStock = computed(() => {
    const lista = this.stockCategorias();
    if (!lista.length) return '';
    const menor = lista.reduce((a, b) => (b.porcentaje < a.porcentaje ? b : a));
    return menor.porcentaje >= 100
      ? 'Todo el inventario está completo: cada noche se repone al stock inicial.'
      : `${menor.categoria} es la categoría más vendida respecto a su stock: le queda el ${menor.porcentaje} %.`;
  });

  constructor(private statsService: StatsService) {}

  ngOnInit(): void {
    this.refresh();
    this.programarAutoActualizacion();
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalo);
    clearInterval(this.reloj);
  }

  alternarAutoActualizar(activo: boolean): void {
    this.autoActualizar.set(activo);
    this.programarAutoActualizacion();
  }

  formatear(kpi: Kpi, valor: number): string {
    return kpi.moneda ? '' : FORMATO_NUMERO.format(Math.round(valor));
  }

  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      stats: this.statsService.getStats(),
      historial: this.statsService.getHistorial(),
    }).subscribe({
      next: ({ stats, historial }) => {
        this.stats.set(stats);
        this.animateStats(stats);
        this.historial.set(historial);
        this.ultimaActualizacion.set(new Date());
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar las estadísticas. El servidor gratuito puede estar despertando: reintenta en unos segundos.');
        this.loading.set(false);
      },
    });
  }

  private programarAutoActualizacion(): void {
    clearInterval(this.intervalo);
    if (this.autoActualizar()) {
      this.intervalo = setInterval(() => this.refresh(), CADA_MS);
    }
  }

  private animateStats(target: StatsSnapshot): void {
    const start = this.animatedStats();
    const duration = 800;
    const startTime = performance.now();
    const claves = Object.keys(target) as (keyof StatsSnapshot)[];

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const valores = { ...target };
      for (const k of claves) valores[k] = start[k] + (Number(target[k]) - start[k]) * eased;
      this.animatedStats.set(valores);
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }
}
