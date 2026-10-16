import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Product, STOCK_BAJO } from '../models/product.model';
import { StatsSnapshot } from '../models/stats.model';
import { ProductService } from '../services/product.service';
import { StatsService } from '../services/stats.service';
import { SolesPipe } from '../shared/soles.pipe';
import { IconoComponent } from '../shared/icono/icono.component';
import { NombreIcono } from '../shared/icono/iconos';


interface StockBar {
  product: Product;
  percent: number;
}

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
const FORMATO_NUMERO = new Intl.NumberFormat('es-PE');
const FORMATO_RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SolesPipe, FormsModule, IconoComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly kpis: Kpi[] = [
    { clave: 'totalVisitsAllTime', etiqueta: 'Visitas totales', icono: 'baseDatos', persistido: true },
    { clave: 'totalVisitors', etiqueta: 'Conexiones desde el último deploy', icono: 'ojo' },
    { clave: 'tasksCreated', etiqueta: 'Tareas creadas', icono: 'tablero' },
    { clave: 'purchases', etiqueta: 'Compras realizadas', icono: 'carrito' },
    { clave: 'unitsSold', etiqueta: 'Unidades vendidas', icono: 'paquete' },
    { clave: 'revenue', etiqueta: 'Ingresos simulados', icono: 'billete', moneda: true },
  ];
  readonly stockBajo = STOCK_BAJO;

  stats = signal<StatsSnapshot | null>(null);
  animatedStats = signal<StatsSnapshot>(EMPTY_STATS);
  stockBars = signal<StockBar[]>([]);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  autoActualizar = signal(true);
  ultimaActualizacion = signal<Date | null>(null);
  private ahora = signal(Date.now());
  private intervalo?: ReturnType<typeof setInterval>;
  private reloj?: ReturnType<typeof setInterval>;

  readonly productosBajos = computed(() => this.stockBars().filter((b) => b.product.stock <= STOCK_BAJO).length);

  readonly haceCuanto = computed(() => {
    const fecha = this.ultimaActualizacion();
    if (!fecha) return '';
    const segundos = Math.round((fecha.getTime() - this.ahora()) / 1000);
    return segundos > -5 ? 'ahora' : FORMATO_RELATIVO.format(segundos, 'second');
  });

  constructor(private statsService: StatsService, private productService: ProductService) {}

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
      products: this.productService.getAll(),
    }).subscribe({
      next: ({ stats, products }) => {
        this.stats.set(stats);
        this.animateStats(stats);
        this.stockBars.set(this.buildStockBars(products));
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

  /** De menor a mayor stock: lo que se está por agotar queda arriba. */
  private buildStockBars(products: Product[]): StockBar[] {
    const maxStock = Math.max(...products.map((p) => p.stock), 1);
    return [...products]
      .sort((a, b) => a.stock - b.stock)
      .map((product) => ({ product, percent: Math.round((product.stock / maxStock) * 100) }));
  }

  private animateStats(target: StatsSnapshot): void {
    const start = this.animatedStats();
    const duration = 800;
    const startTime = performance.now();
    const interpolar = (a: number, b: number, t: number) => a + (b - a) * t;

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      this.animatedStats.set({
        tasksCreated: interpolar(start.tasksCreated, target.tasksCreated, eased),
        purchases: interpolar(start.purchases, target.purchases, eased),
        unitsSold: interpolar(start.unitsSold, target.unitsSold, eased),
        revenue: interpolar(start.revenue, target.revenue, eased),
        totalVisitors: interpolar(start.totalVisitors, target.totalVisitors, eased),
        totalVisitsAllTime: interpolar(start.totalVisitsAllTime, target.totalVisitsAllTime, eased),
      });

      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }
}
