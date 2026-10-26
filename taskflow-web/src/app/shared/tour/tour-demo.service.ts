import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SesionService } from '../../auth/sesion.service';
import { GestionService } from '../../gestion/gestion.service';
import { Empleado, FilaInventario, NOMBRE_PUESTO_TIENDA, PuestoTienda } from '../../models/gestion.model';
import { Task } from '../../models/task.model';
import { OrdenService } from '../../services/orden.service';
import { ProductService } from '../../services/product.service';
import { TaskService } from '../../services/task.service';
import { DemoBackend } from '../demo/demo-backend.service';
import { MonitorService, UsuarioMonitor } from '../monitor/monitor.component';
import { TelefonoService } from '../telefono/telefono-empleado.component';
import { PasoTour, TourService } from './tour.service';

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const ROCIO: UsuarioMonitor = { nombre: 'Rocío', rol: 'supervisora de turno', equipo: 'PC de la oficina' };
/** Claves del navegador que la demo usa en la tienda online; al terminar se dejan como estaban. */
const CLAVES_TIENDA = ['taskflow-sede', 'taskflow-carrito', 'taskflow-cliente'];

/**
 * Demo en vivo del recorrido sobre una sede de prueba en blanco (en memoria, no se guarda).
 * Cuando otra persona registra algo, el recorrido se detiene y aparece su monitor con la app real:
 * se ve cómo usa cada módulo. Al terminar, el monitor se cierra y vemos el cambio en nuestra pantalla.
 */
@Injectable({ providedIn: 'root' })
export class TourDemoService {
  private readonly tour = inject(TourService);
  private readonly gestion = inject(GestionService);
  private readonly sesion = inject(SesionService);
  private readonly productos = inject(ProductService);
  private readonly tareas = inject(TaskService);
  private readonly ordenes = inject(OrdenService);
  private readonly telefono = inject(TelefonoService);
  private readonly sandbox = inject(DemoBackend);
  private readonly monitor = inject(MonitorService);

  private tiendaAdminAntes: { antes: number | null } | null = null;
  private clavesAntes: Record<string, string | null> = {};
  private tareaReposicion: number | null = null;
  private producto: FilaInventario | null = null;
  private incidencia: number | null = null;
  private usados = new Set<number>();

  constructor() {
    this.tour.proveedor = () => this.pasos();
    this.tour.antesDeEmpezar = () => this.prepararSede();
    this.tour.alCambiarPaso = () => {
      this.telefono.cerrar();
      this.monitor.cerrar();
    };
    this.tour.alTerminar = () => this.terminar();
  }

