import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { Product } from '../models/product.model';
import { StatsSnapshot } from '../models/stats.model';
import { ProductService } from '../services/product.service';
import { StatsService } from '../services/stats.service';

interface StockBar {
  product: Product;
  percent: number;
}

const EMPTY_STATS: StatsSnapshot = {
  tasksCreated: 0,
  purchases: 0,
  unitsSold: 0,
  revenue: 0,
  totalVisitors: 0,
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  stats = signal<StatsSnapshot | null>(null);
  animatedStats = signal<StatsSnapshot>(EMPTY_STATS);
  stockBars = signal<StockBar[]>([]);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(private statsService: StatsService, private productService: ProductService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      stats: this.statsService.getStats(),
      products: this.productService.getAll(),
    }).subscribe({
      next: ({ stats, products }) => {
        this.stats.set(stats);
        this.animateStats(stats);

        const targetBars = this.buildStockBars(products);
        this.stockBars.set(targetBars.map((bar) => ({ ...bar, percent: 0 })));
        // Doble rAF: deja que el navegador pinte el 0% antes de animar al valor real.
        requestAnimationFrame(() => requestAnimationFrame(() => this.stockBars.set(targetBars)));

        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar las estadísticas. Verifica que el backend esté corriendo.');
        this.loading.set(false);
      },
    });
  }

  private buildStockBars(products: Product[]): StockBar[] {
    const maxStock = Math.max(...products.map((p) => p.stock), 1);
    return products.map((product) => ({
      product,
      percent: Math.round((product.stock / maxStock) * 100),
    }));
  }

  private animateStats(target: StatsSnapshot): void {
    const start = this.animatedStats();
    const duration = 800;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      this.animatedStats.set({
        tasksCreated: Math.round(start.tasksCreated + (target.tasksCreated - start.tasksCreated) * eased),
        purchases: Math.round(start.purchases + (target.purchases - start.purchases) * eased),
        unitsSold: Math.round(start.unitsSold + (target.unitsSold - start.unitsSold) * eased),
        revenue: start.revenue + (target.revenue - start.revenue) * eased,
        totalVisitors: Math.round(start.totalVisitors + (target.totalVisitors - start.totalVisitors) * eased),
      });

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }
}
