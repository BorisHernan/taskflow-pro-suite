import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, RatingSummary } from '../../models/product.model';
import { IconoComponent } from '../../shared/icono/icono.component';
import { ProductIconComponent } from '../product-icon/product-icon.component';
import { TarjetaProductoComponent } from '../tarjeta-producto/tarjeta-producto.component';

/** Un grupo de productos: panel de color con su título a la izquierda y la fila que se desplaza a la derecha. */
@Component({
  selector: 'app-riel-productos',
  standalone: true,
  imports: [RouterLink, IconoComponent, ProductIconComponent, TarjetaProductoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './riel-productos.component.html',
  styleUrl: './riel-productos.component.scss',
})
export class RielProductosComponent {
  readonly titulo = input.required<string>();
  readonly detalle = input('');
  readonly icono = input('box');
  /** Departamento: tiñe el panel con su color. */
  readonly categoria = input('');
  /** Colores propios del panel (por ejemplo, el rojo del 2×1); si faltan, se usa el del departamento. */
  readonly fondo = input('');
  readonly texto = input('');
  readonly productos = input.required<Product[]>();
  readonly valoraciones = input<Record<number, RatingSummary>>({});
  /** Parámetros del enlace "Ver todo" (departamento, oferta…). */
  readonly consulta = input<Record<string, string>>({});
  /** El primer producto de la primera fila lleva la marca del recorrido guiado. */
  readonly primero = input(false);

  private readonly pista = viewChild.required<ElementRef<HTMLElement>>('pista');

  mover(sentido: -1 | 1): void {
    const el = this.pista().nativeElement;
    el.scrollBy({ left: sentido * el.clientWidth * 0.85, behavior: 'smooth' });
  }
}
