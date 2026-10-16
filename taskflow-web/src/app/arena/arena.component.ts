import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import { DecimalPipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ArenaEvent, ArenaSnapshot, BlobView, Pellet } from '../models/arena.model';
import { ArenaService } from '../services/arena.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { SKINS, Skin, dibujarSkin, semilla } from './dibujo/skins';
import { MuestraSkinComponent } from './dibujo/muestra-skin.component';

type GameState = 'name' | 'playing' | 'dead' | 'won';

const START_RADIUS = 20;
const LOOKAHEAD = 400;
const BASE_ZOOM = 1.1;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.1;
const TICK_MS = 100;
const DURACION_EFECTO_MS = 8000;
const ALCANCE_IMAN = 140;
const CLAVE_JUGADOR = 'taskflow-arena';
// Se dibuja un poco "en el pasado": así siempre hay dos estados entre los cuales interpolar,
// aunque un paquete llegue tarde (la red de un servidor gratuito no es pareja).
const RETRASO_DIBUJO_MS = 120;

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  color: string;
  r: number;
}

interface Aviso {
  id: number;
  texto: string;
  mio: boolean;
}

interface Dibujable extends BlobView {
  angulo: number;
}

const POWERUPS: Record<string, { color: string; simbolo: string; nombre: string }> = {
  velocidad: { color: '#facc15', simbolo: '⚡', nombre: 'Velocidad' },
  escudo: { color: '#22d3ee', simbolo: '🛡', nombre: 'Escudo' },
  iman: { color: '#e879f9', simbolo: '🧲', nombre: 'Imán' },
};

