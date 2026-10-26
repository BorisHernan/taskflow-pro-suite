import { HttpErrorResponse, HttpInterceptorFn, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Subject, delay, of, throwError } from 'rxjs';
import { API_BASE } from '../../auth/sesion.service';
import { EN_MONITOR } from '../monitor/en-monitor';
import {
  AvisoPersonal,
  Empleado,
  FilaInventario,
  Incidencia,
  Merma,
  Pedido,
  PuestoTienda,
  Tienda,
  Venta,
  distanciaKm,
} from '../../models/gestion.model';
import { OrdenVista } from '../../models/orden.model';
import { Product } from '../../models/product.model';
import { Task, TaskEvent } from '../../models/task.model';

/** Datos reales de la sede con los que se arma la sede de prueba (limpia). */
export interface FotoSede {
  tienda: Tienda;
  inventario: FilaInventario[];
  personal: Empleado[];
  usuario: string;
}

/** Una línea del registro "lo que hace el sistema". */
export interface LineaRegistro {
  id: number;
  hora: string;
  tipo: 'historia' | 'api' | 'regla' | 'tarea' | 'sse' | 'aviso';
  texto: string;
}

type Base = 'DISPONIBLE' | 'FUERA_DE_TURNO' | 'LIBRE_HOY' | 'AUSENTE';
interface Persona extends Empleado {
  base: Base;
}

const PUESTO_FRASE: Record<PuestoTienda, string> = {
  CAJA_1: 'la caja 1',
  CAJA_2: 'la caja 2',
  CAJA_3: 'la caja 3',
  CAJA_4: 'la caja 4',
  CAJA_5: 'la caja 5',
  ENTRADA: 'la entrada (seguridad)',
  PASILLOS: 'los pasillos (reposición)',
  ALMACEN: 'el almacén',
  DESPACHO: 'despacho de pedidos online',
};

/** Error con el mismo formato que devuelve el servidor. */
class ErrorDemo {
  constructor(
    readonly status: number,
    readonly mensaje: string,
  ) {}
}

/**
 * Sede de prueba en memoria para el recorrido guiado: responde como la API, empieza en blanco
 * (sin órdenes, mermas, incidencias ni pedidos) y al salir desaparece. No toca la base de datos.
 */
@Injectable({
  providedIn: 'root',
  // Dentro del monitor se usa la misma sede de prueba de la ventana principal.
  useFactory: () => (EN_MONITOR && (window.parent as any).__tfDemo) || new DemoBackend(),
})
export class DemoBackend {
  readonly activo = signal(false);
  /** Eventos del tablero de la sede de prueba (reemplazan al canal en vivo real). */
  readonly eventos$ = new Subject<TaskEvent>();
  readonly registro = signal<LineaRegistro[]>([]);
  /** Avisa cada cambio de datos: las dos pantallas (la nuestra y el monitor) se recargan. */
  readonly cambio$ = new Subject<void>();

  constructor() {
    if (!EN_MONITOR && typeof window !== 'undefined') (window as any).__tfDemo = this;
  }
  private lineas = 0;

  private tienda!: Tienda;
  private usuario = '';
  private inventario: FilaInventario[] = [];
  private personal: Persona[] = [];
  private tareas: Task[] = [];
  private mermas: Merma[] = [];
  private incidencias: Incidencia[] = [];
  private pedidos: Pedido[] = [];
  private ordenes: OrdenVista[] = [];
  private ventas: Venta[] = [];
  private avisos: AvisoPersonal[] = [];
  private ids = { tarea: 0, merma: 0, incidencia: 0, pedido: 0, orden: 0, venta: 0, aviso: 0 };
  private timers: ReturnType<typeof setTimeout>[] = [];