  pasos(): PasoTour[] {
    this.tareaReposicion = null;
    this.producto = null;
    this.incidencia = null;
    this.usados = new Set();
    return [
      {
        ruta: '/gestion/resumen',
        ancla: 'kpis',
        titulo: 'Una sede en blanco',
        texto: 'Una sede de prueba recién abierta: sin ventas, órdenes ni incidencias. Todo lo que verás es simulado y no se guarda.',
        accion: () =>
          this.historia([
            'Son las 3 de la tarde: empieza el turno tarde.',
            'Cuando otra persona use el sistema, el recorrido se detiene y verás su pantalla en un monitor.',
          ]),
      },
      {
        ruta: '/gestion/operaciones',
        ancla: 'plano',
        titulo: 'Cada uno a su puesto',
        texto: 'El equipo llegó y todavía no tiene puesto. La supervisora los ubica desde su computadora, en el Centro de operaciones.',
        accion: () => this.repartirPuestos(),
      },
      {
        ruta: '/gestion/operaciones',
        ancla: 'equipo',
        titulo: 'El equipo de hoy',
        texto: 'Solo se asigna trabajo a quien vino y está en turno. Quien descansa, está de vacaciones o enfermo aparece abajo, bloqueado.',
      },
      {
        ruta: '/gestion/operaciones',
        ancla: 'plano',
        titulo: 'Alta concurrencia',
        texto: 'Llegan muchos clientes a la vez. El sistema detecta que hay pocas cajas abiertas y avisa que hace falta personal en caja.',
        accion: () => this.altaConcurrencia(),
      },
      {
        ruta: '/gestion/resumen',
        ancla: 'reponer',
        titulo: 'Las ventas dejaron algo por reponer',
        texto: 'Nadie anota qué falta: cuando una venta deja un producto en su mínimo, el sistema crea la alerta y la orden de reposición.',
        accion: () => this.mostrarAlertaDeStock(),
      },
      {
        ruta: '/gestion/operaciones',
        ancla: 'ordenes-op',
        titulo: 'Asignar la reposición',
        texto: 'La orden de reposición espera a alguien. La supervisora se la asigna a un reponedor libre desde el tablero.',
        accion: () => this.asignarReposicion(),
      },
      {
        ruta: '/gestion/tablero',
        ancla: () => (this.tareaReposicion ? `[data-tarea="${this.tareaReposicion}"]` : 'tarea-automatica'),
        titulo: 'Órdenes de trabajo',
        texto: 'La misma orden en nuestro tablero: quién la hace y cuánto le falta. En la demo dura 30 segundos y se cierra sola.',
        accion: () => this.verTerminarReposicion(),
      },
      {
        ruta: '/gestion/personal',
        ancla: 'personal',
        titulo: 'Personal',
        texto: 'Quién trabaja, quién está libre y quién falta. Aquí se ven las ausencias que registra la supervisora.',
        accion: () => this.registrarDescansoMedico(),
      },
      {
        ruta: '/gestion/pedidos-online',
        ancla: 'pedidos-online',
        titulo: 'Pedidos online',
        texto: 'Las compras de la tienda web llegan aquí con su tarea. La sede las prepara y el cliente las sigue con su código.',
        accion: () => this.recibirPedidoOnline(),
      },
      {
        ruta: '/gestion/turnos',
        ancla: 'turnos',
        titulo: 'Turnos',
        texto: 'Se abre el turno con su checklist y al cerrarlo queda el resumen: ventas, mermas e incidencias del turno.',
      },
      {
        ruta: '/gestion/inventario',
        ancla: 'stock',
        titulo: 'Stock',
        texto: 'El stock del piso de venta, el mínimo, el objetivo y lo que queda en el almacén para reponer.',
      },
      {
        ruta: '/gestion/compras',
        ancla: 'compras',
        titulo: 'Compras al distribuidor',
        texto: 'Lo que ya no hay ni en el almacén se pide al distribuidor; la administración aprueba la compra.',
        accion: () => this.pedirAlDistribuidor(),
      },
      {
        ruta: '/gestion/mermas',
        ancla: 'mermas',
        titulo: 'Mermas',
        texto: 'Producto que se pierde: dañado, vencido o robado. Se descuenta del stock con su costo.',
        accion: () => this.registrarRobo(),
      },
      {
        ruta: '/gestion/incidencias',
        ancla: () => (this.incidencia ? `[data-incidencia="${this.incidencia}"]` : 'incidencias'),
        titulo: 'Incidencias',
        texto: 'El robo abrió una incidencia de seguridad con su orden de trabajo para que alguien la atienda.',
        accion: () => this.historia(['Esta es la incidencia que abrió el robo.', 'Ya tiene su orden de trabajo, lista para asignar.']),
      },
      {
        ruta: '/gestion/tablero',
        ancla: 'conexion',
        titulo: 'Todo en tiempo real',
        texto: 'Todo lo que hicieron los demás llegó a cada pantalla al instante, sin recargar. Al salir, la sede de prueba desaparece.',
      },
      {
        ruta: '/gestion/estadisticas',
        ancla: 'estadisticas',
        titulo: 'Estadísticas',
        texto: 'Solo para la administración: ventas por día y comparación entre las tres sedes (datos reales).',
        soloAdmin: true,
      },
      {
        ruta: '/gestion/reportes',
        ancla: 'reportes',
        titulo: 'Reportes',
        texto: 'Descarga en CSV las ventas, mermas, compras e incidencias del periodo que elijas.',
        soloAdmin: true,
      },
    ];
  }

  // ── Preparar y cerrar la sede de prueba ─────────────────────────────

