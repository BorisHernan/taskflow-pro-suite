import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CategoriaIncidencia,
  EstadoIncidencia,
  Incidencia,
  NOMBRE_CATEGORIA,
  NOMBRE_ESTADO_INCIDENCIA,
  NOMBRE_SEVERIDAD,
  Severidad,
} from '../../models/gestion.model';
import { IconoComponent } from '../../shared/icono/icono.component';
import { AvisosService } from '../../shared/ui/avisos.service';
import { ConfirmacionService } from '../../shared/ui/confirmacion.service';
import { EstadoVistaComponent } from '../../shared/ui/estado-vista.component';
import { GestionService, mensajeDeError } from '../gestion.service';

type FiltroEstado = 'abiertas' | 'resueltas' | 'todas';

/** Incidencias de tienda. Las de severidad alta o crítica abren una tarea en el tablero. */
@Component({
  selector: 'app-incidencias',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, IconoComponent, EstadoVistaComponent],
  templateUrl: './incidencias.component.html',
  styleUrl: './incidencias.component.scss',
})
export class IncidenciasComponent {
  readonly gestion = inject(GestionService);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacion = inject(ConfirmacionService);
  readonly nombreCategoria = NOMBRE_CATEGORIA;
  readonly nombreSeveridad = NOMBRE_SEVERIDAD;
  readonly nombreEstado = NOMBRE_ESTADO_INCIDENCIA;
  readonly categorias = Object.keys(NOMBRE_CATEGORIA) as CategoriaIncidencia[];
  readonly severidades = Object.keys(NOMBRE_SEVERIDAD) as Severidad[];

  readonly incidencias = signal<Incidencia[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly trabajando = signal<number | null>(null);

  readonly filtroEstado = signal<FiltroEstado>('abiertas');
  readonly filtroSeveridad = signal<Severidad | ''>('');
  readonly filtroCategoria = signal<CategoriaIncidencia | ''>('');

  titulo = '';
  descripcion = '';
  categoria: CategoriaIncidencia = 'EQUIPOS';
  severidad: Severidad = 'MEDIA';

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);
  readonly conteo = computed(() => ({
    abiertas: this.incidencias().filter((i) => i.estado !== 'RESUELTA').length,
    resueltas: this.incidencias().filter((i) => i.estado === 'RESUELTA').length,
    todas: this.incidencias().length,
  }));
  readonly visibles = computed(() =>
    this.incidencias()
      .filter((i) =>
        this.filtroEstado() === 'todas' ? true : this.filtroEstado() === 'resueltas' ? i.estado === 'RESUELTA' : i.estado !== 'RESUELTA',
      )
      .filter((i) => !this.filtroSeveridad() || i.severidad === this.filtroSeveridad())
      .filter((i) => !this.filtroCategoria() || i.categoria === this.filtroCategoria()),
  );

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      this.gestion.cambios();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    if (!this.gestion.recargaSilenciosa()) this.cargando.set(true);
    this.gestion.incidencias().subscribe({
      next: (lista) => {
        this.incidencias.set(lista);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar las incidencias.'));
      },
    });
  }

  reportar(): void {
    const titulo = this.titulo.trim();
    if (!titulo) return;
    this.enviando.set(true);
    this.gestion
      .reportarIncidencia({ titulo, descripcion: this.descripcion.trim() || undefined, categoria: this.categoria, severidad: this.severidad })
      .subscribe({
        next: (i) => {
          this.enviando.set(false);
          this.avisos.exito(
            i.tareaId ? `Incidencia #${i.id} reportada. Por su severidad, ya tiene la tarea #${i.tareaId}.` : `Incidencia #${i.id} reportada.`,
          );
          this.titulo = '';
          this.descripcion = '';
          this.severidad = 'MEDIA';
          this.cargar();
        },
        error: (err) => {
          this.enviando.set(false);
          this.avisos.error(mensajeDeError(err, 'No se pudo reportar la incidencia.'));
        },
      });
  }

  async cambiar(i: Incidencia, estado: EstadoIncidencia): Promise<void> {
    let solucion: string | undefined;
    if (estado === 'RESUELTA') {
      const r = await this.confirmacion.pedir({
        titulo: `Resolver la incidencia #${i.id}`,
        detalle: `“${i.titulo}”.${i.tareaId ? ` Su tarea #${i.tareaId} pasará a Hecho.` : ''} La solución queda en el historial.`,
        confirmar: 'Marcar como resuelta',
        campo: { etiqueta: '¿Cómo se resolvió?', placeholder: 'Por ejemplo: se cambió el rodillo de la impresora', obligatorio: true },
      });
      if (!r.ok) return;
      solucion = r.texto;
    }
    this.trabajando.set(i.id);
    this.gestion.cambiarIncidencia(i.id, estado, solucion).subscribe({
      next: () => {
        this.trabajando.set(null);
        this.avisos.exito(estado === 'RESUELTA' ? `Incidencia #${i.id} resuelta.` : `Incidencia #${i.id} en atención.`);
        this.cargar();
      },
      error: (err) => {
        this.trabajando.set(null);
        this.avisos.error(mensajeDeError(err, 'No se pudo actualizar la incidencia.'));
      },
    });
  }

  grave(i: Incidencia): boolean {
    return i.severidad === 'ALTA' || i.severidad === 'CRITICA';
  }
}