  /** Arma la sede de prueba: stock al día, todos en su puesto y nada pendiente. Simula el turno tarde. */
  iniciar(foto: FotoSede): void {
    this.detener();
    this.tienda = foto.tienda;
    this.usuario = foto.usuario;
    this.inventario = foto.inventario.map((f) => {
      const stock = Math.max(f.stock, f.stockObjetivo);
      return { ...f, stock, estado: 'OK', pedidoEnCurso: false };
    });
    this.personal = foto.personal.map((e) => {
      const base: Base = e.estado === 'AUSENTE' ? 'AUSENTE' : e.estado === 'LIBRE_HOY' ? 'LIBRE_HOY' : e.turno === 'TARDE' ? 'DISPONIBLE' : 'FUERA_DE_TURNO';
      // El turno recién empieza: nadie tiene puesto todavía.
      return { ...e, base, puestoActual: null, puestoDesde: null, avanceTurno: base === 'DISPONIBLE' ? 5 : 0, tareaId: null, tareaTitulo: null, tareaAsignadaEn: null, tareaMinutos: null };
    });
    this.tareas = [];
    this.mermas = [];
    this.incidencias = [];
    this.pedidos = [];
    this.ordenes = [];
    this.ventas = [];
    this.avisos = [];
    this.ids = { tarea: 0, merma: 0, incidencia: 0, pedido: 0, orden: 0, venta: 0, aviso: 0 };
    this.registro.set([]);
    this.activo.set(true);
    this.log('regla', `Sede de prueba lista: ${this.inventario.length} productos, ${this.personal.length} personas, sin tareas.`);
  }

  detener(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.activo.set(false);
  }

  log(tipo: LineaRegistro['tipo'], texto: string): void {
    const hora = new Date().toLocaleTimeString('es-PE', { hour12: false });
    this.registro.update((l) => [...l.slice(-120), { id: ++this.lineas, hora, tipo, texto }]);
  }

  /** Atiende una llamada a la API; undefined = no es de la sede de prueba (va al servidor real). */
  atender(metodo: string, ruta: string, cuerpo: any, params: HttpParams): unknown {
    const m = (patron: RegExp) => patron.exec(ruta);
    let r: RegExpExecArray | null;
    if (metodo === 'GET') {
      switch (ruta) {
        case '/api/resumen':
          return [this.resumen()];
        case '/api/ventas':
          return [...this.ventas].reverse();
        case '/api/ventas/por-dia':
          return [{ fecha: ahora().slice(0, 10), unidades: this.ventas.reduce((n, v) => n + v.cantidad, 0), ingresos: this.ventas.reduce((n, v) => n + v.total, 0) }];
        case '/api/inventario':
          return this.inventario.map((f) => this.fila(f));
        case '/api/turnos/actual':
          return null;
        case '/api/turnos':
        case '/api/reportes':
          return [];
        case '/api/mermas':
          return [...this.mermas].reverse();
        case '/api/incidencias':
          return [...this.incidencias].reverse();
        case '/api/pedidos':
          return [...this.pedidos].reverse();
        case '/api/personal':
          return this.personal.map((e) => this.empleado(e));
        case '/api/personal/avisos':
          return [...this.avisos].reverse();
        case '/api/tasks':
          return this.tareas;
        case '/api/ordenes':
          return [...this.ordenes].reverse();
        case '/api/products':
          return this.inventario.map((f) => this.producto(f));
      }
      return undefined;
    }
    this.log('api', `${metodo} ${ruta}`);
    queueMicrotask(() => this.cambio$.next());
    if (metodo === 'POST' && (r = m(/^\/api\/products\/(\d+)\/purchase$/))) return this.vender(+r[1], cuerpo.quantity);
    if (metodo === 'POST' && (r = m(/^\/api\/tasks\/(\d+)\/asignar$/))) return this.asignar(+r[1], cuerpo.empleadoId, !!cuerpo.rapido);
    if (metodo === 'PUT' && (r = m(/^\/api\/personal\/(\d+)\/puesto$/))) return this.moverA(+r[1], cuerpo.puesto);
    if (metodo === 'PUT' && (r = m(/^\/api\/personal\/(\d+)\/ausencia$/))) return this.ausencia(+r[1], cuerpo.disponibilidad, cuerpo.motivo);
    if (metodo === 'DELETE' && (r = m(/^\/api\/personal\/(\d+)\/ausencia$/))) return this.reincorporar(+r[1]);
    if (metodo === 'POST' && ruta === '/api/ordenes') return this.nuevaOrden(cuerpo);
    if (metodo === 'PATCH' && (r = m(/^\/api\/ordenes\/(\d+)\/estado$/))) {
      const o = this.ordenes.find((x) => x.orden.id === +r![1]);
      if (!o) throw new ErrorDemo(404, 'Pedido no encontrado.');
      o.orden.estado = cuerpo.estado;
      this.log('regla', `Pedido ${o.orden.codigo} → ${cuerpo.estado}`);
      return o;
    }
    if (metodo === 'POST' && ruta === '/api/pedidos') return this.nuevoPedido(cuerpo);
    if (metodo === 'POST' && ruta === '/api/mermas') return this.nuevaMerma(cuerpo);
    // Cualquier otro cambio no hace falta en la demo: se acepta sin tocar el servidor.
    if (metodo !== 'GET') return cuerpo ?? {};
    return undefined;
  }

