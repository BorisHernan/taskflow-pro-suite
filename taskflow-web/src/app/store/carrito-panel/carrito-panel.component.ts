import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartItem } from '../../models/product.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { IconoComponent } from '../../shared/icono/icono.component';
import { ProductIconComponent } from '../product-icon/product-icon.component';
import { CarritoService } from '../servicios/carrito.service';

/** Panel lateral del carrito, igual en el catálogo y en el detalle de producto. */
@Component({
  selector: 'app-carrito-panel',
  standalone: true,
  imports: [FormsModule, RouterLink, SolesPipe, IconoComponent, ProductIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './carrito-panel.component.html',
  styleUrl: './carrito-panel.component.scss',
})
export class CarritoPanelComponent {
  readonly carrito = inject(CarritoService);
  private readonly router = inject(Router);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  codigoCupon = '';
  verCupones = false;

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.carrito.abierto() && !d.open) d.showModal();
      if (!this.carrito.abierto() && d.open) d.close();
    });
  }

  cerrar(): void {
    this.carrito.abierto.set(false);
  }

  /** Clic en el fondo oscuro (fuera del panel) cierra. */
  clicFondo(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) this.cerrar();
  }

  cambiar(item: CartItem, delta: number): void {
    const r = this.carrito.cambiarCantidad(item, delta);
    if (!r.ok) this.carrito.avisar(r.mensaje, true);
  }

  aplicarCupon(codigo = this.codigoCupon): void {
    if (!codigo.trim()) return;
    const r = this.carrito.aplicarCupon(codigo);
    if (r.ok) this.codigoCupon = '';
    else this.carrito.avisar(r.mensaje, true);
  }

  async pagar(): Promise<void> {
    const r = await this.carrito.pagar();
    if (r.ok) this.router.navigate(['/tienda/boleta']);
    else this.carrito.avisar(r.mensaje, true);
  }
}
