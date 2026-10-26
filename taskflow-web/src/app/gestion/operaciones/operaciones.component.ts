import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragPreview, CdkDropList } from '@angular/cdk/drag-drop';
import { debounceTime, forkJoin } from 'rxjs';
import {
  AvisoPersonal,
  DIAS_SEMANA,
  Empleado,
  NOMBRE_AUSENCIA,
  NOMBRE_PUESTO,
  NOMBRE_PUESTO_TIENDA,
  PuestoTienda,
  Venta,
  avanceDe,
} from '../../models/gestion.model';
import { NOMBRE_TIPO, Task } from '../../models/task.model';
import { OrdenService } from '../../services/orden.service';
import { TaskService } from '../../services/task.service';
import { IconoComponent } from '../../shared/icono/icono.component';
import { AvisosService } from '../../shared/ui/avisos.service';
import { GestionService, mensajeDeError } from '../gestion.service';

type Estacion = { clave: PuestoTienda; nombre: string; ayuda: string; grupo: 'entrada' | 'cajas' | 'interior' };
type Alerta = { texto: string; destino?: PuestoTienda; sugerido?: Empleado; accion?: string };

const ESTACIONES: Estacion[] = [
  { clave: 'ENTRADA', nombre: 'Entrada y seguridad', ayuda: 'Control de la puerta y las bolsas', grupo: 'entrada' },
  { clave: 'CAJA_1', nombre: 'Caja 1', ayuda: '', grupo: 'cajas' },
  { clave: 'CAJA_2', nombre: 'Caja 2', ayuda: '', grupo: 'cajas' },
  { clave: 'CAJA_3', nombre: 'Caja 3', ayuda: '', grupo: 'cajas' },
  { clave: 'CAJA_4', nombre: 'Caja 4', ayuda: '', grupo: 'cajas' },
  { clave: 'CAJA_5', nombre: 'Caja 5', ayuda: '', grupo: 'cajas' },
  { clave: 'PASILLOS', nombre: 'Pasillos', ayuda: 'Reposición de góndolas', grupo: 'interior' },
  { clave: 'ALMACEN', nombre: 'Almacén', ayuda: 'Recepción y trastienda', grupo: 'interior' },
  { clave: 'DESPACHO', nombre: 'Despacho online', ayuda: 'Prepara y entrega pedidos', grupo: 'interior' },
];

/**
 * Centro de operaciones de la sede: el plano de la tienda con sus puestos, el equipo que vino hoy,
 * las órdenes pendientes y los avisos al personal. Se arrastra a cada persona a un puesto o a una orden.
 */
@Component({
  selector: 'app-operaciones',
  standalone: true,
  imports: [DatePipe, RouterLink, CdkDrag, CdkDragPreview, CdkDropList, IconoComponent],
  templateUrl: './operaciones.component.html',
  styleUrl: './operaciones.component.scss',
})
export class OperacionesComponent {
  readonly gestion = inject(GestionService);
  private readonly ordenes = inject(OrdenService);
  private readonly tareasApi = inject(TaskService);
  private readonly avisos = inject(AvisosService);
  readonly estaciones = ESTACIONES;
  readonly nombrePuesto = NOMBRE_PUESTO;
  readonly nombreTipo = NOMBRE_TIPO;
  readonly nombreAusencia = NOMBRE_AUSENCIA;
  readonly dias = DIAS_SEMANA;

  readonly personal = signal<Empleado[]>([]);
  readonly tareas = signal<Task[]>([]);
  readonly feed = signal<AvisoPersonal[]>([]);
  readonly ventas = signal<Venta[]>([]);
  readonly pedidosOnline = signal(0);
  readonly almacenes = signal<Map<number, number>>(new Map());
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly ahora = signal(Date.now());
  /** Persona elegida con un toque (alternativa a arrastrar, útil en celular y con teclado). */
  readonly elegida = signal<Empleado | null>(null);
  readonly ocupado = signal(false);

  readonly sinSede = computed(() => this.gestion.tiendaActiva() == null);
  readonly presentes = computed(() => this.personal().filter((e) => e.estado === 'DISPONIBLE' || e.estado === 'TRABAJANDO'));
  readonly sinPuesto = computed(() => this.presentes().filter((e) => !e.puestoActual));
  readonly libresHoy = computed(() => this.personal().filter((e) => e.estado === 'LIBRE_HOY'));
  readonly ausentes = computed(() => this.personal().filter((e) => e.estado === 'AUSENTE'));
  readonly fueraDeTurno = computed(() => this.personal().filter((e) => e.estado === 'FUERA_DE_TURNO').length);

