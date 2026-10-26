import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import {
  Empleado,
  EstadoPersona,
  NOMBRE_AUSENCIA,
  NOMBRE_ESTADO_PERSONA,
  NOMBRE_PUESTO,
  Puesto,
  TipoAusencia,
  avanceDe,
  DIAS_SEMANA,
} from '../../models/gestion.model';
import { TaskService } from '../../services/task.service';
import { TelefonoService } from '../../shared/telefono/telefono-empleado.component';
import { IconoComponent } from '../../shared/icono/icono.component';
import { AvisosService } from '../../shared/ui/avisos.service';
import { ConfirmacionService } from '../../shared/ui/confirmacion.service';
import { EstadoVistaComponent } from '../../shared/ui/estado-vista.component';
import { GestionService, mensajeDeError } from '../gestion.service';

type Filtro = 'todos' | EstadoPersona;

/** Plantilla de la sede: quién trabaja ahora, quién está libre, quién falta y por qué. */
@Component({
  selector: 'app-personal',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, IconoComponent, EstadoVistaComponent],
  templateUrl: './personal.component.html',
  styleUrl: './personal.component.scss',
})
export class PersonalComponent {
  readonly gestion = inject(GestionService);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacion = inject(ConfirmacionService);
  readonly telefono = inject(TelefonoService);
  readonly nombrePuesto = NOMBRE_PUESTO;
  readonly nombreEstado = NOMBRE_ESTADO_PERSONA;
  readonly nombreAusencia = NOMBRE_AUSENCIA;
  readonly dias = DIAS_SEMANA;
  readonly tiposAusencia = Object.keys(NOMBRE_AUSENCIA) as TipoAusencia[];
  readonly puestos = Object.keys(NOMBRE_PUESTO) as Puesto[];

  readonly lista = signal<Empleado[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly filtro = signal<Filtro>('todos');
  readonly puesto = signal<Puesto | ''>('');
  readonly ahora = signal(Date.now());
  readonly trabajando = signal<number | null>(null);

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);
  readonly conteo = computed(() => {
    const l = this.lista();
    const de = (e: EstadoPersona) => l.filter((x) => x.estado === e).length;
    return {
      TRABAJANDO: de('TRABAJANDO'),
      DISPONIBLE: de('DISPONIBLE'),
      FUERA_DE_TURNO: de('FUERA_DE_TURNO') + de('LIBRE_HOY'),
      AUSENTE: de('AUSENTE'),
      todos: l.length,
    };
  });
  readonly visibles = computed(() =>
    this.lista()
      .filter((e) => this.filtro() === 'todos' || e.estado === this.filtro() || (this.filtro() === 'FUERA_DE_TURNO' && e.estado === 'LIBRE_HOY'))
      .filter((e) => !this.puesto() || e.puesto === this.puesto()),
  );

  /** Ausencia que se está registrando (diálogo). */
  readonly ausencia = signal<Empleado | null>(null);
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  tipo: TipoAusencia = 'DESCANSO_MEDICO';
  motivo = '';
  hasta = '';

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      this.gestion.cambios();
      untracked(() => this.cargar());
    });
    effect(() => {
      const abierta = this.ausencia();
      const d = this.dialogo()?.nativeElement;
      if (!d) return;
      if (abierta && !d.open) d.showModal();
      if (!abierta && d.open) d.close();
    });
    // Cada asignación o tarea terminada cambia quién está libre.
    const destroyRef = inject(DestroyRef);
    inject(TaskService)
      .streamUpdates()
      .pipe(debounceTime(400), takeUntilDestroyed(destroyRef))
      .subscribe(() => this.cargar(false));
    const reloj = setInterval(() => this.ahora.set(Date.now()), 1000);
    destroyRef.onDestroy(() => clearInterval(reloj));
  }

  cargar(mostrarCarga = true): void {
    if (mostrarCarga) this.cargando.set(true);
    this.gestion.personal().subscribe({
      next: (l) => {
        this.lista.set(l);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudo cargar el personal.'));
      },
    });
  }

  avance(e: Empleado): number {
    return avanceDe(e.tareaAsignadaEn, e.tareaMinutos, this.ahora());
  }

  abrirAusencia(e: Empleado): void {
    this.tipo = 'DESCANSO_MEDICO';
    this.motivo = '';
    this.hasta = '';
    this.ausencia.set(e);
  }

  guardarAusencia(): void {
    const e = this.ausencia();
    if (!e || !this.motivo.trim()) return;
    this.trabajando.set(e.id);
    this.gestion.registrarAusencia(e.id, { disponibilidad: this.tipo, motivo: this.motivo.trim(), hasta: this.hasta || null }).subscribe({
      next: () => {
        this.trabajando.set(null);
        this.ausencia.set(null);
        this.avisos.exito(
          `${e.nombre}: ${NOMBRE_AUSENCIA[this.tipo].toLowerCase()} registrado.${e.tareaId ? ` La orden #${e.tareaId} quedó libre para reasignarla.` : ''}`,
        );
        this.cargar(false);
      },
      error: (err) => {
        this.trabajando.set(null);
        this.avisos.error(mensajeDeError(err, 'No se pudo registrar la ausencia.'));
      },
    });
  }

  async reincorporar(e: Empleado): Promise<void> {
    const r = await this.confirmacion.pedir({
      titulo: `Reincorporar a ${e.nombre}`,
      detalle: `Vuelve a estar activo y, si está en su horario (${e.horario}), se le pueden asignar órdenes.`,
      confirmar: 'Reincorporar',
    });
    if (!r.ok) return;
    this.trabajando.set(e.id);
    this.gestion.reincorporar(e.id).subscribe({
      next: () => {
        this.trabajando.set(null);
        this.avisos.exito(`${e.nombre} está activo de nuevo.`);
        this.cargar(false);
      },
      error: (err) => {
        this.trabajando.set(null);
        this.avisos.error(mensajeDeError(err, 'No se pudo reincorporar.'));
      },
    });
  }

  iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  hoy(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
