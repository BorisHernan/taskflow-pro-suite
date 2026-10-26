import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GestionService, mensajeDeError } from '../gestion.service';
import { IconoComponent } from '../../shared/icono/icono.component';
import { AvisosService } from '../../shared/ui/avisos.service';

interface Reporte {
  tipo: string;
  nombre: string;
  detalle: string;
  usaFechas: boolean;
}

function isoDia(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Exportaciones CSV para el administrador (abren bien en Excel, con tildes). */
@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [FormsModule, IconoComponent],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss',
})
export class ReportesComponent {
  readonly gestion = inject(GestionService);
  private readonly avisos = inject(AvisosService);

  readonly reportes: Reporte[] = [
    { tipo: 'ventas', nombre: 'Ventas', detalle: 'Cada compra de la tienda online con su sede, producto, cantidad y total.', usaFechas: true },
    { tipo: 'inventario', nombre: 'Inventario', detalle: 'Foto actual del stock por sede, con mínimo y objetivo.', usaFechas: false },
    { tipo: 'mermas', nombre: 'Mermas', detalle: 'Pérdidas por motivo, valorizadas al costo, con quién las registró.', usaFechas: true },
    { tipo: 'pedidos', nombre: 'Compras', detalle: 'Pedidos de reposición, su estado, quién pidió y quién aprobó.', usaFechas: true },
    { tipo: 'incidencias', nombre: 'Incidencias', detalle: 'Qué pasó, su severidad, cuándo se resolvió y cómo.', usaFechas: true },
    { tipo: 'tareas', nombre: 'Tareas', detalle: 'Tareas del tablero por tipo y prioridad, con fecha de cierre.', usaFechas: true },
  ];

  hasta = isoDia(new Date());
  desde = isoDia(new Date(Date.now() - 29 * 86400000));
  readonly descargando = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  descargar(r: Reporte): void {
    this.descargando.set(r.tipo);
    this.error.set(null);
    this.gestion.descargarReporte(r.tipo, this.desde, this.hasta).subscribe({
      next: ({ nombre, archivo }) => {
        const url = URL.createObjectURL(archivo);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.descargando.set(null);
        this.avisos.exito(`Descargado ${nombre}.`);
      },
      error: (err) => {
        this.descargando.set(null);
        this.error.set(mensajeDeError(err, 'No se pudo generar el reporte.'));
      },
    });
  }
}
