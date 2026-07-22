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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  stats = signal<StatsSnapshot | null>(null);
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
        this.stockBars.set(this.buildStockBars(products));
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
}
