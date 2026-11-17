import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, RatingSummary, STOCK_BAJO } from '../../models/product.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { IconoComponent } from '../../shared/icono/icono.component';
import { ProductIconComponent } from '../product-icon/product-icon.component';
import { EstrellasComponent } from '../estrellas/estrellas.component';
import { CarritoService } from '../servicios/carrito.service';
import { FotosProductos } from '../fotos-productos';

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
  /** En la vista de lista la tarjeta es una fila. */
  readonly compacta = input(false);
  readonly valoracion = input<RatingSummary | undefined>();

  readonly stockBajo = STOCK_BAJO;
  private readonly galeria = inject(FotosProductos);
  readonly fotos = computed(() => this.galeria.fotosDe(this.producto()));
  readonly descuento = computed(() => {
    const { price, listPrice } = this.producto();
    return listPrice && listPrice > price ? Math.round((1 - price / listPrice) * 100) : 0;
  });
  readonly enCarrito = computed(() => this.carrito.cantidad(this.producto().id));
  readonly sinMas = computed(() => this.producto().stock === 0 || this.enCarrito() >= this.producto().stock);
}
