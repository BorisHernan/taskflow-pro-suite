import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SesionService } from '../../auth/sesion.service';
import { NOMBRE_TURNO, ResumenTurno, TipoTurno, Turno } from '../../models/gestion.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { GestionService, mensajeDeError } from '../gestion.service';

function tipoSegunHora(): TipoTurno {
  const h = new Date().getHours();
  return h < 14 ? 'MANANA' : h < 21 ? 'TARDE' : 'NOCHE';
}

/**
 * Turnos de trabajo: abrir genera el checklist en el tablero; mientras está
 * abierto, ventas, mermas e incidencias quedan a su nombre; al cerrar se ve el resumen.
 */
@Component({
  selector: 'app-turnos',
  standalone: true,
  imports: [FormsModule, DatePipe, NgTemplateOutlet, RouterLink, SolesPipe],
  templateUrl: './turnos.component.html',
  styleUrl: './turnos.component.scss',
})
export class TurnosComponent {
  readonly gestion = inject(GestionService);
  readonly sesion = inject(SesionService);
  readonly nombreTurno = NOMBRE_TURNO;
  readonly tipos = Object.keys(NOMBRE_TURNO) as TipoTurno[];

  readonly actual = signal<Turno | null>(null);
  readonly resumenActual = signal<ResumenTurno | null>(null);
  readonly historial = signal<Turno[]>([]);
  readonly cierre = signal<ResumenTurno | null>(null);
  readonly detalle = signal<ResumenTurno | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  tipo: TipoTurno = tipoSegunHora();
  responsable = this.sesion.usuario()?.nombre ?? '';
  notaApertura = '';
  notaCierre = '';

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    this.cargando.set(true);
    forkJoin({ actual: this.gestion.turnoActual(), historial: this.gestion.turnos() }).subscribe({
      next: ({ actual, historial }) => {
        this.actual.set(actual);
        this.historial.set(historial.filter((t) => t.estado === 'CERRADO'));
        this.cargando.set(false);
        if (actual) this.gestion.resumenTurno(actual.id).subscribe((r) => this.resumenActual.set(r));
        else this.resumenActual.set(null);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar los turnos.'));
      },
    });
  }

  abrir(): void {
    const responsable = this.responsable.trim();
    if (!responsable) return;
    this.gestion.abrirTurno({ tipo: this.tipo, responsable, nota: this.notaApertura.trim() || undefined }).subscribe({
      next: () => {
        this.cierre.set(null);
        this.notaApertura = '';
        this.error.set(null);
        this.cargar();
      },
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo abrir el turno.')),
    });
  }

  cerrar(t: Turno): void {
    this.gestion.cerrarTurno(t.id, this.notaCierre.trim() || undefined).subscribe({
      next: (resumen) => {
        this.cierre.set(resumen);
        this.notaCierre = '';
        this.error.set(null);
        this.cargar();
      },
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo cerrar el turno.')),
    });
  }

  verDetalle(t: Turno): void {
    if (this.detalle()?.turno.id === t.id) {
      this.detalle.set(null);
      return;
    }
    this.gestion.resumenTurno(t.id).subscribe((r) => this.detalle.set(r));
  }

  duracion(t: Turno): string {
    const fin = t.fin ? new Date(t.fin) : new Date();
    const minutos = Math.max(0, Math.round((fin.getTime() - new Date(t.inicio).getTime()) / 60000));
    return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
  }
}
