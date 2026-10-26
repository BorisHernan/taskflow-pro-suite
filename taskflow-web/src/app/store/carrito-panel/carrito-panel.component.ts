import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartItem } from '../../models/product.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { IconoComponent } from '../../shared/icono/icono.component';
import { ProductIconComponent } from '../product-icon/product-icon.component';
import { CarritoService } from '../servicios/carrito.service';
import { CatalogoService } from '../servicios/catalogo.service';
import { MapaSedesComponent } from '../../shared/mapa/mapa-sedes.component';
import { fotosDe } from '../fotos-productos';
import { COBERTURA_KM, estimarEnvio, puntoDeEjemplo } from '../../shared/entrega/entrega';

/** Panel lateral del carrito, igual en el catálogo y en el detalle de producto. */
@Component({
  selector: 'app-carrito-panel',
  standalone: true,
  imports: [FormsModule, RouterLink, SolesPipe, IconoComponent, ProductIconComponent, MapaSedesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './carrito-panel.component.html',
  styleUrl: './carrito-panel.component.scss',
})
export class CarritoPanelComponent {
  readonly carrito = inject(CarritoService);
  readonly catalogo = inject(CatalogoService);
  ubicando = false;
  readonly fotosDe = fotosDe;
  readonly cobertura = COBERTURA_KM;
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

  /** Ubicación del navegador (el propio navegador pide permiso al usuario). */
  usarMiUbicacion(): void {
    if (!navigator.geolocation) {
      this.carrito.avisar('Tu navegador no permite obtener la ubicación. Marca tu casa en el mapa.', true);
      return;
    }
    this.ubicando = true;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.ubicando = false;
        const aqui = { lat: p.coords.latitude, lng: p.coords.longitude };
        const t = this.catalogo.tiendas().find((x) => x.id === this.catalogo.sede());
        if (t?.latitud == null || t.longitud == null) return this.carrito.destino.set(aqui);
        const sede = { lat: t.latitud, lng: t.longitud };
        // Fuera de la zona de reparto (por ejemplo, si visitas desde otra ciudad), se usa un punto de ejemplo en Lima.
        if (estimarEnvio(sede, aqui, 1).enCobertura) {
          this.carrito.destino.set(aqui);
        } else {
          this.carrito.destino.set(puntoDeEjemplo(sede));
          this.carrito.avisar(`Tu ubicación está fuera de la zona de reparto. Para la demo marcamos un punto de ejemplo cerca de ${t.nombre}.`);
        }
      },
      () => {
        this.ubicando = false;
        this.carrito.avisar('No se pudo obtener tu ubicación. Marca tu casa en el mapa.', true);
      },
      { timeout: 8000 },
    );
  }

  async pagar(): Promise<void> {
    const r = await this.carrito.pagar();
    if (r.ok) this.router.navigate(['/tienda/boleta']);
    else this.carrito.avisar(r.mensaje, true);
  }
}
