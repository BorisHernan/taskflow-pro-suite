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
import { GestionService, mensajeDeError } from '../gestion.service';

/** Incidencias de tienda. Las de severidad alta o crítica abren una tarea en el tablero. */
@Component({
  selector: 'app-incidencias',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './incidencias.component.html',
  styleUrl: './incidencias.component.scss',
})
export class IncidenciasComponent {
  readonly gestion = inject(GestionService);
  readonly nombreCategoria = NOMBRE_CATEGORIA;
  readonly nombreSeveridad = NOMBRE_SEVERIDAD;
  readonly nombreEstado = NOMBRE_ESTADO_INCIDENCIA;
  readonly categorias = Object.keys(NOMBRE_CATEGORIA) as CategoriaIncidencia[];
  readonly severidades = Object.keys(NOMBRE_SEVERIDAD) as Severidad[];

  readonly incidencias = signal<Incidencia[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly verResueltas = signal(false);
  readonly resolviendo = signal<number | null>(null);
  solucion = '';

  titulo = '';
  descripcion = '';
  categoria: CategoriaIncidencia = 'EQUIPOS';
  severidad: Severidad = 'MEDIA';

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);
  readonly abiertas = computed(() => this.incidencias().filter((i) => i.estado !== 'RESUELTA'));
  readonly resueltas = computed(() => this.incidencias().filter((i) => i.estado === 'RESUELTA'));

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.gestion.incidencias().subscribe({
      next: (lista) => {
        this.incidencias.set(lista);
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
    this.gestion
      .reportarIncidencia({ titulo, descripcion: this.descripcion.trim() || undefined, categoria: this.categoria, severidad: this.severidad })
      .subscribe({
        next: (i) => {
          this.mostrarAviso(i.tareaId ? 'Incidencia reportada. Por su gravedad ya tiene una tarea en el tablero.' : 'Incidencia reportada.');
          this.titulo = '';
          this.descripcion = '';
          this.severidad = 'MEDIA';
          this.cargar();
        },
        error: (err) => this.error.set(mensajeDeError(err, 'No se pudo reportar la incidencia.')),
      });
  }

  cambiar(i: Incidencia, estado: EstadoIncidencia): void {
    const solucion = estado === 'RESUELTA' ? this.solucion.trim() || undefined : undefined;
    this.gestion.cambiarIncidencia(i.id, estado, solucion).subscribe({
      next: () => {
        this.resolviendo.set(null);
        this.solucion = '';
        this.mostrarAviso(estado === 'RESUELTA' ? `“${i.titulo}” quedó resuelta.` : `“${i.titulo}” está en curso.`);
        this.cargar();
      },
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo actualizar la incidencia.')),
    });
  }

  claseSeveridad(s: Severidad): string {
    return s === 'CRITICA' || s === 'ALTA' ? 'rojo' : s === 'MEDIA' ? 'ambar' : '';
  }

  private mostrarAviso(texto: string): void {
    this.error.set(null);
    this.aviso.set(texto);
    setTimeout(() => this.aviso.set(null), 6000);
  }
}