@Component({
  selector: 'app-arena',
  standalone: true,
  imports: [DecimalPipe, KeyValuePipe, FormsModule, IconoComponent, MuestraSkinComponent],
  templateUrl: './arena.component.html',
  styleUrl: './arena.component.scss',
})
export class ArenaComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('preview') previewRef?: ElementRef<HTMLCanvasElement>;

  readonly skins = SKINS;
  readonly powerups = POWERUPS;

  gameState = signal<GameState>('name');
  nameInput = '';
  skin = signal('clasico');
  /** Mejor tamaño alcanzado en este navegador: desbloquea skins. */
  record = signal(0);
  /** Skin recién desbloqueada (notificación en pantalla). */
  logro = signal<Skin | null>(null);
  desbloqueadasEnPartida = signal<Skin[]>([]);
  errorMessage = signal<string | null>(null);
  myRadius = signal(START_RADIUS);
  celulas = signal(1);
  maxRadiusThisSession = signal(START_RADIUS);
  leaderboard = signal<{ ownerId: string; name: string; bot: boolean; tamano: number }[]>([]);
  toast = signal<string | null>(null);
  avisos = signal<Aviso[]>([]);
  deathInfo = signal<{ size: number; isRecord: boolean } | null>(null);
  miId = signal<string | null>(null);
  miPuesto = signal<{ puesto: number; total: number } | null>(null);
  /** Efecto activo → momento en que termina (ms). */
  efectos = signal<Record<string, number>>({});
  ahora = signal(Date.now());

  readonly efectosActivos = computed(() =>
    Object.entries(this.efectos())
      .filter(([, fin]) => fin > this.ahora())
      .map(([clave, fin]) => ({ clave, ...POWERUPS[clave], restante: (fin - this.ahora()) / DURACION_EFECTO_MS })),
  );

  private actual: ArenaSnapshot | null = null;
  /** Últimos estados recibidos, con el momento en que corresponde dibujarlos. */
  private bufer: { t: number; porId: Map<string, BlobView>; snap: ArenaSnapshot }[] = [];
  private subs: Subscription[] = [];
  private sendIntervalId?: ReturnType<typeof setInterval>;
  private renderFrameId?: number;
  private previewFrameId?: number;
  private toastTimeoutId?: ReturnType<typeof setTimeout>;
  private mouseXRatio = 0;
  private mouseYRatio = 0;
  private canvasReady = false;
  private miNombre = '';
  private particulas: Particula[] = [];
  private estelas = new Map<string, { x: number; y: number }[]>();
  private ultimaEstela = 0;
  private cam = { x: 0, y: 0, zoom: 1, lista: false };
  private avisoId = 0;
  private logroTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(private arenaService: ArenaService) {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_JUGADOR) ?? '{}');
      this.nameInput = typeof guardado.nombre === 'string' ? guardado.nombre : '';
      this.record.set(Number(guardado.record) || 0);
      if (SKINS.some((s) => s.clave === guardado.skin && this.desbloqueada(s))) this.skin.set(guardado.skin);
    } catch {
      // Sin almacenamiento: se empieza en blanco.
    }
  }

  desbloqueada(s: Skin): boolean {
    return !s.desbloqueo || this.record() >= s.desbloqueo;
  }

  /** La próxima skin por desbloquear, para mostrar la meta en el inicio. */
  readonly proximaSkin = computed(() => SKINS.find((s) => s.desbloqueo && this.record() < s.desbloqueo));
  readonly totalDesbloqueadas = computed(() => SKINS.filter((s) => this.desbloqueada(s)).length);

  private guardarJugador(): void {
    try {
      localStorage.setItem(CLAVE_JUGADOR, JSON.stringify({ nombre: this.nameInput.trim(), skin: this.skin(), record: this.record() }));
    } catch {
      // Solo es comodidad: si falla, se sigue jugando.
    }
  }

  /** Al superar el récord se revisa si se cruzó la meta de alguna skin. */
  private actualizarRecord(tamano: number): void {
    const anterior = this.record();
    if (tamano <= anterior) return;
    this.record.set(tamano);
    const nuevas = SKINS.filter((s) => s.desbloqueo && s.desbloqueo > anterior && s.desbloqueo <= tamano);
    if (!nuevas.length) return;
    this.guardarJugador();
    this.desbloqueadasEnPartida.update((lista) => [...lista, ...nuevas]);
    const ultima = nuevas[nuevas.length - 1];
    this.logro.set(ultima);
    clearTimeout(this.logroTimeoutId);
    this.logroTimeoutId = setTimeout(() => this.logro.set(null), 4000);
    const c = this.centro(this.misCelulas());
    if (c) {
      for (const color of ['#facc15', '#f472b6', '#22d3ee', '#a78bfa']) this.explosion(c.x, c.y, color, 14, 1.6);
    }
  }

  ngAfterViewInit(): void {
    this.canvasReady = true;
    this.animarVistaPrevia();
  }

  ngOnDestroy(): void {
    this.cleanup();
    if (this.previewFrameId) cancelAnimationFrame(this.previewFrameId);
  }

  elegirSkin(s: Skin): void {
    if (this.desbloqueada(s)) this.skin.set(s.clave);
  }

  play(): void {
    const name = this.nameInput.trim();
    if (!name) return;

    this.cleanup();
    if (this.previewFrameId) cancelAnimationFrame(this.previewFrameId);
    this.guardarJugador();

    this.miNombre = name;
    this.errorMessage.set(null);
    this.deathInfo.set(null);
    this.miId.set(null);
    this.miPuesto.set(null);
    this.efectos.set({});
    this.avisos.set([]);
    this.desbloqueadasEnPartida.set([]);
    this.logro.set(null);
    this.particulas = [];
    this.estelas.clear();
    this.actual = null;
    this.bufer = [];
    this.cam.lista = false;
    this.myRadius.set(START_RADIUS);
    this.maxRadiusThisSession.set(START_RADIUS);

    const { welcome$, snapshots$, death$, victory$, closed$ } = this.arenaService.connect(name, this.skin());
    this.gameState.set('playing');

    this.subs = [
      welcome$.subscribe((msg) => this.miId.set(msg.id)),
      snapshots$.subscribe((snapshot) => this.onSnapshot(snapshot)),
      death$.subscribe(() => this.onDeath()),
      victory$.subscribe(() => this.onVictory()),
      closed$.subscribe((event) => this.onClosed(event)),
    ];

    this.sendIntervalId = setInterval(() => this.sendTarget(), TICK_MS);
    setTimeout(() => {
      if (this.canvasReady) this.startRenderLoop();
    }, 0);
  }

  playAgain(): void {
    this.play();
  }

  backToNameScreen(): void {
    this.gameState.set('name');
    setTimeout(() => this.animarVistaPrevia(), 0);
  }

  // pointermove cubre mouse, dedo y lápiz: en el celular el blob sigue al dedo.
  onPointerMove(event: PointerEvent): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.mouseXRatio = (event.clientX - rect.left) / rect.width - 0.5;
    this.mouseYRatio = (event.clientY - rect.top) / rect.height - 0.5;
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.gameState() !== 'playing' || event.repeat) return;
    if (event.code === 'Space') {
      event.preventDefault();
      this.accion('dividir');
    } else if (event.key.toLowerCase() === 'w') {
      this.accion('expulsar');
    }
  }

  accion(tipo: 'dividir' | 'expulsar'): void {
    this.sendTarget();
    this.arenaService.accion(tipo);
  }

  // ── Datos ─────────────────────────────────────────────────────────

  private misCelulas(snapshot: ArenaSnapshot | null = this.actual): BlobView[] {
    const id = this.miId();
    return id && snapshot ? snapshot.blobs.filter((b) => b.ownerId === id) : [];
  }

  /** Centro de masa de mis células. */
  private centro(celulas: { x: number; y: number; radius: number }[]): { x: number; y: number } | null {
    const masa = celulas.reduce((s, c) => s + c.radius * c.radius, 0);
    if (!masa) return null;
    return {
      x: celulas.reduce((s, c) => s + c.x * c.radius * c.radius, 0) / masa,
      y: celulas.reduce((s, c) => s + c.y * c.radius * c.radius, 0) / masa,
    };
  }

  private sendTarget(): void {
    const c = this.centro(this.misCelulas());
    if (!c) return;
    this.arenaService.send(c.x + this.mouseXRatio * LOOKAHEAD * 2, c.y + this.mouseYRatio * LOOKAHEAD * 2);
  }

  private onSnapshot(snapshot: ArenaSnapshot): void {
    this.detectarComidaPropia(snapshot);
    this.actual = snapshot;
    // Si llegan varios juntos tras una pausa, se reparten en el tiempo en vez de saltar.
    const ahora = performance.now();
    const ultimo = this.bufer.at(-1);
    const t = ultimo ? Math.min(Math.max(ahora, ultimo.t + TICK_MS * 0.6), ahora + 200) : ahora;
    this.bufer.push({ t, snap: snapshot, porId: new Map(snapshot.blobs.map((b) => [b.id, b])) });
    if (this.bufer.length > 12) this.bufer.shift();
    this.ahora.set(Date.now());

    const mias = this.misCelulas(snapshot);
    if (mias.length) {
      const tamano = Math.round(Math.sqrt(mias.reduce((s, c) => s + c.radius * c.radius, 0)));
      this.myRadius.set(tamano);
      this.celulas.set(mias.length);
      if (tamano > this.maxRadiusThisSession()) this.maxRadiusThisSession.set(tamano);
      this.actualizarRecord(tamano);
      this.sincronizarEfectos(mias);
    }

    for (const e of snapshot.eventos ?? []) this.onEvento(e);

    // Ranking por jugador (suma de todas sus células).
    const porDueno = new Map<string, { ownerId: string; name: string; bot: boolean; masa: number }>();
    for (const b of snapshot.blobs) {
      const actual = porDueno.get(b.ownerId) ?? { ownerId: b.ownerId, name: b.name, bot: b.bot, masa: 0 };
      actual.masa += b.radius * b.radius;
      porDueno.set(b.ownerId, actual);
    }
    const ranking = [...porDueno.values()]
      .map((j) => ({ ownerId: j.ownerId, name: j.name, bot: j.bot, tamano: Math.sqrt(j.masa) }))
      .sort((a, b) => b.tamano - a.tamano);
    this.leaderboard.set(ranking.slice(0, 5));
    const puesto = ranking.findIndex((j) => j.ownerId === this.miId()) + 1;
    this.miPuesto.set(puesto > 0 ? { puesto, total: ranking.length } : null);
  }

  /** El servidor dice qué efectos están activos; aquí se recuerda cuándo empezó cada uno para la barra. */
  private sincronizarEfectos(mias: BlobView[]): void {
    const ahora = Date.now();
    const actuales = { ...this.efectos() };
    for (const clave of ['velocidad', 'escudo', 'iman'] as const) {
      const activo = mias.some((c) => c[clave]);
      if (activo && !(actuales[clave] > ahora)) actuales[clave] = ahora + DURACION_EFECTO_MS;
      if (!activo) delete actuales[clave];
    }
    this.efectos.set(actuales);
  }

  private onEvento(e: ArenaEvent): void {
    const mio = e.quien === this.miNombre;
    if (e.tipo === 'comio') {
      this.explosion(e.x, e.y, e.color, 26);
      this.agregarAviso(`${e.quien} se comió a ${e.aQuien}`, mio || e.aQuien === this.miNombre);
      if (mio) this.showToast(`¡Te comiste a ${e.aQuien}!`);
    } else if (e.tipo === 'powerup') {
      const p = POWERUPS[e.aQuien];
      this.explosion(e.x, e.y, p?.color ?? '#ffffff', 16);
      if (mio && p) this.showToast(`${p.simbolo} ${p.nombre} por 8 segundos`);
    }
  }

  /** Chispitas de color cuando una de mis células se come comida. */
  private detectarComidaPropia(siguiente: ArenaSnapshot): void {
    if (!this.actual) return;
    const mias = this.misCelulas(siguiente);
    if (!mias.length) return;
    const siguen = new Set(siguiente.pellets.map((p) => p.id));
    for (const p of this.actual.pellets) {
      if (siguen.has(p.id) || p.tipo === 'velocidad' || p.tipo === 'escudo' || p.tipo === 'iman') continue;
      const cerca = mias.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < c.radius + ALCANCE_IMAN + 40);
      if (cerca) this.explosion(p.x, p.y, colorPellet(p), p.tipo === 'normal' ? 4 : 10, 0.6);
    }
  }

  private agregarAviso(texto: string, mio: boolean): void {
    const id = ++this.avisoId;
    this.avisos.update((lista) => [{ id, texto, mio }, ...lista].slice(0, 4));
    setTimeout(() => this.avisos.update((lista) => lista.filter((a) => a.id !== id)), 4500);
  }

  private explosion(x: number, y: number, color: string, cantidad: number, fuerza = 1): void {
    for (let i = 0; i < cantidad; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (60 + Math.random() * 220) * fuerza;
      this.particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1, color, r: 2 + Math.random() * 4 * fuerza });
    }
    if (this.particulas.length > 400) this.particulas.splice(0, this.particulas.length - 400);
  }

  private onDeath(): void {
    this.detenerJuego();
    this.guardarJugador();
    const size = this.myRadius();
    this.deathInfo.set({ size, isRecord: size >= this.maxRadiusThisSession() });
    this.gameState.set('dead');
    // El servidor no cierra el socket al morir; lo cerramos nosotros.
    this.arenaService.disconnect();
  }

  private onVictory(): void {
    this.detenerJuego();
    this.guardarJugador();
    this.gameState.set('won');
    this.arenaService.disconnect();
  }

  private onClosed(event: CloseEvent): void {
    this.detenerJuego();
    // Tras muerte o victoria el cierre es lo esperado, no un error.
    if (this.gameState() === 'playing') {
      this.errorMessage.set(event.reason || 'Se perdió la conexión con el arena.');
      this.gameState.set('name');
      setTimeout(() => this.animarVistaPrevia(), 0);
    }
  }

  private detenerJuego(): void {
    clearInterval(this.sendIntervalId);
    if (this.renderFrameId) cancelAnimationFrame(this.renderFrameId);
  }

  // ── Dibujo ────────────────────────────────────────────────────────

  private startRenderLoop(): void {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let ultimo = performance.now();
    const draw = (ahora: number) => {
      this.renderFrameId = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (ahora - ultimo) / 1000);
      ultimo = ahora;
      this.renderFrame(canvas, ctx, ahora, dt);
    };
    this.renderFrameId = requestAnimationFrame(draw);
  }

  /** Posiciones entre los dos estados que rodean el momento a dibujar: 60 fps fluidos con 10 por segundo. */
  private interpolar(ahora: number): Dibujable[] {
    const n = this.bufer.length;
    if (!n) return [];
    const objetivo = ahora - RETRASO_DIBUJO_MS;
    let i = n - 1;
    while (i > 0 && this.bufer[i - 1].t > objetivo) i--;
    const destino = this.bufer[i];
    const origen = this.bufer[Math.max(0, i - 1)];
    const t = origen === destino ? 1 : Math.min(1, Math.max(0, (objetivo - origen.t) / (destino.t - origen.t)));
    return destino.snap.blobs.map((b) => {
      const a = origen.porId.get(b.id);
      if (!a) return { ...b, angulo: 0 };
      return {
        ...b,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        radius: a.radius + (b.radius - a.radius) * t,
        angulo: Math.hypot(b.x - a.x, b.y - a.y) > 0.5 ? Math.atan2(b.y - a.y, b.x - a.x) : 0,
      };
    });
  }

  private renderFrame(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, ahora: number, dt: number): void {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const fondo = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.75);
    fondo.addColorStop(0, '#111a33');
    fondo.addColorStop(1, '#070b16');
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, width, height);

    const snapshot = this.actual;
    if (!snapshot) return;
    const t = ahora / 1000;
    const blobs = this.interpolar(ahora);
    const id = this.miId();
    const mias = blobs.filter((b) => b.ownerId === id);

    this.moverCamara(mias, snapshot.worldSize, width, height);
    const { x: camX, y: camY, zoom } = this.cam;
    const vista = {
      x0: camX - width / 2 / zoom,
      y0: camY - height / 2 / zoom,
      x1: camX + width / 2 / zoom,
      y1: camY + height / 2 / zoom,
    };

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    this.drawGrid(ctx, snapshot.worldSize, vista);
    this.drawPellets(ctx, snapshot.pellets, vista, t);
    this.drawEstelas(ctx, mias, ahora);

    for (const blob of [...blobs].sort((a, b) => a.radius - b.radius)) {
      if (blob.x + blob.radius * 1.5 < vista.x0 || blob.x - blob.radius * 1.5 > vista.x1) continue;
      if (blob.y + blob.radius * 1.5 < vista.y0 || blob.y - blob.radius * 1.5 > vista.y1) continue;
      this.drawBlob(ctx, blob, blob.ownerId === id, t);
    }

    this.drawParticulas(ctx, dt);
    ctx.restore();

    this.drawMinimapa(ctx, blobs, mias, snapshot.worldSize, width, height, vista);
  }

  private moverCamara(mias: Dibujable[], mundo: number, width: number, height: number): void {
    const c = this.centro(mias);
    const objetivo = c ?? { x: mundo / 2, y: mundo / 2 };
    let zoom = 1;
    if (mias.length) {
      const total = Math.sqrt(mias.reduce((s, m) => s + m.radius * m.radius, 0));
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, BASE_ZOOM * Math.pow(START_RADIUS / total, 0.4)));
      // Si estoy dividido, alejar lo necesario para ver todas mis células.
      const extension = Math.max(...mias.map((m) => Math.hypot(m.x - objetivo.x, m.y - objetivo.y) + m.radius));
      zoom = Math.max(MIN_ZOOM, Math.min(zoom, (Math.min(width, height) / 2 / (extension * 1.4)) || zoom));
    }
    if (!this.cam.lista) {
      this.cam = { x: objetivo.x, y: objetivo.y, zoom, lista: true };
      return;
    }
    this.cam.x += (objetivo.x - this.cam.x) * 0.2;
    this.cam.y += (objetivo.y - this.cam.y) * 0.2;
    this.cam.zoom += (zoom - this.cam.zoom) * 0.08;
  }

  private drawGrid(ctx: CanvasRenderingContext2D, mundo: number, v: { x0: number; y0: number; x1: number; y1: number }): void {
    const paso = 80;
    ctx.strokeStyle = 'rgba(148, 163, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.max(0, Math.floor(v.x0 / paso) * paso); x <= Math.min(mundo, v.x1); x += paso) {
      ctx.moveTo(x, Math.max(0, v.y0));
      ctx.lineTo(x, Math.min(mundo, v.y1));
    }
    for (let y = Math.max(0, Math.floor(v.y0 / paso) * paso); y <= Math.min(mundo, v.y1); y += paso) {
      ctx.moveTo(Math.max(0, v.x0), y);
      ctx.lineTo(Math.min(mundo, v.x1), y);
    }
    ctx.stroke();

    // Brillo del borde con dos trazos, sin shadowBlur (sobre un rectángulo de 4000 px es lentísimo).
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.15)';
    ctx.lineWidth = 18;
    ctx.strokeRect(0, 0, mundo, mundo);
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.75)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, mundo, mundo);
  }

  private drawPellets(ctx: CanvasRenderingContext2D, pellets: Pellet[], v: { x0: number; y0: number; x1: number; y1: number }, t: number): void {
    for (const p of pellets) {
      if (p.x < v.x0 - 20 || p.x > v.x1 + 20 || p.y < v.y0 - 20 || p.y > v.y1 + 20) continue;
      const power = POWERUPS[p.tipo];
      if (power) {
        const pulso = 1 + Math.sin(t * 4 + p.x) * 0.12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 22 * pulso, 0, Math.PI * 2);
        ctx.fillStyle = power.color + '1f';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14 * pulso, 0, Math.PI * 2);
        ctx.fillStyle = power.color + '33';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = power.color;
        ctx.stroke();
        ctx.font = '15px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(power.simbolo, p.x, p.y + 1);
        continue;
      }
      ctx.beginPath();
      if (p.tipo === 'grande') {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = '#fbbf24';
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = colorPellet(p);
        ctx.arc(p.x, p.y, p.tipo === 'masa' ? 12 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawEstelas(ctx: CanvasRenderingContext2D, mias: Dibujable[], ahora: number): void {
    if (ahora - this.ultimaEstela > 40) {
      this.ultimaEstela = ahora;
      for (const c of mias) {
        const lista = this.estelas.get(c.id) ?? [];
        lista.push({ x: c.x, y: c.y });
        if (lista.length > 14) lista.shift();
        this.estelas.set(c.id, lista);
      }
      for (const clave of this.estelas.keys()) {
        if (!mias.some((c) => c.id === clave)) this.estelas.delete(clave);
      }
    }
    for (const c of mias) {
      const lista = this.estelas.get(c.id) ?? [];
      lista.forEach((p, i) => {
        const f = (i + 1) / lista.length;
        ctx.beginPath();
        ctx.arc(p.x, p.y, c.radius * f * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = c.velocidad ? `rgba(250, 204, 21, ${0.12 * f})` : `rgba(255, 255, 255, ${0.05 * f})`;
        ctx.fill();
      });
    }
  }

  private drawBlob(ctx: CanvasRenderingContext2D, blob: Dibujable, esMio: boolean, t: number): void {
    const { x, y, radius: r } = blob;

    if (blob.iman) {
      ctx.save();
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -t * 30;
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + ALCANCE_IMAN, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Sombra simple (un círculo desplazado): shadowBlur por célula y por cuadro es muy caro.
    ctx.beginPath();
    ctx.arc(x, y + Math.min(8, r * 0.08), r * 1.02, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    dibujarSkin(ctx, blob.skin, x, y, r, blob.color, blob.ownerId, blob.angulo, t);

    if (blob.bot) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (esMio) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (blob.escudo) {
      ctx.save();
      ctx.setLineDash([r * 0.5, r * 0.25]);
      ctx.lineDashOffset = t * 40;
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
      ctx.lineWidth = Math.max(3, r * 0.07);
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const tamano = Math.max(11, Math.min(26, r / 2.4));
    ctx.font = `700 ${tamano}px 'Plus Jakarta Sans', 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2.5, tamano / 5);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeText(blob.name, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(blob.name, x, y);
  }

  private drawParticulas(ctx: CanvasRenderingContext2D, dt: number): void {
    for (const p of this.particulas) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.vida -= dt * 1.6;
      if (p.vida <= 0) continue;
      ctx.globalAlpha = p.vida;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.vida, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.particulas = this.particulas.filter((p) => p.vida > 0);
  }

  private drawMinimapa(
    ctx: CanvasRenderingContext2D,
    blobs: Dibujable[],
    mias: Dibujable[],
    mundo: number,
    width: number,
    height: number,
    v: { x0: number; y0: number; x1: number; y1: number },
  ): void {
    const lado = width < 600 ? 92 : 140;
    const x0 = width - lado - 14;
    const y0 = height - lado - 14;
    const escala = lado / mundo;

    ctx.save();
    ctx.fillStyle = 'rgba(7, 11, 22, 0.72)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, y0, lado, lado, 10);
    ctx.fill();
    ctx.stroke();

    for (const b of blobs) {
      if (b.radius < 45 && b.ownerId !== this.miId()) continue;
      ctx.beginPath();
      ctx.arc(x0 + b.x * escala, y0 + b.y * escala, Math.max(1.5, b.radius * escala), 0, Math.PI * 2);
      ctx.fillStyle = b.bot ? 'rgba(148, 163, 184, 0.7)' : 'rgba(251, 113, 133, 0.85)';
      ctx.fill();
    }
    for (const m of mias) {
      ctx.beginPath();
      ctx.arc(x0 + m.x * escala, y0 + m.y * escala, Math.max(2.5, m.radius * escala), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.strokeRect(
      x0 + Math.max(0, v.x0) * escala,
      y0 + Math.max(0, v.y0) * escala,
      (Math.min(mundo, v.x1) - Math.max(0, v.x0)) * escala,
      (Math.min(mundo, v.y1) - Math.max(0, v.y0)) * escala,
    );
    ctx.restore();
  }

  /** Pantalla de inicio: la skin elegida girando, para ver cómo se ve antes de jugar. */
  private animarVistaPrevia(): void {
    const canvas = this.previewRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 120 * dpr;
    canvas.height = 120 * dpr;
    const draw = (ahora: number) => {
      if (this.gameState() !== 'name') return;
      this.previewFrameId = requestAnimationFrame(draw);
      const t = ahora / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 120, 120);
      const r = 40 + Math.sin(t * 2) * 3;
      dibujarSkin(ctx, this.skin(), 60, 60, r, '#e11d48', 'vista-previa', t * 1.5, t);
    };
    if (this.previewFrameId) cancelAnimationFrame(this.previewFrameId);
    this.previewFrameId = requestAnimationFrame(draw);
  }

  private showToast(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimeoutId);
    this.toastTimeoutId = setTimeout(() => this.toast.set(null), 2500);
  }

  private cleanup(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
    clearInterval(this.sendIntervalId);
    clearTimeout(this.toastTimeoutId);
    clearTimeout(this.logroTimeoutId);
    if (this.renderFrameId) cancelAnimationFrame(this.renderFrameId);
    this.arenaService.disconnect();
  }
}

const coloresPellet = new Map<string, string>();

/** Color estable por pellet: el mapa se ve como confeti, no como puntos iguales. */
function colorPellet(p: Pellet): string {
  if (p.tipo === 'masa') return '#fb7185';
  let color = coloresPellet.get(p.id);
  if (!color) {
    if (coloresPellet.size > 2000) coloresPellet.clear();
    color = `hsl(${Math.floor(semilla(p.id)() * 360)} 85% 62%)`;
    coloresPellet.set(p.id, color);
  }
  return color;
}
