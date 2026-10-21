import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SesionService } from '../auth/sesion.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { NombreIcono } from '../shared/icono/iconos';
import { GestionService } from './gestion.service';

interface Seccion {
  ruta: string;
  nombre: string;
  icono: NombreIcono;
  soloAdmin?: boolean;
}

/** Marco del área de gestión: menú según el rol y, para el admin, la tienda que está mirando. */
@Component({
  selector: 'app-gestion-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconoComponent],
  templateUrl: './gestion-layout.component.html',
  styleUrl: './gestion-layout.component.scss',
})
export class GestionLayoutComponent {
  readonly sesion = inject(SesionService);
  readonly gestion = inject(GestionService);
  readonly tiendas = toSignal(this.gestion.tiendas$, { initialValue: [] });

  private readonly secciones: Seccion[] = [
    { ruta: 'resumen', nombre: 'Resumen', icono: 'resumen' },
    { ruta: 'tablero', nombre: 'Tareas', icono: 'tablero' },
    { ruta: 'inventario', nombre: 'Inventario', icono: 'inventario' },
    { ruta: 'compras', nombre: 'Compras', icono: 'envio' },
    { ruta: 'mermas', nombre: 'Mermas', icono: 'merma' },
    { ruta: 'incidencias', nombre: 'Incidencias', icono: 'incidencia' },
    { ruta: 'turnos', nombre: 'Turnos', icono: 'reloj' },
    { ruta: 'estadisticas', nombre: 'Estadísticas', icono: 'estadisticas', soloAdmin: true },
    { ruta: 'reportes', nombre: 'Reportes', icono: 'descargar', soloAdmin: true },
  ];

  readonly menu = computed(() => this.secciones.filter((s) => !s.soloAdmin || this.sesion.esAdmin()));

  readonly nombreTienda = computed(() => {
    const id = this.gestion.tiendaActiva();
    return id == null ? 'Todas las tiendas' : (this.tiendas().find((t) => t.id === id)?.nombre ?? '');
  });

  elegir(valor: string): void {
    this.gestion.elegirTienda(valor ? Number(valor) : null);
  }
}