  readonly porHacer = computed(() => this.tareas().filter((t) => t.status === 'TODO'));
  readonly enCurso = computed(() => this.tareas().filter((t) => t.status === 'IN_PROGRESS'));
  readonly hechasHoy = computed(() => {
    const hoy = new Date().toDateString();
    return this.tareas().filter((t) => t.status === 'DONE' && t.cerradaEn && new Date(t.cerradaEn).toDateString() === hoy).length;
  });

  /** Ids de todas las zonas donde se puede soltar a alguien (puestos, la bandeja y cada orden). */
  readonly zonas = computed(() => ['bandeja', ...ESTACIONES.map((e) => 'puesto-' + e.clave), ...this.porHacer().map((t) => 'orden-' + t.id)]);

  /** Lo que la tienda necesita ahora, calculado con lo que está pasando. */
  readonly alertas = computed<Alerta[]>(() => {
    const presentes = this.presentes();
    if (!presentes.length) return [];
    // Se sugiere a alguien libre que no esté cubriendo una caja ni la entrada.
    const movible = (e: Empleado) => e.estado === 'DISPONIBLE' && !e.puestoActual?.startsWith('CAJA') && e.puestoActual !== 'ENTRADA';
    const libre = (preferir: (e: Empleado) => boolean) => presentes.find((e) => movible(e) && preferir(e)) ?? presentes.find(movible);
    const en = (p: PuestoTienda) => presentes.filter((e) => e.puestoActual === p).length;
    const lista: Alerta[] = [];

    const cajasAbiertas = ESTACIONES.filter((e) => e.grupo === 'cajas' && en(e.clave) > 0).length;
    const hace = this.ahora() - 60 * 60000;
    const comprasHora = this.ventas().filter((v) => new Date(v.fecha).getTime() >= hace).length;
    if (comprasHora >= 6 && cajasAbiertas < 4) {
      const cerrada = ESTACIONES.find((e) => e.grupo === 'cajas' && en(e.clave) === 0)!;
      lista.push({
        texto: `Mucha afluencia: ${comprasHora} compras en la última hora y solo ${cajasAbiertas} ${cajasAbiertas === 1 ? 'caja abierta' : 'cajas abiertas'}. Abre la ${cerrada.nombre.toLowerCase()}.`,
        destino: cerrada.clave,
        sugerido: libre((e) => e.puesto === 'CAJERO') ?? libre((e) => e.puesto === 'REPONEDOR'),
      });
    } else if (cajasAbiertas === 0) {
      lista.push({ texto: 'No hay ninguna caja abierta.', destino: 'CAJA_1', sugerido: libre((e) => e.puesto === 'CAJERO') });
    }
    if (en('ENTRADA') === 0) {
      lista.push({ texto: 'Nadie cuida la entrada y la salida.', destino: 'ENTRADA', sugerido: libre((e) => e.puesto === 'REPONEDOR' || e.puesto === 'ALMACENERO') });
    }
    if (this.pedidosOnline() > 0 && en('DESPACHO') === 0) {
      lista.push({
        texto: `${this.pedidosOnline()} ${this.pedidosOnline() === 1 ? 'pedido online espera' : 'pedidos online esperan'} y no hay nadie en despacho.`,
        destino: 'DESPACHO',
        sugerido: libre((e) => e.puesto === 'REPARTIDOR'),
      });
    }
    // Solo cuentan las que se pueden reponer ya (con unidades en el almacén).
    const reposiciones = this.porHacer().filter((t) => t.tipo === 'REPOSICION' && !this.sinAlmacen(t)).length;
    if (reposiciones >= 3 && en('PASILLOS') < 2) {
      lista.push({ texto: `${reposiciones} productos por reponer y poca gente en pasillos.`, destino: 'PASILLOS', sugerido: libre((e) => e.puesto === 'REPONEDOR') });
    }
    return lista.map((a) => ({ ...a, accion: a.sugerido ? `Enviar a ${a.sugerido.nombre.split(' ')[0]}` : undefined }));
  });

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      this.gestion.cambios();
      untracked(() => this.cargar());
    });
    const destroyRef = inject(DestroyRef);
    // Cualquier cambio de tareas (asignaciones, cierres automáticos, pedidos nuevos) refresca la vista.
    this.tareasApi
      .streamUpdates()
      .pipe(debounceTime(400), takeUntilDestroyed(destroyRef))
      .subscribe(() => this.cargar(false));
    const reloj = setInterval(() => this.ahora.set(Date.now()), 1000);
    const refresco = setInterval(() => this.cargar(false), 15000);
    destroyRef.onDestroy(() => {
      clearInterval(reloj);
      clearInterval(refresco);
    });
  }

  cargar(mostrarCarga = true): void {
    const tienda = this.gestion.tiendaActiva();
    if (tienda == null) {
      this.cargando.set(false);
      return;
    }
    if (mostrarCarga) this.cargando.set(true);
    forkJoin({
      personal: this.gestion.personal(),
      tareas: this.tareasApi.getAll(tienda),
      avisos: this.gestion.avisosPersonal(),
      ventas: this.gestion.ventas(),
      ordenes: this.ordenes.listar(tienda),
      inventario: this.gestion.inventario(),
    }).subscribe({
      next: (d) => {
        this.personal.set(d.personal);
        this.tareas.set(d.tareas.filter((t) => t.tiendaId === tienda));
        this.feed.set(d.avisos);
        this.ventas.set(d.ventas);
        this.pedidosOnline.set(d.ordenes.filter((o) => o.orden.estado !== 'ENTREGADA').length);
        this.almacenes.set(new Map(d.inventario.map((f) => [f.productoId, f.almacen])));
        this.error.set(null);
        this.cargando.set(false);
        // Si la persona elegida ya no está disponible, se suelta.
        const e = this.elegida();
        if (e && !d.personal.some((x) => x.id === e.id && (x.estado === 'DISPONIBLE' || x.estado === 'TRABAJANDO'))) this.elegida.set(null);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudo cargar el centro de operaciones.'));
      },
    });
  }

  enPuesto(p: PuestoTienda): Empleado[] {
    return this.presentes().filter((e) => e.puestoActual === p);
  }

  /** Soltar a alguien: en un puesto lo mueve; en la bandeja lo deja sin puesto; en una orden se la asigna. */
  soltar(ev: CdkDragDrop<any>): void {
    const e = ev.item.data as Empleado;
    const id = ev.container.id;
    if (ev.previousContainer === ev.container) return;
    if (id === 'bandeja') this.moverA(e, null);
    else if (id.startsWith('puesto-')) this.moverA(e, id.slice(7) as PuestoTienda);
    else if (id.startsWith('orden-')) this.asignarOrden(e, Number(id.slice(6)));
  }

  elegir(e: Empleado): void {
    this.elegida.set(this.elegida()?.id === e.id ? null : e);
  }

  tocarPuesto(p: PuestoTienda | null): void {
    const e = this.elegida();
    if (e) this.moverA(e, p);
  }

  tocarOrden(t: Task): void {
    const e = this.elegida();
    if (e) this.asignarOrden(e, t.id!);
  }

  moverA(e: Empleado, puesto: PuestoTienda | null): void {
    if (e.puestoActual === puesto) return;
    // Se ve al instante; si el servidor no lo acepta, se recarga.
    this.personal.update((l) => l.map((x) => (x.id === e.id ? { ...x, puestoActual: puesto } : x)));
    this.elegida.set(null);
    this.gestion.moverAPuesto(e.id, puesto).subscribe({
      next: () => {
        this.avisos.exito(puesto ? `Aviso enviado: ${e.nombre}, ve a ${NOMBRE_PUESTO_TIENDA[puesto].toLowerCase()}.` : `${e.nombre} quedó sin puesto fijo.`);
        this.cargar(false);
      },
      error: (err) => {
        this.avisos.error(mensajeDeError(err, 'No se pudo mover a la persona.'));
        this.cargar(false);
      },
    });
  }

  asignarOrden(e: Empleado, tareaId: number): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.elegida.set(null);
    this.gestion.asignar(tareaId, e.id).subscribe({
      next: (t) => {
        this.ocupado.set(false);
        this.avisos.exito(`Aviso enviado: ${e.nombre} tiene la orden #${t.id} (unos ${t.minutosEstimados} min).`);
        this.cargar(false);
      },
      error: (err) => {
        this.ocupado.set(false);
        this.avisos.error(mensajeDeError(err, 'No se pudo asignar la orden.'));
      },
    });
  }

  resolver(a: Alerta): void {
    if (a.sugerido && a.destino) this.moverA(a.sugerido, a.destino);
  }

  avance(t: Task): number {
    return avanceDe(t.asignadaEn, t.minutosEstimados, this.ahora());
  }

  sinAlmacen(t: Task): boolean {
    return t.tipo === 'REPOSICION' && t.productoId != null && this.almacenes().get(t.productoId) === 0;
  }

  iniciales(nombre?: string | null): string {
    return (nombre ?? '?')
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  primerNombre(nombre: string): string {
    return nombre.split(' ')[0];
  }
}
