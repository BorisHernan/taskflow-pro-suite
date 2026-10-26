import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SesionService } from '../../auth/sesion.service';
import { Empleado, EstadoPedido, FilaInventario, NOMBRE_ESTADO_PEDIDO, NOMBRE_PUESTO, Pedido } from '../../models/gestion.model';
import { IconoComponent } from '../../shared/icono/icono.component';
import { SolesPipe } from '../../shared/soles.pipe';
import { AvisosService } from '../../shared/ui/avisos.service';
import { ConfirmacionService } from '../../shared/ui/confirmacion.service';
import { EstadoVistaComponent } from '../../shared/ui/estado-vista.component';
import { GestionService, mensajeDeError } from '../gestion.service';

const SOLES = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

interface Paso {
  nombre: string;
  estado: 'hecho' | 'actual' | 'pendiente' | 'rechazado';
}

/** Pedidos de reposición al almacén central: la tienda pide, la administración aprueba, la tienda recibe. */
@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [FormsModule, DatePipe, NgTemplateOutlet, SolesPipe, IconoComponent, EstadoVistaComponent],
  templateUrl: './compras.component.html',
  styleUrl: './compras.component.scss',
})
export class ComprasComponent {
  readonly gestion = inject(GestionService);
  readonly sesion = inject(SesionService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacion = inject(ConfirmacionService);
  readonly nombreEstado = NOMBRE_ESTADO_PEDIDO;

  readonly pedidos = signal<Pedido[]>([]);
  readonly productos = signal<FilaInventario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly trabajando = signal<number | null>(null);
  readonly enviando = signal(false);

  productoId: number | null = null;
  cantidad = 1;
  nota = '';
  /** Quién de la sede hace la solicitud (null = el usuario conectado). */
  empleadoId: number | null = null;
  readonly presentes = signal<Empleado[]>([]);
  readonly nombrePuesto = NOMBRE_PUESTO;

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);
  readonly porAprobar = computed(() => this.pedidos().filter((p) => p.estado === 'SOLICITADO'));
  readonly enCamino = computed(() => this.pedidos().filter((p) => p.estado === 'APROBADO'));
  readonly historial = computed(() => this.pedidos().filter((p) => p.estado === 'RECIBIDO' || p.estado === 'RECHAZADO'));
  readonly gastoEnCurso = computed(() => [...this.porAprobar(), ...this.enCamino()].reduce((a, p) => a + Number(p.costo), 0));
  /** Para pedir hace falta una sede concreta; la administración en "todas" no puede. */
  readonly puedePedir = computed(() => this.gestion.tiendaActiva() != null);

  constructor() {
    const producto = Number(this.ruta.snapshot.queryParamMap.get('producto'));
    if (producto) this.productoId = producto;
    effect(() => {
      this.gestion.tiendaActiva();
      this.gestion.cambios();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    if (!this.gestion.recargaSilenciosa()) this.cargando.set(true);
    forkJoin({ pedidos: this.gestion.pedidos(), inventario: this.gestion.inventario(), personal: this.gestion.personal() }).subscribe({
      next: ({ pedidos, inventario, personal }) => {
        // Lo pide alguien que esté en la tienda ahora (en turno y sin ausencia).
        this.presentes.set(personal.filter((e) => e.estado === 'DISPONIBLE' || e.estado === 'TRABAJANDO'));
        this.pedidos.set(pedidos);
        this.productos.set(inventario.filter((f) => !f.pedidoEnCurso));
        const elegido = inventario.find((f) => f.productoId === this.productoId);
        if (elegido && this.cantidad === 1) this.cantidad = Math.max(1, elegido.stockObjetivo - elegido.stock);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar los pedidos.'));
      },
    });
  }

  /** Ciclo del pedido según su estado real. */
  pasos(p: Pedido): Paso[] {
    const rechazado = p.estado === 'RECHAZADO';
    const aprobado = p.estado === 'APROBADO' || p.estado === 'RECIBIDO';
    return [
      { nombre: 'Solicitado', estado: 'hecho' },
      { nombre: rechazado ? 'Rechazado' : 'Aprobado', estado: rechazado ? 'rechazado' : aprobado ? 'hecho' : 'actual' },
      { nombre: 'Recibido', estado: p.estado === 'RECIBIDO' ? 'hecho' : p.estado === 'APROBADO' ? 'actual' : 'pendiente' },
    ];
  }

  alElegirProducto(id: number): void {
    this.productoId = id;
    const f = this.productos().find((p) => p.productoId === id);
    if (f) this.cantidad = Math.max(1, f.stockObjetivo - f.stock);
  }

  pedir(): void {
    if (!this.productoId) return;
    this.enviando.set(true);
    this.gestion.pedir({ productoId: this.productoId, cantidad: this.cantidad, nota: this.nota.trim() || undefined, empleadoId: this.empleadoId }).subscribe({
      next: (p) => {
        this.enviando.set(false);
        this.productoId = null;
        this.cantidad = 1;
        this.nota = '';
        this.avisos.exito(`Pedido #${p.id} enviado. Su tarea de reposición pasó a "En progreso".`);
        this.cargar();
      },
      error: (err) => {
        this.enviando.set(false);
        this.avisos.error(mensajeDeError(err, 'No se pudo enviar el pedido.'));
      },
    });
  }

  async accion(p: Pedido, accion: 'aprobar' | 'rechazar' | 'recibir'): Promise<void> {
    const sede = this.gestion.nombreTienda(p.tiendaId);
    const preguntas = {
      aprobar: {
        titulo: `Aprobar el pedido #${p.id}`,
        detalle: `${p.cantidad} × ${p.productoNombre} para ${sede}, con un costo de ${SOLES.format(p.costo)}. La tienda podrá marcarlo como recibido cuando llegue.`,
        confirmar: 'Aprobar pedido',
      },
      rechazar: {
        titulo: `Rechazar el pedido #${p.id}`,
        detalle: `${p.cantidad} × ${p.productoNombre} para ${sede}. Su tarea de reposición volverá a "Por hacer".`,
        confirmar: 'Rechazar pedido',
        peligro: true,
        campo: { etiqueta: 'Motivo para la tienda', placeholder: 'Por ejemplo: sin stock en el almacén central' },
      },
      recibir: {
        titulo: `Confirmar la recepción del pedido #${p.id}`,
        detalle: `Se sumarán ${p.cantidad} unidades de ${p.productoNombre} al stock de ${sede}. Si supera el mínimo, la alerta de reposición se cerrará sola.`,
        confirmar: 'Confirmar recepción',
      },
    };
    const respuesta = await this.confirmacion.pedir(preguntas[accion]);
    if (!respuesta.ok) return;

    this.trabajando.set(p.id);
    this.gestion.revisarPedido(p.id, accion, respuesta.texto || undefined).subscribe({
      next: () => {
        this.trabajando.set(null);
        const textos = {
          aprobar: `Pedido #${p.id} aprobado. Ya va en camino a ${sede}.`,
          rechazar: `Pedido #${p.id} rechazado. Su tarea volvió a "Por hacer".`,
          recibir: `Pedido #${p.id} recibido: el stock de ${p.productoNombre} se actualizó.`,
        };
        this.avisos.exito(textos[accion]);
        this.cargar();
      },
      error: (err) => {
        this.trabajando.set(null);
        this.avisos.error(mensajeDeError(err, 'No se pudo actualizar el pedido.'));
        this.cargar();
      },
    });
  }

  claseEstado(e: EstadoPedido): string {
    return { SOLICITADO: 'ambar', APROBADO: 'azul', RECIBIDO: 'verde', RECHAZADO: 'rojo' }[e];
  }
}
