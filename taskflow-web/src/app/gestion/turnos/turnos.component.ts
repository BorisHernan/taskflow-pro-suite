import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SesionService } from '../../auth/sesion.service';
import { NOMBRE_TURNO, ResumenTurno, TipoTurno, Turno } from '../../models/gestion.model';
import { Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { IconoComponent } from '../../shared/icono/icono.component';
import { SolesPipe } from '../../shared/soles.pipe';
import { AvisosService } from '../../shared/ui/avisos.service';
import { ConfirmacionService } from '../../shared/ui/confirmacion.service';
import { EstadoVistaComponent } from '../../shared/ui/estado-vista.component';
import { GestionService, mensajeDeError } from '../gestion.service';

function tipoSegunHora(): TipoTurno {
  const h = new Date().getHours();
  return h < 14 ? 'MANANA' : h < 21 ? 'TARDE' : 'NOCHE';
}

/**
 * Turnos: abrir genera el checklist; mientras está abierto, ventas, mermas e
 * incidencias quedan a su nombre; al cerrarlo se ve el resumen.
 */
@Component({
  selector: 'app-turnos',
  standalone: true,
  imports: [FormsModule, DatePipe, NgTemplateOutlet, RouterLink, SolesPipe, IconoComponent, EstadoVistaComponent],
  templateUrl: './turnos.component.html',
  styleUrl: './turnos.component.scss',
})
export class TurnosComponent {
  readonly gestion = inject(GestionService);
  readonly sesion = inject(SesionService);
  private readonly tareasApi = inject(TaskService);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacion = inject(ConfirmacionService);
  readonly nombreTurno = NOMBRE_TURNO;
  readonly tipos = Object.keys(NOMBRE_TURNO) as TipoTurno[];

  readonly actual = signal<Turno | null>(null);
  readonly resumenActual = signal<ResumenTurno | null>(null);
  readonly checklist = signal<Task[]>([]);
  readonly historial = signal<Turno[]>([]);
  readonly cierre = signal<ResumenTurno | null>(null);
  readonly detalle = signal<ResumenTurno | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly marcando = signal<number | null>(null);

  tipo: TipoTurno = tipoSegunHora();
  responsable = this.sesion.usuario()?.nombre ?? '';
  notaApertura = '';
  notaCierre = '';

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);
  readonly hechas = computed(() => this.checklist().filter((t) => t.status === 'DONE').length);
  readonly avance = computed(() => (this.checklist().length ? Math.round((this.hechas() / this.checklist().length) * 100) : 0));

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    if (!this.gestion.recargaSilenciosa()) this.cargando.set(true);
    forkJoin({ actual: this.gestion.turnoActual(), historial: this.gestion.turnos() }).subscribe({
      next: ({ actual, historial }) => {
        this.actual.set(actual);
        this.historial.set(historial.filter((t) => t.estado === 'CERRADO'));
        this.error.set(null);
        this.cargando.set(false);
        if (actual) this.cargarActual(actual);
        else {
          this.resumenActual.set(null);
          this.checklist.set([]);
        }
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar los turnos.'));
      },
    });
  }

  private cargarActual(t: Turno): void {
    forkJoin({ resumen: this.gestion.resumenTurno(t.id), tareas: this.tareasApi.getAll(t.tiendaId) }).subscribe({
      next: ({ resumen, tareas }) => {
        this.resumenActual.set(resumen);
        this.checklist.set(tareas.filter((x) => x.turnoId === t.id).sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
      },
    });
  }

  abrir(): void {
    const responsable = this.responsable.trim();
    if (!responsable) return;
    this.enviando.set(true);
    this.gestion.abrirTurno({ tipo: this.tipo, responsable, nota: this.notaApertura.trim() || undefined }).subscribe({
      next: (t) => {
        this.enviando.set(false);
        this.cierre.set(null);
        this.notaApertura = '';
        this.avisos.exito(`Turno de ${this.nombreTurno[t.tipo].toLowerCase()} abierto. Su checklist ya está en el tablero.`);
        this.cargar();
      },
      error: (err) => {
        this.enviando.set(false);
        this.avisos.error(mensajeDeError(err, 'No se pudo abrir el turno.'));
      },
    });
  }

  /** Marca un paso del checklist como hecho (o lo reabre) con la misma API del tablero. */
  alternar(paso: Task): void {
    const destino = paso.status === 'DONE' ? 'TODO' : 'DONE';
    this.marcando.set(paso.id!);
    this.tareasApi.reorder([{ id: paso.id!, status: destino, position: paso.position }]).subscribe({
      next: (r) => {
        this.marcando.set(null);
        const actualizada = r[0] ?? { ...paso, status: destino };
        this.checklist.update((l) => l.map((x) => (x.id === paso.id ? actualizada : x)));
      },
      error: (err) => {
        this.marcando.set(null);
        this.avisos.error(mensajeDeError(err, 'No se pudo actualizar el paso.'));
      },
    });
  }

  async cerrar(t: Turno): Promise<void> {
    const pendientes = this.checklist().length - this.hechas();
    const r = await this.confirmacion.pedir({
      titulo: `Cerrar el turno de ${this.nombreTurno[t.tipo].toLowerCase()}`,
      detalle:
        (pendientes > 0
          ? `Quedan ${pendientes} pasos del checklist sin completar; seguirán en el tablero. `
          : 'El checklist está completo. ') + 'Después de cerrar ya no se podrá reabrir este turno.',
      confirmar: 'Cerrar turno',
      peligro: pendientes > 0,
    });
    if (!r.ok) return;
    this.enviando.set(true);
    this.gestion.cerrarTurno(t.id, this.notaCierre.trim() || undefined).subscribe({
      next: (resumen) => {
        this.enviando.set(false);
        this.cierre.set(resumen);
        this.notaCierre = '';
        this.avisos.exito('Turno cerrado. Abajo está su resumen.');
        this.cargar();
      },
      error: (err) => {
        this.enviando.set(false);
        this.avisos.error(mensajeDeError(err, 'No se pudo cerrar el turno.'));
      },
    });
  }

  verDetalle(t: Turno): void {
    if (this.detalle()?.turno.id === t.id) {
      this.detalle.set(null);
      return;
    }
    this.gestion.resumenTurno(t.id).subscribe({
      next: (r) => this.detalle.set(r),
      error: (err) => this.avisos.error(mensajeDeError(err, 'No se pudo cargar el resumen.')),
    });
  }

  duracion(t: Turno): string {
    const fin = t.fin ? new Date(t.fin) : new Date();
    const minutos = Math.max(0, Math.round((fin.getTime() - new Date(t.inicio).getTime()) / 60000));
    return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
  }
}
