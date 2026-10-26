import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SesionService } from '../../auth/sesion.service';

export interface PasoTour {
  /** Ruta donde vive el elemento; el recorrido navega solo si hace falta. */
  ruta: string;
  /** Valor del atributo data-tour del elemento a resaltar (o un selector si empieza con "["). Puede depender de la demo. */
  ancla: string | (() => string | null);
  titulo: string;
  texto: string;
  /** Pantallas que solo ve la administración: se saltan para el encargado de tienda. */
  soloAdmin?: boolean;
  /** Lo que la demo hace en vivo en este paso (una sola vez, aunque se vuelva atrás). */
  accion?: () => Promise<void>;
}

/** Lo que otra persona hace en su propia pantalla (supervisora, clienta, almacenero…), visto desde el recorrido. */
export interface Escena {
  quien: string;
  dispositivo: string;
  pantalla: string;
  campos: { etiqueta: string; valor: string }[];
  boton: string;
  estado: 'llenando' | 'enviando' | 'hecho';
  resultado?: string;
}

/** Puntero animado de la demo: dónde está y si está haciendo clic o arrastrando. */
export interface Cursor {
  x: number;
  y: number;
  modo: 'apunta' | 'clic' | 'arrastra';
}

const CLAVE_VISTO = 'taskflow-tour-visto';