  // ── Operaciones ─────────────────────────────────────────────────────

  private vender(productoId: number, cantidad: number): Product {
    const f = this.filaDe(productoId);
    if (f.stock < cantidad) throw new ErrorDemo(409, `Solo quedan ${f.stock} unidades.`);
    this.log('regla', `Inventario: ${f.producto} ${f.stock} → ${f.stock - cantidad} u. (venta de ${cantidad})`);
    f.stock -= cantidad;
    this.registrarVenta(f, cantidad);
    this.revisarStock(f);
    return this.producto(f);
  }

  private asignar(tareaId: number, empleadoId: number, rapido: boolean): Task {
    const t = this.tareas.find((x) => x.id === tareaId);
    const e = this.personal.find((x) => x.id === empleadoId);
    if (!t || !e) throw new ErrorDemo(404, 'No encontrado.');
    if (this.ocupada(e.id)) throw new ErrorDemo(409, `${e.nombre} ya tiene una orden en curso.`);
    const minutos = rapido || t.tipo === 'REPOSICION' || t.tipo === 'MANUAL' ? 0.5 : t.tipo === 'PEDIDO' ? 8 : 5;
    Object.assign(t, { status: 'IN_PROGRESS', empleadoId: e.id, asignadoA: e.nombre, asignadaEn: ahora(), minutosEstimados: minutos, updatedAt: ahora() });
    this.log('tarea', `Orden #${t.id} → ${e.nombre}, en progreso (estimado ${minutos < 1 ? '30 s' : minutos + ' min'})`);
    this.avisar(e, `${e.nombre}: tienes la orden #${t.id} · ${t.title} (unos ${minutos < 1 ? '30 s' : minutos + ' min'}).`);
    // Un pedido online asignado pasa a "Preparando".
    const orden = this.ordenes.find((o) => o.orden.tareaId === t.id);
    if (orden && orden.orden.estado === 'RECIBIDA') {
      orden.orden.estado = 'PREPARANDO';
      this.log('regla', `Pedido ${orden.orden.codigo}: RECIBIDO → PREPARANDO (el cliente lo ve en su seguimiento)`);
    }
    this.emitir('UPDATED', t);
    if (t.tipo === 'REPOSICION' || t.tipo === 'MANUAL') this.timers.push(setTimeout(() => this.terminar(t, e), minutos * 60000));
    return { ...t };
  }

