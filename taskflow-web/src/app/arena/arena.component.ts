import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ArenaSnapshot, BlobView } from '../models/arena.model';
import { ArenaService } from '../services/arena.service';

type GameState = 'name' | 'playing' | 'dead' | 'won';

const START_RADIUS = 20;
const LOOKAHEAD = 400;
const BASE_ZOOM = 1.1;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.1;
const EAT_JUMP_THRESHOLD = 1.05;

@Component({
  selector: 'app-arena',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './arena.component.html',
  styleUrl: './arena.component.scss',
})
export class ArenaComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  gameState = signal<GameState>('name');
  nameInput = '';
  errorMessage = signal<string | null>(null);
  myRadius = signal(START_RADIUS);
  maxRadiusThisSession = signal(START_RADIUS);
  leaderboard = signal<BlobView[]>([]);
  toast = signal<string | null>(null);
  deathInfo = signal<{ size: number; isRecord: boolean } | null>(null);

  private myId: string | null = null;
  private latestSnapshot: ArenaSnapshot | null = null;
  private welcomeSub?: Subscription;
  private snapshotSub?: Subscription;
  private deathSub?: Subscription;
  private victorySub?: Subscription;
  private closedSub?: Subscription;
  private sendIntervalId?: ReturnType<typeof setInterval>;
  private renderFrameId?: number;
  private toastTimeoutId?: ReturnType<typeof setTimeout>;
  private mouseXRatio = 0;
  private mouseYRatio = 0;
  private previousRadius = START_RADIUS;
  private eatCount = 0;
  private canvasReady = false;

  constructor(private arenaService: ArenaService) {}

  ngAfterViewInit(): void {
    this.canvasReady = true;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  play(): void {
    const name = this.nameInput.trim();
    if (!name) return;

    // Cancela las suscripciones de una partida anterior (si las hay) antes de
    // abrir una nueva conexión: si no, el cierre del socket viejo podía
    // disparar un "se perdió la conexión" falso sobre la partida nueva.
    this.cleanup();

    this.errorMessage.set(null);
    this.deathInfo.set(null);
    this.myId = null;
    this.previousRadius = START_RADIUS;
    this.eatCount = 0;
    this.myRadius.set(START_RADIUS);

    const { welcome$, snapshots$, death$, victory$, closed$ } = this.arenaService.connect(name);

    this.gameState.set('playing');

    this.welcomeSub = welcome$.subscribe((msg) => (this.myId = msg.id));
    this.snapshotSub = snapshots$.subscribe((snapshot) => this.onSnapshot(snapshot));
    this.deathSub = death$.subscribe(() => this.onDeath());
    this.victorySub = victory$.subscribe(() => this.onVictory());
    this.closedSub = closed$.subscribe((event) => this.onClosed(event));

    this.sendIntervalId = setInterval(() => this.sendTarget(), 100);

    setTimeout(() => {
      if (this.canvasReady) {
        this.startRenderLoop();
      }
    }, 0);
  }

  playAgain(): void {
    this.play();
  }

  backToNameScreen(): void {
    this.gameState.set('name');
  }

  onPointerMove(event: MouseEvent): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.mouseXRatio = (event.clientX - rect.left) / rect.width - 0.5;
    this.mouseYRatio = (event.clientY - rect.top) / rect.height - 0.5;
  }

  private sendTarget(): void {
    const me = this.findMe();
    if (!me) return;
    const tx = me.x + this.mouseXRatio * LOOKAHEAD * 2;
    const ty = me.y + this.mouseYRatio * LOOKAHEAD * 2;
    this.arenaService.send(tx, ty);
  }

  private onSnapshot(snapshot: ArenaSnapshot): void {
    this.latestSnapshot = snapshot;

    const me = this.findMe();
    if (me) {
      if (me.radius > this.previousRadius * EAT_JUMP_THRESHOLD) {
        this.eatCount++;
        if (this.eatCount === 1) {
          this.showToast('¡Te comiste algo! 🎉');
        }
      }
      this.previousRadius = me.radius;
      this.myRadius.set(Math.round(me.radius));

      if (me.radius > this.maxRadiusThisSession()) {
        this.maxRadiusThisSession.set(Math.round(me.radius));
      }
      if (me.radius >= START_RADIUS * 2 && this.maxRadiusThisSession() < START_RADIUS * 2 + 1) {
        this.showToast('¡Duplicaste tu tamaño! 🎉');
      }
    }

    this.leaderboard.set(
      [...snapshot.blobs].sort((a, b) => b.radius - a.radius).slice(0, 5)
    );
  }

  private onDeath(): void {
    clearInterval(this.sendIntervalId);
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
    }
    const size = this.myRadius();
    this.deathInfo.set({ size, isRecord: size >= this.maxRadiusThisSession() });
    this.gameState.set('dead');

    // El servidor no cierra el socket por su cuenta al morir (para evitar la
    // carrera que causaba el bug de pantalla congelada); lo cerramos nosotros.
    this.arenaService.disconnect();
  }

  private onVictory(): void {
    clearInterval(this.sendIntervalId);
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
    }
    this.gameState.set('won');
    this.arenaService.disconnect();
  }

  private onClosed(event: CloseEvent): void {
    clearInterval(this.sendIntervalId);
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
    }

    // Si ya estamos en pantalla de muerte/victoria, este cierre es solo la
    // consecuencia normal de haber recibido ese mensaje; no es un error.
    if (this.gameState() === 'playing') {
      this.errorMessage.set(event.reason || 'Se perdió la conexión con el arena.');
      this.gameState.set('name');
    }
  }

  private findMe(): BlobView | undefined {
    if (!this.myId || !this.latestSnapshot) return undefined;
    return this.latestSnapshot.blobs.find((b) => b.id === this.myId);
  }

  private startRenderLoop(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      this.renderFrameId = requestAnimationFrame(draw);
      this.renderFrame(canvas, ctx);
    };
    draw();
  }

  private renderFrame(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    const snapshot = this.latestSnapshot;
    if (!snapshot) return;

    const me = this.findMe();
    const camX = me?.x ?? snapshot.worldSize / 2;
    const camY = me?.y ?? snapshot.worldSize / 2;
    const zoom = me
      ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, BASE_ZOOM * Math.pow(START_RADIUS / me.radius, 0.4)))
      : 1;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    this.drawGrid(ctx, snapshot.worldSize);

    for (const pellet of snapshot.pellets) {
      ctx.beginPath();
      if (pellet.big) {
        ctx.fillStyle = '#ffab00cc';
        ctx.arc(pellet.x, pellet.y, 10, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = '#4c9aff88';
        ctx.arc(pellet.x, pellet.y, 4, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    const sorted = [...snapshot.blobs].sort((a, b) => a.radius - b.radius);
    for (const blob of sorted) {
      this.drawBlob(ctx, blob, blob.id === this.myId);
    }

    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, worldSize: number): void {
    ctx.strokeStyle = '#ffffff0f';
    ctx.lineWidth = 1;
    const step = 100;
    for (let x = 0; x <= worldSize; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, worldSize);
      ctx.stroke();
    }
    for (let y = 0; y <= worldSize; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(worldSize, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ffffff30';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, worldSize, worldSize);
  }

  private drawBlob(ctx: CanvasRenderingContext2D, blob: BlobView, isMe: boolean): void {
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
    ctx.fillStyle = blob.color;
    ctx.fill();

    if (blob.bot) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#ffffffaa';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (isMe) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const label = (blob.bot ? '🤖 ' : '') + blob.name;
    ctx.font = `${Math.max(11, Math.min(16, blob.radius / 2))}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, blob.x, blob.y);
  }

  private showToast(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimeoutId);
    this.toastTimeoutId = setTimeout(() => this.toast.set(null), 3500);
  }

  private cleanup(): void {
    this.welcomeSub?.unsubscribe();
    this.snapshotSub?.unsubscribe();
    this.deathSub?.unsubscribe();
    this.victorySub?.unsubscribe();
    this.closedSub?.unsubscribe();
    clearInterval(this.sendIntervalId);
    clearTimeout(this.toastTimeoutId);
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
    }
    this.arenaService.disconnect();
  }
}
