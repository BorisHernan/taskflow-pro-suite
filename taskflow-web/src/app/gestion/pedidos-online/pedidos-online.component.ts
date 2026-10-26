import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, filter } from 'rxjs';
import { EstadoOrden, NOMBRE_ESTADO_ORDEN, OrdenVista, siguienteEstado } from '../../models/orden.model';
import { OrdenService } from '../../services/orden.service';
import { vehiculoPara } from '../../shared/entrega/entrega';
import { TaskService } from '../../services/task.service';
import { IconoComponent } from '../../shared/icono/icono.component';
import { SolesPipe } from '../../shared/soles.pipe';
import { AvisosService } from '../../shared/ui/avisos.service';
import { EstadoVistaComponent } from '../../shared/ui/estado-vista.component';
import { GestionService, mensajeDeError } from '../gestion.service';

type Filtro = 'pendientes' | 'entregados';

/** Pedidos de la tienda online: la sede los prepara y despacha paso a paso. */
@Component({
  selector: 'app-pedidos-online',
  standalone: true,
  imports: [DatePipe, RouterLink, IconoComponent, SolesPipe, EstadoVistaComponent],
  templateUrl: './pedidos-online.component.html',
  styleUrl: './pedidos-online.component.scss',
})
export class PedidosOnlineComponent {
  readonly gestion = inject(GestionService);
  private readonly ordenes = inject(OrdenService);
  private readonly avisos = inject(AvisosService);
  readonly nombreEstado = NOMBRE_ESTADO_ORDEN;
  readonly siguiente = siguienteEstado;

  readonly lista = signal<OrdenVista[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly trabajando = signal<number | null>(null);
  readonly filtro = signal<Filtro>('pendientes');

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);
  readonly pendientes = computed(() => this.lista().filter((v) => v.orden.estado !== 'ENTREGADA'));
  readonly entregados = computed(() => this.lista().filter((v) => v.orden.estado === 'ENTREGADA'));
  readonly visibles = computed(() => (this.filtro() === 'pendientes' ? this.pendientes() : this.entregados()));
  readonly kpis = computed(() => {
    const p = this.pendientes();
    return {
      nuevos: p.filter((v) => v.orden.estado === 'RECIBIDA').length,
      preparando: p.filter((v) => v.orden.estado === 'PREPARANDO').length,
      salida: p.filter((v) => v.orden.estado === 'LISTA' || v.orden.estado === 'EN_CAMINO').length,
      entregados: this.entregados().length,
    };
  });

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      this.gestion.cambios();
      untracked(() => this.cargar());
    });
    // Un pedido nuevo llega como tarea por el canal en vivo: se recarga la lista.
    inject(TaskService)
      .streamUpdates()
      .pipe(
        filter((e) => e.task?.tipo === 'PEDIDO'),
        debounceTime(300),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.cargar(false));
  }

  cargar(mostrarCarga = true): void {
    if (mostrarCarga) this.cargando.set(true);
    this.ordenes.listar(this.gestion.tiendaActiva()).subscribe({
      next: (l) => {
        this.lista.set(l);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar los pedidos.'));
      },
    });
  }

  avanzar(v: OrdenVista, estado: EstadoOrden): void {
    this.trabajando.set(v.orden.id);
    this.ordenes.avanzar(v.orden.id, estado).subscribe({
      next: (nueva) => {
        this.trabajando.set(null);
        this.lista.update((l) => l.map((x) => (x.orden.id === nueva.orden.id ? nueva : x)));
        this.avisos.exito(`Pedido ${nueva.orden.codigo}: ${NOMBRE_ESTADO_ORDEN[nueva.orden.estado].toLowerCase()}. El cliente ya lo ve.`);
      },
      error: (err) => {
        this.trabajando.set(null);
        this.avisos.error(mensajeDeError(err, 'No se pudo actualizar el pedido.'));
        this.cargar(false);
      },
    });
  }

  vehiculo(v: OrdenVista): string {
    return vehiculoPara(this.unidades(v)).nombre.toLowerCase();
  }

  unidades(v: OrdenVista): number {
    return v.lineas.reduce((n, l) => n + l.cantidad, 0);
  }
}
