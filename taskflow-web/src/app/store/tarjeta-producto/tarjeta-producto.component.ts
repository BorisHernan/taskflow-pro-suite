import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, RatingSummary, STOCK_BAJO } from '../../models/product.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { IconoComponent } from '../../shared/icono/icono.component';
import { ProductIconComponent } from '../product-icon/product-icon.component';
import { EstrellasComponent } from '../estrellas/estrellas.component';
import { CarritoService } from '../servicios/carrito.service';

@Component({
  selector: 'app-tarjeta-producto',
  standalone: true,
  imports: [RouterLink, SolesPipe, IconoComponent, ProductIconComponent, EstrellasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tarjeta-producto.component.html',
  styleUrl: './tarjeta-producto.component.scss',
})
export class TarjetaProductoComponent {
  readonly carrito = inject(CarritoService);

  readonly producto = input.required<Product>();
  readonly valoracion = input<RatingSummary | undefined>();
  /** Stock máximo del catálogo, para que las barras sean comparables entre tarjetas. */
  readonly stockMaximo = input(50);

  readonly stockBajo = STOCK_BAJO;
  readonly enCarrito = computed(() => this.carrito.cantidad(this.producto().id));
  readonly porcentaje = computed(() => Math.round((this.producto().stock / Math.max(1, this.stockMaximo())) * 100));
  readonly sinMas = computed(() => this.producto().stock === 0 || this.enCarrito() >= this.producto().stock);
}
