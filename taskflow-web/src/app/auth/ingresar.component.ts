import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { mensajeDeError } from '../gestion/gestion.service';
import { SesionService } from './sesion.service';

interface CuentaDemo {
  usuario: string;
  nombre: string;
  rol: string;
  detalle: string;
}

/** Login. Las cuentas son públicas: es la forma de recorrer la demo con cada rol. */
@Component({
  selector: 'app-ingresar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ingresar.component.html',
  styleUrl: './ingresar.component.scss',
})
export class IngresarComponent {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly claveDemo = 'demo1234';
  readonly cuentas: CuentaDemo[] = [
    {
      usuario: 'admin',
      nombre: 'Ana Torres',
      rol: 'Administradora',
      detalle: 'Ve las tres tiendas, aprueba pedidos, revisa estadísticas y descarga reportes.',
    },
    {
      usuario: 'miraflores',
      nombre: 'Luis Quispe',
      rol: 'Tienda Miraflores',
      detalle: 'Solo su sede: tareas, stock, turnos, mermas, incidencias y pedidos.',
    },
    {
      usuario: 'sanisidro',
      nombre: 'María Rojas',
      rol: 'Tienda San Isidro',
      detalle: 'Lo mismo, con el inventario y las tareas de San Isidro.',
    },
    {
      usuario: 'surco',
      nombre: 'Carlos Díaz',
      rol: 'Tienda Surco',
      detalle: 'La sede con más productos bajo el mínimo y pedidos esperando aprobación.',
    },
  ];

  usuario = '';
  clave = '';
  readonly enviando = signal<string | null>(null);
  readonly error = signal<string | null>(
    this.ruta.snapshot.queryParamMap.get('motivo') === 'expirada' ? 'Tu sesión expiró. Vuelve a entrar.' : null,
  );

  entrarComo(cuenta: CuentaDemo): void {
    this.usuario = cuenta.usuario;
    this.clave = this.claveDemo;
    this.entrar();
  }

  entrar(): void {
    const usuario = this.usuario.trim();
    if (!usuario || !this.clave || this.enviando()) return;
    this.enviando.set(usuario);
    this.error.set(null);
    this.sesion.ingresar(usuario, this.clave).subscribe({
      next: () => {
        const volver = this.ruta.snapshot.queryParamMap.get('volver');
        this.router.navigateByUrl(volver?.startsWith('/') ? volver : '/gestion');
      },
      error: (err) => {
        this.enviando.set(null);
        this.error.set(mensajeDeError(err, 'No se pudo iniciar sesión. El servidor gratuito puede estar despertando: reintenta en un minuto.'));
      },
    });
  }
}
