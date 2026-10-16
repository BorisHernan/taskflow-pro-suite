import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SolesPipe } from '../../shared/soles.pipe';
import { IconoComponent } from '../../shared/icono/icono.component';
import { CarritoService } from '../servicios/carrito.service';

@Component({
  selector: 'app-boleta',
  standalone: true,
  imports: [DatePipe, RouterLink, SolesPipe, IconoComponent],
  templateUrl: './boleta.component.html',
  styleUrl: './boleta.component.scss',
})
export class BoletaComponent implements OnInit {
  readonly carrito = inject(CarritoService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    // Sin compra reciente (recarga o enlace directo) no hay boleta que mostrar.
    if (!this.carrito.boleta()) this.router.navigate(['/tienda'], { replaceUrl: true });
  }

  imprimir(): void {
    window.print();
  }
}
