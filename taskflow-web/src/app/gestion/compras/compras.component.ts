import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SesionService } from '../../auth/sesion.service';
import { EstadoPedido, FilaInventario, NOMBRE_ESTADO_PEDIDO, Pedido } from '../../models/gestion.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { GestionService, mensajeDeError } from '../gestion.service';

/** Pedidos de reposición al almacén central: la tienda pide, el admin aprueba, la tienda recibe. */
@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [FormsModule, DatePipe, SolesPipe],
  templateUrl: './compras.component.html',
  styleUrl: './compras.component.scss',
})
export class ComprasComponent {
  readonly gestion = inject(GestionService);
  readonly sesion = inject(SesionService);
  private readonly ruta = inject(ActivatedRoute);
  readonly nombreEstado = NOMBRE_ESTADO_PEDIDO;

  readonly pedidos = signal<Pedido[]>([]);
  readonly productos = signal<FilaInventario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly trabajando = signal<number | null>(null);
  readonly rechazando = signal<number | null>(null);
  motivoRechazo = '';

  // Formulario de nuevo pedido.
  productoId: number | null = null;
  cantidad = 1;
  nota = '';

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);
  readonly porAprobar = computed(() => this.pedidos().filter((p) => p.estado === 'SOLICITADO'));
  readonly enCamino = computed(() => this.pedidos().filter((p) => p.estado === 'APROBADO'));
  readonly historial = computed(() => this.pedidos().filter((p) => p.estado === 'RECIBIDO' || p.estado === 'RECHAZADO'));
  readonly gastoEnCurso = computed(() =>
    [...this.porAprobar(), ...this.enCamino()].reduce((a, p) => a + Number(p.costo), 0),
  );
  /** Para pedir hace falta una tienda concreta; el admin en "todas" no puede. */
  readonly puedePedir = computed(() => this.gestion.tiendaActiva() != null);

  constructor() {
    const producto = Number(this.ruta.snapshot.queryParamMap.get('producto'));
    if (producto) this.productoId = producto;
    effect(() => {
      this.gestion.tiendaActiva();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    this.cargando.set(true);
    forkJoin({ pedidos: this.gestion.pedidos(), inventario: this.gestion.inventario() }).subscribe({
      next: ({ pedidos, inventario }) => {
        this.pedidos.set(pedidos);
        this.productos.set(inventario.filter((f) => !f.pedidoEnCurso));
        const elegido = inventario.find((f) => f.productoId === this.productoId);
        if (elegido && this.cantidad === 1) this.cantidad = Math.max(1, elegido.stockObjetivo - elegido.stock);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar los pedidos.'));
      },
    });
  }

  alElegirProducto(id: number): void {
    this.productoId = id;
    const f = this.productos().find((p) => p.productoId === id);
    if (f) this.cantidad = Math.max(1, f.stockObjetivo - f.stock);
  }

  pedir(): void {
    if (!this.productoId) return;
    this.gestion.pedir({ productoId: this.productoId, cantidad: this.cantidad, nota: this.nota.trim() || undefined }).subscribe({
      next: (p) => {
        this.productoId = null;
        this.cantidad = 1;
        this.nota = '';
        this.mostrarAviso(`Pedido #${p.id} enviado. La tarea de reposición pasó a "En progreso".`);
        this.cargar();
      },
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo enviar el pedido.')),
    });
  }

  accion(p: Pedido, accion: 'aprobar' | 'rechazar' | 'recibir'): void {
    this.trabajando.set(p.id);
    const nota = accion === 'rechazar' ? this.motivoRechazo.trim() || undefined : undefined;
    this.gestion.revisarPedido(p.id, accion, nota).subscribe({
      next: () => {
        this.trabajando.set(null);
        this.rechazando.set(null);
        this.motivoRechazo = '';
        const textos = {
          aprobar: `Pedido #${p.id} aprobado: ya va en camino a ${this.gestion.nombreTienda(p.tiendaId)}.`,
          rechazar: `Pedido #${p.id} rechazado. La tarea de reposición volvió a "Por hacer".`,
          recibir: `Llegaron ${p.cantidad} × ${p.productoNombre}. El stock se actualizó y, si pasó el mínimo, la alerta se cerró sola.`,
        };
        this.mostrarAviso(textos[accion]);
        this.cargar();
      },
      error: (err) => {
        this.trabajando.set(null);
        this.error.set(mensajeDeError(err, 'No se pudo actualizar el pedido.'));
      },
    });
  }

  claseEstado(e: EstadoPedido): string {
    return { SOLICITADO: 'ambar', APROBADO: 'azul', RECIBIDO: 'verde', RECHAZADO: 'rojo' }[e];
  }

  private mostrarAviso(texto: string): void {
    this.error.set(null);
    this.aviso.set(texto);
    setTimeout(() => this.aviso.set(null), 7000);
  }
}