  /** Al cumplirse el tiempo, la persona termina: la reposición pasa unidades del almacén al piso. */
  private terminar(t: Task, e: Persona): void {
    if (t.status !== 'IN_PROGRESS' || t.empleadoId !== e.id) return;
    let nota = `Hecho por ${e.nombre}.`;
    if (t.tipo === 'REPOSICION' && t.productoId != null) {
      const f = this.filaDe(t.productoId);
      const q = Math.min(f.almacen, Math.max(0, f.stockObjetivo - f.stock));
      f.almacen -= q;
      f.stock += q;
      nota = `${e.nombre} repuso ${q} u. desde el almacén.`;
      this.log('regla', `Tiempo cumplido: almacén ${f.almacen + q} → ${f.almacen}, piso ${f.stock - q} → ${f.stock} (${f.producto})`);
    }
    Object.assign(t, { status: 'DONE', cerradaEn: ahora(), updatedAt: ahora(), description: `${t.description ?? ''} ${nota}`.trim() });
    this.log('tarea', `Orden #${t.id} cerrada sola: ${nota}`);
    this.emitir('UPDATED', t);
  }

  private moverA(id: number, puesto: PuestoTienda | null): Empleado {
    const e = this.persona(id);
    e.puestoActual = puesto;
    e.puestoDesde = puesto ? ahora() : null;
    this.avisar(e, puesto ? `${e.nombre}: ve a ${PUESTO_FRASE[puesto]}.` : `${e.nombre}: quedas sin puesto fijo, atento a nuevas órdenes.`);
    return this.empleado(e);
  }

  private ausencia(id: number, tipo: Empleado['disponibilidad'], motivo: string): Empleado {
    const e = this.persona(id);
    Object.assign(e, { base: 'AUSENTE', disponibilidad: tipo, motivo, ausenteDesde: ahora().slice(0, 10) });
    this.log('regla', `${e.nombre}: ${tipo} (${motivo}). Ya no se le pueden asignar órdenes.`);
    // Su orden en curso queda libre para otra persona.
    this.tareas
      .filter((t) => t.empleadoId === id && t.status === 'IN_PROGRESS')
      .forEach((t) => {
        Object.assign(t, { status: 'TODO', empleadoId: null, asignadaEn: null, minutosEstimados: null });
        this.emitir('UPDATED', t);
      });
    return this.empleado(e);
  }

  private reincorporar(id: number): Empleado {
    const e = this.persona(id);
    Object.assign(e, { base: e.turno === 'TARDE' ? 'DISPONIBLE' : 'FUERA_DE_TURNO', disponibilidad: 'ACTIVO', motivo: null, ausenteDesde: null });
    return this.empleado(e);
  }

  private nuevaOrden(req: any): OrdenVista {
    const lineas = (req.lineas as { productoId: number; cantidad: number }[]).map((l) => {
      const f = this.filaDe(l.productoId);
      f.stock -= l.cantidad;
      this.registrarVenta(f, l.cantidad);
      this.revisarStock(f);
      return { producto: f.producto, cantidad: l.cantidad, total: f.precio * l.cantidad, fecha: ahora() };
    });
    const total = lineas.reduce((s, l) => s + l.total, 0);
    const envio = req.modalidad === 'ENVIO';
    const id = ++this.ids.orden;
    const codigo = 'TF-DEMO' + String(id).padStart(2, '0');
    const tarea = this.crearTarea({
      title: `Preparar pedido ${codigo} · ${envio ? 'envío' : 'recojo'}`,
      description: lineas.map((l) => `${l.cantidad} × ${l.producto}`).join(', ') + `. Cliente: ${req.clienteNombre}.`,
      tipo: 'PEDIDO',
      prioridad: envio ? 'ALTA' : 'MEDIA',
      creadoPor: 'tienda online',
    });
    const km =
      envio && this.tienda.latitud != null && this.tienda.longitud != null
        ? Math.round(distanciaKm({ lat: this.tienda.latitud, lng: this.tienda.longitud }, { lat: req.latitud, lng: req.longitud }) * 100) / 100
        : null;
    const vista: OrdenVista = {
      orden: {
        id,
        codigo,
        tiendaId: this.tienda.id,
        clienteNombre: req.clienteNombre,
        modalidad: req.modalidad,
        direccion: req.direccion ?? null,
        latitud: req.latitud ?? null,
        longitud: req.longitud ?? null,
        distanciaKm: km,
        subtotal: total,
        descuento: 0,
        total,
        cupon: null,
        estado: 'RECIBIDA',
        tareaId: tarea.id,
        creadaEn: ahora(),
        actualizadaEn: ahora(),
      },
      lineas,
      tiendaNombre: this.tienda.nombre,
      tiendaDireccion: this.tienda.direccion,
      tiendaLatitud: this.tienda.latitud,
      tiendaLongitud: this.tienda.longitud,
    };
    this.ordenes.push(vista);
    this.log('regla', `Pedido online ${codigo} · ${lineas.length} productos · S/ ${total.toFixed(2)} · ${envio ? `envío a ${km} km` : 'recojo'}`);
    return vista;
  }