  private async prepararSede(): Promise<void> {
    if (this.gestion.tiendaActiva() == null) {
      const tiendas = await firstValueFrom(this.gestion.tiendas$);
      if (!tiendas.length) return;
      this.tiendaAdminAntes = { antes: null };
      this.gestion.elegirTienda(tiendas[0].id);
    }
    const tiendaId = this.gestion.tiendaActiva()!;
    const [tiendas, inventario, personal] = await Promise.all([
      firstValueFrom(this.gestion.tiendas$),
      firstValueFrom(this.gestion.inventario()),
      firstValueFrom(this.gestion.personal()),
    ]);
    const tienda = tiendas.find((t) => t.id === tiendaId);
    if (!tienda) return;
    // La tienda online del monitor muestra esta sede y empieza con el carrito vacío.
    this.clavesAntes = {};
    try {
      for (const k of CLAVES_TIENDA) this.clavesAntes[k] = localStorage.getItem(k);
      localStorage.setItem('taskflow-sede', String(tiendaId));
      localStorage.removeItem('taskflow-carrito');
    } catch {}
    this.sandbox.iniciar({ tienda, inventario, personal, usuario: this.sesion.usuario()?.usuario ?? 'encargado' });
    this.monitor.montar();
    this.gestion.avisarCambio();
    await pausa(400);
  }

