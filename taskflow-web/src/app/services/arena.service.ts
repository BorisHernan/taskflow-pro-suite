import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { ArenaSnapshot, WelcomeMessage } from '../models/arena.model';
import { RegistroEventosService } from '../shared/registro-eventos.service';

export interface ArenaConnection {
  welcome$: Subject<WelcomeMessage>;
  snapshots$: Subject<ArenaSnapshot>;
  death$: Subject<void>;
  victory$: Subject<void>;
  closed$: Subject<CloseEvent>;
}

@Injectable({ providedIn: 'root' })
export class ArenaService {
  private socket?: WebSocket;
  private readonly registro = inject(RegistroEventosService);
  // ~10 mensajes por segundo: se cuentan y se anota un resumen por segundo en vez de cada uno.
  private recibidos = 0;
  private enviados = 0;
  private resumen?: ReturnType<typeof setInterval>;

  connect(name: string, skin = 'clasico'): ArenaConnection {
    // Cierra cualquier conexión anterior (p. ej. si el jugador murió y no se
    // había desconectado todavía) para no dejar sockets huérfanos abiertos.
    this.disconnect();

    const welcome$ = new Subject<WelcomeMessage>();
    const snapshots$ = new Subject<ArenaSnapshot>();
    const death$ = new Subject<void>();
    const victory$ = new Subject<void>();
    const closed$ = new Subject<CloseEvent>();

    const socket = new WebSocket(this.buildWsUrl(name, skin));
    this.socket = socket;
    this.anotar('salida', `conexión abierta a /ws/arena como "${name}"`);
    this.resumen = setInterval(() => {
      if (this.recibidos || this.enviados) {
        this.anotar('entrada', `${this.recibidos} estados del juego recibidos y ${this.enviados} movimientos enviados en el último segundo`);
      }
      this.recibidos = 0;
      this.enviados = 0;
    }, 1000);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'welcome') {
        this.anotar('entrada', 'welcome · el servidor te asignó un id de jugador');
        welcome$.next(data as WelcomeMessage);
      } else if (data.type === 'death') {
        this.anotar('entrada', 'death · te comieron');
        death$.next();
      } else if (data.type === 'victory') {
        this.anotar('entrada', 'victory · llegaste al tamaño máximo');
        victory$.next();
      } else {
        this.recibidos++;
        snapshots$.next(data as ArenaSnapshot);
      }
    };

    socket.onclose = (event) => {
      clearInterval(this.resumen);
      this.anotar('entrada', `conexión cerrada (código ${event.code})`);
      closed$.next(event);
      closed$.complete();
      snapshots$.complete();
      welcome$.complete();
      death$.complete();
      victory$.complete();
    };

    return { welcome$, snapshots$, death$, victory$, closed$ };
  }

  send(tx: number, ty: number): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ tx, ty }));
      this.enviados++;
    }
  }

  /** Dividirse (espacio) o expulsar masa (W). */
  accion(accion: 'dividir' | 'expulsar'): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ accion }));
      this.anotar('salida', `acción · ${accion}`);
    }
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  private anotar(direccion: 'entrada' | 'salida', detalle: string): void {
    this.registro.registrar({ demo: 'arena', canal: 'WebSocket', direccion, detalle });
  }

  private buildWsUrl(name: string, skin: string): string {
    const httpBase = environment.apiUrl.replace(/\/api\/tasks\/?$/, '');
    const wsBase = httpBase.replace(/^http/, 'ws');
    return `${wsBase}/ws/arena?name=${encodeURIComponent(name)}&skin=${encodeURIComponent(skin)}`;
  }
}