  private nuevoPedido(req: any): Pedido {
    const f = this.filaDe(req.productoId);
    const e = req.empleadoId ? this.persona(req.empleadoId) : null;
    const alerta = this.alertaAbierta(f.productoId);
    const p = {
      id: ++this.ids.pedido,
      tiendaId: this.tienda.id,
      productoId: f.productoId,
      productoNombre: f.producto,
      cantidad: req.cantidad,
      costo: Math.round(f.precio * 0.6 * req.cantidad * 100) / 100,
      estado: 'SOLICITADO',
      nota: req.nota ?? null,
      tareaId: alerta?.id ?? null,
      solicitadoPor: e?.nombre ?? this.usuario,
      revisadoPor: null,
      creadoEn: ahora(),
      actualizadoEn: ahora(),
    } as unknown as Pedido;
    this.pedidos.push(p);
    this.log('regla', `Compra #${p.id} al distribuidor: ${p.cantidad} u. de ${f.producto} (pendiente de aprobación)`);
    if (alerta) {
      Object.assign(alerta, { status: 'IN_PROGRESS', description: `${alerta.description ?? ''} Pedido #${p.id} al distribuidor.`.trim() });
      this.emitir('UPDATED', alerta);
    }
    if (e) this.avisar(e, `${e.nombre}: enviaste al distribuidor el pedido #${p.id} · ${p.cantidad} u. de ${f.producto}.`);
    return p;
  }

  private nuevaMerma(req: any): Merma {
    const f = this.filaDe(req.productoId);
    f.stock = Math.max(0, f.stock - req.cantidad);
    const merma = {
      id: ++this.ids.merma,
      tiendaId: this.tienda.id,
      productoId: f.productoId,
      productoNombre: f.producto,
      cantidad: req.cantidad,
      motivo: req.motivo,
      costo: Math.round(f.precio * 0.6 * req.cantidad * 100) / 100,
      nota: req.nota ?? null,
      turnoId: null,
      registradoPor: this.usuario,
      creadaEn: ahora(),
    } as unknown as Merma;
    this.mermas.push(merma);
    this.log('regla', `Merma #${merma.id}: ${req.cantidad} × ${f.producto} por ${req.motivo}, costo S/ ${Number(merma.costo).toFixed(2)}`);
    if (req.motivo === 'ROBO') {
      this.log('regla', 'Regla de seguridad: un robo abre una incidencia.');
      const titulo = `Robo de ${req.cantidad} × ${f.producto}`;
      const tarea = this.crearTarea({ title: `Atender: ${titulo}`, tipo: 'INCIDENCIA', prioridad: 'ALTA', description: 'Revisar cámaras y reforzar la entrada.' });
      this.incidencias.push({
        id: ++this.ids.incidencia,
        tiendaId: this.tienda.id,
        titulo,
        descripcion: `Registrado como merma #${merma.id}.`,
        categoria: 'SEGURIDAD',
        severidad: 'ALTA',
        estado: 'ABIERTA',
        solucion: null,
        tareaId: tarea.id,
        turnoId: null,
        reportadaPor: this.usuario,
        creadaEn: ahora(),
        resueltaEn: null,
      } as unknown as Incidencia);
    }
    this.revisarStock(f);
    return merma;
  }

