import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { ArenaSnapshot, WelcomeMessage } from '../models/arena.model';

export interface ArenaConnection {
  welcome$: Subject<WelcomeMessage>;
  snapshots$: Subject<ArenaSnapshot>;
  closed$: Subject<CloseEvent>;
}

@Injectable({ providedIn: 'root' })
export class ArenaService {
  private socket?: WebSocket;

  connect(name: string): ArenaConnection {
    const welcome$ = new Subject<WelcomeMessage>();
    const snapshots$ = new Subject<ArenaSnapshot>();
    const closed$ = new Subject<CloseEvent>();

    const socket = new WebSocket(this.buildWsUrl(name));
    this.socket = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'welcome') {
        welcome$.next(data as WelcomeMessage);
      } else {
        snapshots$.next(data as ArenaSnapshot);
      }
    };

    socket.onclose = (event) => {
      closed$.next(event);
      closed$.complete();
      snapshots$.complete();
      welcome$.complete();
    };

    return { welcome$, snapshots$, closed$ };
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
