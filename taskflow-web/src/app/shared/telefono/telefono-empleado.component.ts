import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AvisoPersonal, DIAS_SEMANA, Empleado, NOMBRE_ESTADO_PERSONA, NOMBRE_PUESTO, NOMBRE_PUESTO_TIENDA } from '../../models/gestion.model';
import { GestionService } from '../../gestion/gestion.service';
import { IconoComponent } from '../icono/icono.component';

/** Qué persona muestra el teléfono (la app del equipo). Lo abren el recorrido y la pantalla de Personal. */
@Injectable({ providedIn: 'root' })
export class TelefonoService {
  readonly empleado = signal<Empleado | null>(null);

  abrir(e: Empleado): void {
    this.empleado.set(e);
  }

  cerrar(): void {
    this.empleado.set(null);
  }
}

/**
 * Vista de la app del empleado en un teléfono: su perfil y los avisos que le llegan
 * (puesto, órdenes asignadas). Consulta cada 2 s para que se vea llegar cada notificación.
 */
@Component({
  selector: 'app-telefono-empleado',
  standalone: true,
  imports: [DatePipe, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (telefono.empleado(); as e) {
      <aside class="telefono" role="dialog" [attr.aria-label]="'App del equipo de ' + e.nombre">
        <div class="pantalla">
          <p class="barra-estado"><span>{{ ahora() | date: 'HH:mm' }}</span><span>TaskFlow Equipo</span></p>

          @if (nueva(); as n) {
            <div class="push" role="status">
              <span class="push-app"><app-icono nombre="tablero" [tamano]="12" />TaskFlow · ahora</span>
              <p>{{ sinNombre(n.mensaje) }}</p>
            </div>
          }

          <header class="perfil">
            <span class="avatar">{{ iniciales(e.nombre) }}</span>
            <div>
              <p class="nombre">{{ e.nombre }}</p>
              <p class="dato">{{ nombrePuesto[e.puesto] }} · turno {{ e.horario }}</p>
              <p class="dato">
                <span class="punto" [class.ok]="e.estado === 'DISPONIBLE' || e.estado === 'TRABAJANDO'"></span>
                {{ nombreEstado[e.estado] }}{{ e.diaLibre ? ' · libre los ' + dias[e.diaLibre] : '' }}
              </p>
            </div>
          </header>

          <section class="ahora-hago">
            <p class="titulo">Ahora</p>
            <p>{{ ultimoPuesto() ?? (e.puestoActual ? nombrePuestoTienda[e.puestoActual] : 'Sin puesto fijo') }}</p>
          </section>

          <section class="lista">
            <div class="lista-cabecera">
              <p class="titulo">Notificaciones</p>
              @if (cuantasNuevas()) {
                <span class="contador-nuevas">{{ cuantasNuevas() }} {{ cuantasNuevas() === 1 ? 'nueva' : 'nuevas' }}</span>
              }
            </div>
            @for (a of mios(); track a.id) {
              <article class="notificacion" [class.nueva]="nuevas().has(a.id)">
                <app-icono [nombre]="a.mensaje.includes('orden') || a.mensaje.includes('pedido') ? 'tablero' : 'sede'" [tamano]="14" />
                <div>
                  <p>{{ sinNombre(a.mensaje) }}</p>
                  <small>{{ a.creadoEn | date: 'HH:mm' }}@if (nuevas().has(a.id)) {<span class="etiqueta-nueva">Nueva</span>}</small>
                </div>
              </article>
            } @empty {
              <p class="vacio">Sin notificaciones por ahora.</p>
            }
          </section>
        </div>
        <button type="button" class="cerrar" (click)="telefono.cerrar()" aria-label="Cerrar la vista del empleado">
          <app-icono nombre="cerrar" [tamano]="14" />
        </button>
      </aside>
    }
  `,
  styleUrl: './telefono-empleado.component.scss',
})
export class TelefonoEmpleadoComponent {
  readonly telefono = inject(TelefonoService);
  private readonly gestion = inject(GestionService);
  readonly nombrePuesto = NOMBRE_PUESTO;
  readonly nombreEstado = NOMBRE_ESTADO_PERSONA;
  readonly nombrePuestoTienda = NOMBRE_PUESTO_TIENDA;
  readonly dias = DIAS_SEMANA;

  readonly ahora = signal(Date.now());
  private readonly avisos = signal<AvisoPersonal[]>([]);
  readonly mios = computed(() => this.avisos().filter((a) => a.empleadoId === this.telefono.empleado()?.id).slice(0, 6));
  /** Notificación recién llegada: se muestra como banner arriba unos segundos. */
  readonly nueva = signal<AvisoPersonal | null>(null);
  private vistos = new Set<number>();
  /** Las que llegaron con el teléfono abierto (o hace segundos): quedan marcadas como nuevas. */
  readonly nuevas = signal<Set<number>>(new Set());
  readonly cuantasNuevas = computed(() => this.mios().filter((a) => this.nuevas().has(a.id)).length);
  private bannerTimer: ReturnType<typeof setTimeout> | undefined;

  /** El puesto más reciente que le avisaron, para que "Ahora" cambie al llegar la notificación. */
  readonly ultimoPuesto = computed(() => {
    const m = this.mios().find((a) => a.mensaje.includes(': ve a ') || a.mensaje.includes('tienes la orden'));
    if (!m) return null;
    return m.mensaje.includes('tienes la orden') ? 'Haciendo ' + m.mensaje.split(': tienes ')[1]?.replace(/ \(unos.*$/, '') : 'En ' + m.mensaje.split(': ve a ')[1]?.replace(/\.$/, '');
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const id = setInterval(() => {
      this.ahora.set(Date.now());
      if (this.telefono.empleado()) this.consultar();
    }, 2000);
    destroyRef.onDestroy(() => {
      clearInterval(id);
      clearTimeout(this.bannerTimer);
    });
    // Al cambiar de persona, lo que ya tenía no cuenta como nuevo.
    effect(() => {
      const e = this.telefono.empleado();
      untracked(() => {
        this.vistos = new Set();
        this.nuevas.set(new Set());
        this.nueva.set(null);
        if (e) this.consultar(true);
      });
    });
  }

  private consultar(inicial = false): void {
    this.gestion.avisosPersonal().subscribe({
      next: (lista) => {
        this.avisos.set(lista);
        const mios = lista.filter((a) => a.empleadoId === this.telefono.empleado()?.id);
        // Al abrir, el aviso de hace segundos también se muestra como recién llegado.
        const reciente = (a: AvisoPersonal) => Date.now() - new Date(a.creadoEn).getTime() < 15000;
        const llegadas = mios.filter((a) => !this.vistos.has(a.id) && (!inicial || reciente(a)));
        const nuevo = llegadas[0];
        mios.forEach((a) => this.vistos.add(a.id));
        if (llegadas.length) this.nuevas.update((s) => new Set([...s, ...llegadas.map((a) => a.id)]));
        if (nuevo) {
          this.nueva.set(nuevo);
          clearTimeout(this.bannerTimer);
          this.bannerTimer = setTimeout(() => this.nueva.set(null), 7000);
        }
      },
      error: () => {},
    });
  }

  /** El aviso empieza con el nombre de la persona; en su propio teléfono sobra. */
  sinNombre(mensaje: string): string {
    const i = mensaje.indexOf(': ');
    const resto = i > 0 ? mensaje.slice(i + 2) : mensaje;
    return resto.charAt(0).toUpperCase() + resto.slice(1);
  }

  iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }
}