  // ── Reglas de la sede ───────────────────────────────────────────────

  /** Igual que el servidor: bajo el mínimo se abre (o actualiza) la alerta; repuesto, se cierra. */
  private revisarStock(f: FilaInventario): void {
    const abierta = this.alertaAbierta(f.productoId);
    if (f.stock <= f.stockMinimo) {
      this.log('regla', `Regla de stock: ${f.producto} quedó en ${f.stock} (mínimo ${f.stockMinimo}) → alerta de reposición`);
      const detalle = `${f.stock === 0 ? 'Agotado' : `Quedan ${f.stock} unidades`} (mínimo ${f.stockMinimo}). Sugerido: pedir ${Math.max(1, f.stockObjetivo - f.stock)}.`;
      if (abierta) {
        Object.assign(abierta, { description: detalle, prioridad: f.stock === 0 ? 'CRITICA' : 'ALTA' });
        this.emitir('UPDATED', abierta);
      } else {
        this.crearTarea({ title: `Reponer ${f.producto}`, description: detalle, tipo: 'REPOSICION', prioridad: f.stock === 0 ? 'CRITICA' : 'ALTA', productoId: f.productoId });
      }
    } else if (abierta && abierta.status !== 'IN_PROGRESS') {
      Object.assign(abierta, { status: 'DONE', cerradaEn: ahora() });
      this.emitir('UPDATED', abierta);
    }
  }

  private crearTarea(datos: Partial<Task>): Task {
    const t: Task = {
      id: ++this.ids.tarea,
      title: datos.title ?? '',
      description: datos.description ?? null,
      status: 'TODO',
      position: this.ids.tarea,
      createdAt: ahora(),
      updatedAt: ahora(),
      tiendaId: this.tienda.id,
      tipo: datos.tipo ?? 'MANUAL',
      prioridad: datos.prioridad ?? 'MEDIA',
      productoId: datos.productoId ?? null,
      referenciaId: null,
      turnoId: null,
      creadoPor: datos.creadoPor ?? 'sistema',
      asignadoA: null,
      empleadoId: null,
      asignadaEn: null,
      minutosEstimados: null,
      cerradaEn: null,
    } as Task;
    this.tareas.push(t);
    this.log('tarea', `Tarea #${t.id} creada: ${t.title} (${t.tipo}, prioridad ${t.prioridad})`);
    this.emitir('CREATED', t);
    return t;
  }

  private alertaAbierta(productoId: number): Task | undefined {
    return this.tareas.find((t) => t.tipo === 'REPOSICION' && t.productoId === productoId && t.status !== 'DONE');
  }

  private registrarVenta(f: FilaInventario, cantidad: number): void {
    this.ventas.push({ id: ++this.ids.venta, tiendaId: this.tienda.id, producto: f.producto, categoria: f.categoria, cantidad, total: f.precio * cantidad, fecha: ahora() });
  }

  private avisar(e: Persona, mensaje: string): void {
    this.avisos.push({ id: ++this.ids.aviso, empleadoId: e.id, empleado: e.nombre, mensaje, creadoEn: ahora() });
    this.log('aviso', `Notificación al teléfono de ${e.nombre}: "${mensaje.slice(mensaje.indexOf(': ') + 2)}"`);
  }

  private ocupada(id: number): Task | undefined {
    return this.tareas.find((t) => t.empleadoId === id && t.status === 'IN_PROGRESS');
  }

  private emitir(type: TaskEvent['type'], t: Task): void {
    this.eventos$.next({ type, task: { ...t } });
    this.log('sse', `Tiempo real → ${type} tarea #${t.id}: todas las pantallas abiertas se actualizan`);
  }