  private terminar(): void {
    this.telefono.cerrar();
    this.monitor.desmontar();
    this.sandbox.detener();
    try {
      for (const [k, v] of Object.entries(this.clavesAntes)) {
        if (v == null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      }
    } catch {}
    if (this.tiendaAdminAntes) this.gestion.elegirTienda(this.tiendaAdminAntes.antes);
    this.tiendaAdminAntes = null;
    this.gestion.avisarCambio();
  }

  // ── La historia ─────────────────────────────────────────────────────

  private async repartirPuestos(): Promise<void> {
    const personal = (await this.personal()).filter((e) => e.estado === 'DISPONIBLE');
    if (!personal.length) return;
    await this.enMonitor(ROCIO, '/gestion/operaciones', `Rocío ubica a las ${personal.length} personas del turno desde el Centro de operaciones.`, async () => {
      let caja = 1;
      for (const e of personal) {
        const puesto: PuestoTienda =
          e.puesto === 'CAJERO' ? (`CAJA_${caja++}` as PuestoTienda) : e.puesto === 'REPONEDOR' ? 'PASILLOS' : e.puesto === 'ALMACENERO' ? 'ALMACEN' : 'DESPACHO';
        await this.narrar(`Toca a ${e.nombre.split(' ')[0]} y luego ${NOMBRE_PUESTO_TIENDA[puesto].toLowerCase()}…`);
        await this.monitor.clic(`.ficha[data-empleado="${e.id}"]`);
        await this.monitor.clic(`#puesto-${puesto}`);
      }
    }, 'Cada uno recibió en su celular a dónde ir.');
    await this.tour.enfocar('[data-tour="plano"]', 'Así se ve en nuestra pantalla');
    await this.narrar('Los mismos cambios ya están en nuestra pantalla, sin recargar.', 2600);
  }

  /** Muchas compras seguidas: el sistema avisa que faltan cajas y la supervisora mueve a un reponedor. */
  private async altaConcurrencia(): Promise<void> {
    const tienda = this.gestion.tiendaActiva();
    if (tienda == null) return;
    const inventario = await firstValueFrom(this.gestion.inventario());
    // Una de las ventas deja un producto en su mínimo (para la reposición de después).
    this.producto =
      inventario.filter((x) => x.almacen > 0 && x.stock - x.stockMinimo <= 60).sort((a, b) => a.stock - a.stockMinimo - (b.stock - b.stockMinimo))[0] ?? null;
    const otros = inventario.filter((x) => x.stock > x.stockMinimo + 3 && x.productoId !== this.producto?.productoId).slice(0, 3);

    await this.narrar('Son las 6 de la tarde: entra mucha gente a la tienda…', 2200);
    await this.enMonitor({ nombre: 'Lucía', rol: 'clienta', equipo: 'Celular de la clienta' }, '/tienda', 'Lucía compra en la tienda online.', async () => {
      await this.monitor.clic('article.producto button.btn-primary', 0);
      await this.monitor.clic('article.producto button.btn-primary', 1);
      await this.monitor.clic('[aria-label^="Abrir el carrito"]');
      await this.monitor.escribir('input[name=cliente]', 'Lucía');
      await this.monitor.clic('button.pagar');
      await this.monitor.esperar('.boleta');
      // Mientras tanto, más clientes pagan en caja.
      await this.narrar('Y mientras tanto, otros clientes pagan en caja…', 1600);
      for (const f of otros) await firstValueFrom(this.productos.purchase(f.productoId, 1, tienda));
      if (this.producto) await firstValueFrom(this.productos.purchase(this.producto.productoId, this.producto.stock - this.producto.stockMinimo, tienda));
    }, 'Muchas compras en pocos minutos y una sola caja abierta.');

    await this.tour.enfocar('.alerta-op', 'Notificación: alta concurrencia');
    await this.narrar('El sistema lo detecta solo: hace falta personal en caja.', 3000);

    const personal = await this.personal();
    const ocupadas = new Set(personal.map((e) => e.puestoActual).filter(Boolean));
    const cerrada = (['CAJA_1', 'CAJA_2', 'CAJA_3', 'CAJA_4', 'CAJA_5'] as PuestoTienda[]).find((c) => !ocupadas.has(c));
    const e = this.libre(personal, (x) => x.puesto === 'REPONEDOR');
    if (!cerrada || !e) return;
    const caja = NOMBRE_PUESTO_TIENDA[cerrada].toLowerCase();
    await this.enMonitor(ROCIO, '/gestion/operaciones', `Rocío ve la alerta y pasa a ${e.nombre.split(' ')[0]} de pasillos a la ${caja}.`, async () => {
      this.usados.add(e.id);
      await this.monitor.clic(`.ficha[data-empleado="${e.id}"]`);
      await this.monitor.clic(`#puesto-${cerrada}`);
    }, `${e.nombre.split(' ')[0]} va a la ${caja}.`);
    await this.tour.enfocar(`#puesto-${cerrada}`, `Nuevo: ${e.nombre.split(' ')[0]} abre la ${caja}`);
    await this.notificar(e, `📱 A ${e.nombre.split(' ')[0]} le llega en su celular: "ve a la ${caja}".`);
  }

  private async mostrarAlertaDeStock(): Promise<void> {
    const f = this.producto;
    if (!f) return;
    this.tareaReposicion = await this.esperarTarea((t) => t.tipo === 'REPOSICION' && t.productoId === f.productoId && t.status !== 'DONE');
    await this.tour.enfocar(`[data-tour="reponer"] [data-producto="${f.productoId}"]`, 'Nuevo: alerta creada por las ventas');
    await this.narrar(`Una de esas ventas dejó "${f.producto}" en su mínimo (${f.stockMinimo}).`, 2600);
    await this.narrar(`El sistema creó la alerta y la orden #${this.tareaReposicion ?? ''}: nadie tuvo que anotarlo.`, 2800);
  }

  private async asignarReposicion(): Promise<void> {
    const tarea = this.tareaReposicion;
    if (!tarea) return;
    const e = this.libre(await this.personal(), (x) => x.puesto === 'REPONEDOR') ?? this.libre(await this.personal(), (x) => x.puesto === 'ALMACENERO');
    if (!e) return;
    await this.enMonitor(ROCIO, '/gestion/tablero', `Rocío abre Órdenes de trabajo y asigna la orden #${tarea} a ${e.nombre.split(' ')[0]}.`, async () => {
      this.usados.add(e.id);
      await this.monitor.elegir(`[data-tarea="${tarea}"] select.asignar`, e.nombre);
    }, 'Orden asignada.');
    await this.tour.enfocar(`.orden.en-curso[data-tarea="${tarea}"]`, `Nuevo: ${e.nombre.split(' ')[0]} hace la orden #${tarea}`);
    await this.notificar({ ...e, estado: 'TRABAJANDO' }, `📱 ${e.nombre.split(' ')[0]} recibe la orden #${tarea} en su celular y su avance empieza a correr.`);
  }

  private async verTerminarReposicion(): Promise<void> {
    if (!this.tareaReposicion) return;
    await this.narrar('La barra avanza mientras la persona trabaja…');
    for (let i = 0; i < 45; i++) {
      const t = (await firstValueFrom(this.tareas.getAll(this.gestion.tiendaActiva()))).find((x) => x.id === this.tareaReposicion);
      if (t?.status === 'DONE') {
        await this.tour.enfocar(`[data-tarea="${this.tareaReposicion}"]`, 'Hecho: se cerró sola');
        await this.narrar('¡Listo! Pasó las unidades del almacén al piso y la orden se cerró sola.', 2600);
        return;
      }
      await pausa(1000);
    }
  }

  private async registrarDescansoMedico(): Promise<void> {
    const e = this.libre(await this.personal(), (x) => x.puesto === 'CAJERO');
    if (!e) return;
    await this.narrar(`Suena el teléfono: ${e.nombre} tiene fiebre y se va a casa.`, 2600);
    await this.enMonitor(ROCIO, '/gestion/personal', `Rocío registra el descanso médico de ${e.nombre.split(' ')[0]} en Personal.`, async () => {
      await this.monitor.clic(`.persona[data-empleado="${e.id}"] .acciones button:last-child`);
      await this.monitor.elegir('dialog.dialogo select[name=tipo]', 'Descanso médico');
      await this.monitor.escribir('dialog.dialogo input[name=motivo]', 'Fiebre, con certificado');
      await this.monitor.clic('dialog.dialogo button[type=submit]');
    }, 'Ausencia registrada.');
    await this.tour.enfocar(`.persona[data-empleado="${e.id}"]`, 'Nuevo: descanso médico');
    await this.narrar(`${e.nombre.split(' ')[0]} queda en descanso médico: ya no se le asignan órdenes y su caja queda libre.`, 2800);
  }

  private async recibirPedidoOnline(): Promise<void> {
    const tienda = this.gestion.tiendaActiva();
    if (tienda == null) return;
    await this.enMonitor({ nombre: 'Valeria', rol: 'clienta', equipo: 'Celular de la clienta' }, '/tienda', 'Valeria hace un pedido en la tienda online.', async () => {
      await this.monitor.clic('article.producto button.btn-primary', 2);
      await this.monitor.clic('article.producto button.btn-primary', 3);
      await this.monitor.clic('[aria-label^="Abrir el carrito"]');
      await this.monitor.escribir('input[name=cliente]', 'Valeria');
      await this.monitor.clic('button.pagar');
      await this.monitor.esperar('.boleta');
    }, 'Pedido pagado.');
    const [ultimo] = await firstValueFrom(this.ordenes.listar(tienda));
    if (!ultimo) return;
    const codigo = ultimo.orden.codigo;
    await this.tour.enfocar(`[data-orden="${codigo}"]`, `Nuevo: pedido de Valeria`);
    await this.narrar(`El pedido ${codigo} llegó a la sede con su tarea "Preparar pedido".`, 2400);

    const e = this.libre(await this.personal(), (x) => x.puesto === 'REPARTIDOR') ?? this.libre(await this.personal(), () => true);
    const tarea = ultimo.orden.tareaId;
    if (!e || !tarea) return;
    await this.enMonitor(ROCIO, '/gestion/tablero', `Rocío asigna el pedido ${codigo} a ${e.nombre.split(' ')[0]}.`, async () => {
      this.usados.add(e.id);
      await this.monitor.elegir(`[data-tarea="${tarea}"] select.asignar`, e.nombre);
    }, 'Pedido asignado.');
    await this.tour.enfocar(`[data-orden="${codigo}"]`, 'Ahora: preparando');
    await this.notificar({ ...e, estado: 'TRABAJANDO' }, `📱 A ${e.nombre.split(' ')[0]} le llega el pedido; Valeria ya lo ve "Preparando" en su seguimiento.`);
  }

  private async pedirAlDistribuidor(): Promise<void> {
    const [inventario, personal] = await Promise.all([firstValueFrom(this.gestion.inventario()), this.personal()]);
    const f = inventario.find((x) => x.almacen === 0 && !x.pedidoEnCurso);
    if (!f) return;
    const e = this.libre(personal, (x) => x.puesto === 'ALMACENERO') ?? this.libre(personal, () => true);
    const quien: UsuarioMonitor = e ? { nombre: e.nombre.split(' ')[0], rol: 'almacenero', equipo: 'PC del almacén' } : ROCIO;
    await this.narrar(`En el almacén ya no queda "${f.producto}".`, 2200);
    await this.enMonitor(quien, '/gestion/compras', `${quien.nombre} pide la compra al distribuidor desde Compras.`, async () => {
      await this.monitor.elegir('select[name=producto]', f.producto);
      await this.monitor.escribir('input[name=cantidad]', '20');
      if (e) await this.monitor.elegir('select[name=empleado]', e.nombre);
      await this.monitor.clic('[data-tour="compras"] button[type=submit]');
    }, 'Solicitud enviada.');
    const [pedido] = await firstValueFrom(this.gestion.pedidos());
    if (pedido) await this.tour.enfocar(`[data-pedido="${pedido.id}"]`, 'Nuevo: solicitud al distribuidor');
    await this.narrar('Queda esperando la aprobación de la administración.', 2600);
  }

  private async registrarRobo(): Promise<void> {
    const inventario = await firstValueFrom(this.gestion.inventario());
    const f = inventario.find((x) => x.stock > x.stockMinimo + 2 && x.productoId !== this.producto?.productoId);
    if (!f) return;
    await this.narrar('Suena la alarma de la puerta: alguien salió sin pagar.', 2600);
    await this.enMonitor(ROCIO, '/gestion/mermas', 'Rocío registra lo que se llevaron en Mermas.', async () => {
      await this.monitor.elegir('select[name=producto]', f.producto);
      await this.monitor.escribir('input[name=cantidad]', '1');
      await this.monitor.elegir('select[name=motivo]', 'Robo');
      await this.monitor.escribir('input[name=nota]', 'Salió sin pagar');
      await this.monitor.clic('[data-tour="mermas"] button[type=submit]');
      await this.monitor.clic('app-confirmacion dialog button[type=submit]');
    }, 'Merma registrada.');
    const [merma] = await firstValueFrom(this.gestion.mermas());
    if (merma) await this.tour.enfocar(`[data-merma="${merma.id}"]`, 'Nueva merma: robo');
    const incidencias = await firstValueFrom(this.gestion.incidencias());
    this.incidencia = incidencias[0]?.id ?? null;
    await this.narrar('Se descontó del stock con su costo y se abrió una incidencia de seguridad.', 2800);
  }

  // ── Ayudas ──────────────────────────────────────────────────────────

  /**
   * Le cede el turno a otra persona: aparece su monitor con la app real, el recorrido espera
   * mientras ella usa el módulo y, al terminar, se cierra y volvemos a nuestra pantalla.
   */
  private async enMonitor(u: UsuarioMonitor, ruta: string, intro: string, hacer: () => Promise<void>, cierre: string): Promise<void> {
    await this.narrar(`⏸ ${intro} El recorrido espera mientras lo hace.`);
    await this.monitor.abrir(u, ruta);
    await this.tour.enfocar('.monitor-pantalla', `Pantalla de ${u.nombre}`);
    await pausa(800);
    await hacer();
    await pausa(1500);
    this.monitor.cerrar();
    await pausa(350);
    await this.tour.volverAlPaso();
    await this.narrar(`▶ ${cierre} Volvemos a nuestro recorrido.`, 2400);
  }

  private async historia(frases: string[], ms = 2600): Promise<void> {
    for (const f of frases) await this.narrar(f, ms);
  }

  /** Frase en el panel del recorrido; también queda en el registro técnico. */
  private async narrar(texto: string, ms = 0): Promise<void> {
    this.sandbox.log('historia', texto);
    await this.tour.decir(texto, ms);
  }

  private async notificar(e: Empleado, frase: string): Promise<void> {
    this.telefono.abrir(e);
    await this.narrar(frase, 3400);
  }

  private personal(): Promise<Empleado[]> {
    return firstValueFrom(this.gestion.personal());
  }

  private libre(personal: Empleado[], preferir: (e: Empleado) => boolean): Empleado | undefined {
    return personal.find((e) => e.estado === 'DISPONIBLE' && !this.usados.has(e.id) && preferir(e));
  }

  private async esperarTarea(cumple: (t: Task) => boolean): Promise<number | null> {
    for (let i = 0; i < 10; i++) {
      const t = (await firstValueFrom(this.tareas.getAll(this.gestion.tiendaActiva()))).find(cumple);
      if (t?.id) return t.id;
      await pausa(400);
    }
    return null;
  }
}
