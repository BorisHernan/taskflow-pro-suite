import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { ArenaSnapshot, WelcomeMessage } from '../models/arena.model';

export interface ArenaConnection {
  welcome$: Subject<WelcomeMessage>;
  snapshots$: Subject<ArenaSnapshot>;
  death$: Subject<void>;
  closed$: Subject<CloseEvent>;
}

@Injectable({ providedIn: 'root' })
export class ArenaService {
  private socket?: WebSocket;

  connect(name: string): ArenaConnection {
    // Cierra cualquier conexión anterior (p. ej. si el jugador murió y no se
    // había desconectado todavía) para no dejar sockets huérfanos abiertos.
    this.disconnect();

    const welcome$ = new Subject<WelcomeMessage>();
    const snapshots$ = new Subject<ArenaSnapshot>();
    const death$ = new Subject<void>();
    const closed$ = new Subject<CloseEvent>();

    const socket = new WebSocket(this.buildWsUrl(name));
    this.socket = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'welcome') {
        welcome$.next(data as WelcomeMessage);
      } else if (data.type === 'death') {
        death$.next();
      } else {
        snapshots$.next(data as ArenaSnapshot);
      }
    };

    socket.onclose = (event) => {
      closed$.next(event);
      closed$.complete();
      snapshots$.complete();
      welcome$.complete();
      death$.complete();
    };

    return { welcome$, snapshots$, death$, closed$ };
  }

  send(tx: number, ty: number): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ tx, ty }));
    }
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  private buildWsUrl(name: string): string {
    const httpBase = environment.apiUrl.replace(/\/api\/tasks\/?$/, '');
    const wsBase = httpBase.replace(/^http/, 'ws');
    return `${wsBase}/ws/arena?name=${encodeURIComponent(name)}`;
  }
}