/** Recorrido de la gestión: una parada por cada opción del menú, en el mismo orden. */
export const PASOS_PRUEBA: PasoTour[] = [
  {
    ruta: '/gestion/resumen',
    ancla: 'kpis',
    titulo: 'Resumen del día',
    texto: 'Lo primero al entrar: cuánto se vendió, qué falta y qué está atrasado en la sede.',
  },
  {
    ruta: '/gestion/resumen',
    ancla: 'reponer',
    titulo: 'Alertas que nadie anotó',
    texto: 'Cuando una venta deja un producto en su mínimo, el sistema lo detecta solo y lo pone aquí.',
  },
  {
    ruta: '/gestion/operaciones',
    ancla: 'plano',
    titulo: 'Centro de operaciones: el plano',
    texto: 'La tienda vista desde arriba: cajas, entrada, pasillos, almacén y despacho. Arrastra a cada persona a su puesto.',
  },
  {
    ruta: '/gestion/operaciones',
    ancla: 'equipo',
    titulo: 'El equipo de hoy',
    texto: 'Solo aparece quien vino y está en turno. Quien tiene su día libre, descanso médico o vacaciones no se puede asignar.',
  },
  {
    ruta: '/gestion/operaciones',
    ancla: 'ordenes-op',
    titulo: 'Órdenes y avisos',
    texto: 'Suelta a alguien sobre una orden para asignársela. Cada movimiento le llega como aviso con lo que debe hacer.',
  },
  {
    ruta: '/gestion/tablero',
    ancla: 'tarea-automatica',
    titulo: 'Órdenes de trabajo',
    texto: 'El tablero completo: por hacer, en progreso y hecho. Asigna una orden y su avance corre con el tiempo estimado.',
  },
  {
    ruta: '/gestion/tablero',
    ancla: 'conexion',
    titulo: 'Todo en tiempo real',
    texto: 'Si otra persona vende, asigna o cierra una orden, lo verás aquí al instante, sin recargar.',
  },
  {
    ruta: '/gestion/personal',
    ancla: 'personal',
    titulo: 'Personal',
    texto: 'Quién trabaja ahora, quién está libre, quién está fuera de turno y quién falta. Aquí se registran las ausencias.',
  },
  {
    ruta: '/gestion/pedidos-online',
    ancla: 'pedidos-online',
    titulo: 'Pedidos online',
    texto: 'Las compras de la tienda web. La sede las prepara y avanza cada paso; el cliente lo sigue con su código.',
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
    texto: 'El stock del piso de venta, el mínimo, el objetivo y lo que hay en el almacén para reponer.',
  },
  {
    ruta: '/gestion/compras',
    ancla: 'compras',
    titulo: 'Compras al distribuidor',
    texto: 'Lo que no hay en el almacén se pide aquí. La administración lo aprueba y la tienda lo marca como recibido.',
  },
  {
    ruta: '/gestion/mermas',
    ancla: 'mermas',
    titulo: 'Mermas',
    texto: 'Productos dañados, vencidos o robados: se descuentan del stock con su costo. Un robo abre una incidencia.',
  },
  {
    ruta: '/gestion/incidencias',
    ancla: 'incidencias',
    titulo: 'Incidencias',
    texto: 'Equipos que fallan, seguridad o reclamos. Las graves crean una orden de trabajo para atenderlas.',
  },
  {
    ruta: '/gestion/estadisticas',
    ancla: 'estadisticas',
    titulo: 'Estadísticas',
    texto: 'Solo para la administración: ventas por día y comparación entre las tres sedes.',
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

/** Recorrido del cliente: cómo se compra y qué provoca esa compra. */
export const PASOS_CLIENTE: PasoTour[] = [
  {
    ruta: '/tienda',
    ancla: 'sede',
    titulo: 'Elige tu tienda',
    texto: 'Compras con retiro en tienda: el stock que ves y el que se descuenta son los de la sede elegida.',
  },
  {
    ruta: '/tienda',
    ancla: 'producto',
    titulo: 'Stock real, en vivo',
    texto: 'Cada producto avisa cuando quedan pocas unidades en esa sede. Si otra persona compra, el stock baja al instante.',
  },
  {
    ruta: '/tienda',
    ancla: 'categorias',
    titulo: 'Encuentra lo que buscas',
    texto: 'Explora por departamento y subcategoría, filtra por precio o marca, busca por nombre u ordena por precio o valoración.',
  },
  {
    ruta: '/tienda',
    ancla: 'cupon',
    titulo: 'Cupones de descuento',
    texto: 'Con BIENVENIDO10 tienes 10 % en tu primera compra. Se aplica en el carrito.',
  },
  {
    ruta: '/tienda',
    ancla: 'carrito',
    titulo: 'Paga y sigue tu pedido',
    texto: 'Al pagar, el stock baja en un solo paso y la sede recibe la tarea de prepararlo. Con el código de tu boleta ves cada estado hasta la entrega.',
  },
];

/** Estado del recorrido guiado: qué paso se muestra y qué elemento se resalta. */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionService);

  readonly pasos = signal<PasoTour[]>(PASOS_PRUEBA);
  readonly indice = signal(-1);
  readonly activo = computed(() => this.indice() >= 0);
  readonly paso = computed(() => this.pasos()[this.indice()] ?? null);
  /** Elemento resaltado (null mientras se navega o se espera que aparezca). */
  readonly elemento = signal<HTMLElement | null>(null);
  readonly bienvenida = signal(false);
  readonly cursor = signal<Cursor | null>(null);
  /** Frase de la demo en vivo; queda escrita al terminar la acción hasta que se cambie de paso. */
  readonly haciendo = signal<string | null>(null);
  /** Mientras la demo actúa no se puede avanzar; al terminar, el usuario decide cuándo seguir. */
  readonly ocupado = signal(false);
  readonly escena = signal<Escena | null>(null);
  /** La demo en vivo registra aquí sus pasos y cómo deshacer lo que movió. */
  proveedor: (() => PasoTour[]) | null = null;
  alTerminar: (() => void) | null = null;
  /** Antes del primer paso (la demo arma su sede de prueba) y en cada cambio de paso. */
  antesDeEmpezar: (() => Promise<void>) | null = null;
  alCambiarPaso: (() => void) | null = null;
  /** Texto de la etiqueta del foco ("Nuevo: …"); null = la de siempre. */
  readonly etiqueta = signal<string | null>(null);
  readonly preparando = signal(false);
  private ejecutados = new Set<number>();
  /** Elegido en el login: el recorrido arranca apenas se entra a la gestión. */
  private pendiente = false;

  /** Desde el login: "Entrar con recorrido" (true) o "Entrar sin guía" (false). */
  programar(conRecorrido: boolean): void {
    this.pendiente = conRecorrido;
    this.marcarVisto();
  }

  /** Al entrar a la gestión: arranca si se pidió en el login; si no, se recomienda una sola vez. */
  ofrecerSiCorresponde(): void {
    if (this.pendiente) {
      this.pendiente = false;
      this.iniciar();
    } else if (!this.yaVisto() && !this.activo()) {
      this.bienvenida.set(true);
    }
  }

  /** Sin pasos, usa el recorrido de la gestión. El del cliente no cuenta como "visto" para la gestión. */
  iniciar(pasos?: PasoTour[]): void {
    this.bienvenida.set(false);
    if (!pasos) this.marcarVisto();
    const elegidos = pasos ?? this.proveedor?.() ?? PASOS_PRUEBA;
    this.ejecutados = new Set();
    this.pasos.set(elegidos.filter((p) => !p.soloAdmin || this.sesion.esAdmin()));
    if (!pasos && this.antesDeEmpezar) {
      this.preparando.set(true);
      this.antesDeEmpezar()
        .catch(() => {})
        .finally(() => {
          this.preparando.set(false);
          this.ir(0);
        });
    } else {
      this.ir(0);
    }
  }

  explorarSolo(): void {
    this.bienvenida.set(false);
    this.marcarVisto();
  }

  siguiente(): void {
    if (this.ocupado()) return;
    if (this.indice() < this.pasos().length - 1) this.ir(this.indice() + 1);
    else this.salir();
  }

  atras(): void {
    if (this.indice() > 0) this.ir(this.indice() - 1);
  }

  salir(): void {
    const habiaEmpezado = this.indice() >= 0;
    this.indice.set(-1);
    this.elemento.set(null);
    this.cursor.set(null);
    this.haciendo.set(null);
    this.escena.set(null);
    this.ocupado.set(false);
    if (habiaEmpezado) this.alTerminar?.();
  }

  // ── Herramientas de la demo en vivo ─────────────────────────────────

  /** Lleva el puntero al centro de un elemento (y lo trae a la vista). */
  async apuntar(selector: string, modo: Cursor['modo'] = 'apunta'): Promise<HTMLElement | null> {
    const el = await esperarElemento(selector, 4000);
    if (!el || !this.activo()) return null;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    await pausa(250);
    const r = el.getBoundingClientRect();
    this.cursor.set({ x: r.left + r.width / 2, y: r.top + r.height / 2, modo });
    await pausa(650);
    return el;
  }

  async clic(selector: string): Promise<void> {
    if (!(await this.apuntar(selector))) return;
    const c = this.cursor();
    if (c) this.cursor.set({ ...c, modo: 'clic' });
    await pausa(350);
    if (c) this.cursor.set({ ...c, modo: 'apunta' });
  }

  /** Simula arrastrar de un elemento a otro (la acción real la hace quien llama). */
  async arrastrar(desde: string, hasta: string): Promise<void> {
    if (!(await this.apuntar(desde))) return;
    const c = this.cursor()!;
    this.cursor.set({ ...c, modo: 'arrastra' });
    await pausa(250);
    await this.apuntar(hasta, 'arrastra');
    await pausa(200);
  }

  /** Devuelve el foco a la zona del paso actual (por ejemplo, al cerrar el monitor de otro usuario). */
  async volverAlPaso(): Promise<void> {
    const paso = this.paso();
    const ancla = paso && (typeof paso.ancla === 'function' ? paso.ancla() : paso.ancla);
    if (ancla) await this.enfocar(ancla.startsWith('[') || ancla.startsWith('.') ? ancla : `[data-tour="${ancla}"]`, 'Mira aquí');
  }

  /** Mueve el foco a un elemento (lo nuevo que agregó la demo) y lo rotula. */
  async enfocar(selector: string, etiqueta: string): Promise<void> {
    const el = await esperarElemento(selector, 5000);
    if (!el || !this.activo()) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pausa(300);
    this.elemento.set(el);
    this.etiqueta.set(etiqueta);
    await pausa(600);
  }

  async decir(texto: string, ms = 0): Promise<void> {
    this.haciendo.set(texto);
    if (ms) await pausa(ms);
  }

  private async ir(i: number): Promise<void> {
    const paso = this.pasos()[i];
    this.indice.set(i);
    this.etiqueta.set(null);
    this.haciendo.set(null);
    this.escena.set(null);
    this.alCambiarPaso?.();
    if (!this.router.url.startsWith(paso.ruta)) {
      this.elemento.set(null);
      await this.router.navigateByUrl(paso.ruta);
    }
    const ancla = typeof paso.ancla === 'function' ? paso.ancla() : paso.ancla;
    const el = ancla ? await esperarElemento(ancla.startsWith('[') ? ancla : `[data-tour="${ancla}"]`) : null;
    // Si mientras tanto el usuario avanzó o salió, este resultado ya no corresponde.
    if (this.indice() !== i) return;
    // Sin el elemento (o fuera de pantalla, como el menú cerrado en celular), se pasa al siguiente.
    if (!el || el.getBoundingClientRect().right <= 0) {
      if (i < this.pasos().length - 1) this.ir(i + 1);
      else this.salir();
      return;
    }
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reducido ? 'auto' : 'smooth' });
    this.elemento.set(el);

    if (paso.accion && !this.ejecutados.has(i)) {
      this.ejecutados.add(i);
      this.ocupado.set(true);
      try {
        await paso.accion();
      } catch {
        // Si algo de la demo falla, el recorrido sigue igual.
      } finally {
        if (this.indice() === i) {
          this.ocupado.set(false);
          this.cursor.set(null);
        }
      }
    }
  }

  private yaVisto(): boolean {
    try {
      return localStorage.getItem(CLAVE_VISTO) === '1';
    } catch {
      return true;
    }
  }

  private marcarVisto(): void {
    try {
      localStorage.setItem(CLAVE_VISTO, '1');
    } catch {}
  }
}

/** Espera a que el elemento exista y tenga tamaño (los datos llegan del servidor). */
function esperarElemento(selector: string, maxMs = 6000): Promise<HTMLElement | null> {
  const inicio = performance.now();
  return new Promise((resolver) => {
    const mirar = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && el.getBoundingClientRect().height > 0) return resolver(el);
      if (performance.now() - inicio > maxMs) return resolver(null);
      requestAnimationFrame(mirar);
    };
    mirar();
  });
}

function pausa(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