  // ── Vistas con la forma de la API ───────────────────────────────────

  private resumen() {
    const abiertas = this.tareas.filter((t) => t.status !== 'DONE');
    return {
      tiendaId: this.tienda.id,
      codigo: this.tienda.codigo,
      nombre: this.tienda.nombre,
      ventasHoy: this.ventas.reduce((s, v) => s + v.total, 0),
      comprasHoy: this.ventas.length,
      alertas: this.inventario.filter((f) => f.stock <= f.stockMinimo).length,
      agotados: this.inventario.filter((f) => f.stock === 0).length,
      incidenciasAbiertas: this.incidencias.filter((i) => i.estado !== 'RESUELTA').length,
      tareasAbiertas: abiertas.length,
      tareasUrgentes: abiertas.filter((t) => t.prioridad === 'ALTA' || t.prioridad === 'CRITICA').length,
      mermasMes: this.mermas.reduce((s, m) => s + Number(m.costo), 0),
      pedidosEnCurso: this.pedidos.filter((p) => p.estado === 'SOLICITADO' || p.estado === 'APROBADO').length,
      turnoResponsable: null,
    };
  }

  private fila(f: FilaInventario): FilaInventario {
    const estado = f.stock === 0 ? 'AGOTADO' : f.stock <= f.stockMinimo ? 'BAJO' : 'OK';
    const pedidoEnCurso = this.pedidos.some((p) => p.productoId === f.productoId && (p.estado === 'SOLICITADO' || p.estado === 'APROBADO'));
    return { ...f, estado, pedidoEnCurso };
  }

  private producto(f: FilaInventario): Product {
    return { id: f.productoId, name: f.producto, price: f.precio, stock: f.stock, category: f.categoria, icon: f.icono, tiendaId: this.tienda.id } as Product;
  }

  private empleado(e: Persona): Empleado {
    const t = e.base === 'DISPONIBLE' ? this.ocupada(e.id) : undefined;
    const { base, ...resto } = e;
    return {
      ...resto,
      estado: base === 'DISPONIBLE' ? (t ? 'TRABAJANDO' : 'DISPONIBLE') : base,
      puestoActual: base === 'DISPONIBLE' ? e.puestoActual : null,
      tareaId: t?.id ?? null,
      tareaTitulo: t?.title ?? null,
      tareaAsignadaEn: t?.asignadaEn ?? null,
      tareaMinutos: t?.minutosEstimados ?? null,
    };
  }

  private filaDe(productoId: number): FilaInventario {
    const f = this.inventario.find((x) => x.productoId === productoId);
    if (!f) throw new ErrorDemo(404, 'Producto no encontrado.');
    return f;
  }

  private persona(id: number): Persona {
    const e = this.personal.find((x) => x.id === id);
    if (!e) throw new ErrorDemo(404, 'Persona no encontrada.');
    return e;
  }
}

/** Fecha y hora local con el formato del servidor (sin zona). */
function ahora(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
}

/** Mientras la demo está activa, la API de la sede la responde la sede de prueba en memoria. */
export const demoInterceptor: HttpInterceptorFn = (req, next) => {
  const demo = inject(DemoBackend);
  if (!demo.activo() || !req.url.startsWith(API_BASE)) return next(req);
  const ruta = req.url.slice(API_BASE.length).split('?')[0];
  try {
    const cuerpo = demo.atender(req.method, ruta, req.body, req.params);
    if (cuerpo === undefined) return next(req);
    return of(new HttpResponse({ status: 200, body: cuerpo, url: req.url })).pipe(delay(150));
  } catch (e) {
    const err = e instanceof ErrorDemo ? e : new ErrorDemo(500, 'Error en la demo.');
    return throwError(() => new HttpErrorResponse({ status: err.status, error: { error: err.mensaje }, url: req.url }));
  }
};
