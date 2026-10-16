/** Skins de la arena: cada una se dibuja con canvas 2D, sin imágenes. */

export interface Skin {
  clave: string;
  nombre: string;
  /** Tamaño récord necesario para desbloquearla (sin valor: disponible desde el inicio). */
  desbloqueo?: number;
}

export const SKINS: Skin[] = [
  { clave: 'clasico', nombre: 'Clásico' },
  { clave: 'sandia', nombre: 'Sandía' },
  { clave: 'planeta', nombre: 'Planeta' },
  { clave: 'galaxia', nombre: 'Galaxia' },
  { clave: 'dona', nombre: 'Dona' },
  { clave: 'ojo', nombre: 'Ojo' },
  { clave: 'bug', nombre: 'Bug' },
  // Exclusivas: se desbloquean al alcanzar ese tamaño en alguna partida.
  { clave: 'pixel', nombre: 'Pixel', desbloqueo: 25 },
  { clave: 'cafe', nombre: 'Café', desbloqueo: 30 },
  { clave: 'terminal', nombre: 'Terminal', desbloqueo: 40 },
  { clave: 'pizza', nombre: 'Pizza', desbloqueo: 50 },
  { clave: 'arcoiris', nombre: 'Arcoíris', desbloqueo: 60 },
  { clave: 'luna', nombre: 'Luna', desbloqueo: 75 },
  { clave: 'sol', nombre: 'Sol', desbloqueo: 90 },
  { clave: 'balon', nombre: 'Balón', desbloqueo: 110 },
  { clave: 'lava', nombre: 'Lava', desbloqueo: 140 },
  { clave: 'diamante', nombre: 'Diamante', desbloqueo: 180 },
];

/** Número pseudoaleatorio estable a partir de un texto (para semillas, cráteres, chispas). */
export function semilla(texto: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function oscurecer(color: string, factor: number): string {
  const n = parseInt(color.slice(1, 7), 16);
  const c = (v: number) => Math.round(v * factor).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

function circulo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

/**
 * Dibuja el cuerpo de una célula. `angulo` es hacia dónde se mueve (el ojo mira ahí),
 * `t` el tiempo en segundos (para lo que gira o brilla).
 */
export function dibujarSkin(
  ctx: CanvasRenderingContext2D,
  skin: string,
  x: number,
  y: number,
  r: number,
  color: string,
  id: string,
  angulo: number,
  t: number,
): void {
  const azar = semilla(id);
  ctx.save();

  switch (skin) {
    case 'sandia': {
      circulo(ctx, x, y, r);
      ctx.fillStyle = '#16a34a';
      ctx.fill();
      circulo(ctx, x, y, r * 0.88);
      ctx.fillStyle = '#bbf7d0';
      ctx.fill();
      circulo(ctx, x, y, r * 0.8);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      for (let i = 0; i < 9; i++) {
        const a = azar() * Math.PI * 2;
        const d = r * (0.2 + azar() * 0.45);
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.05, r * 0.09, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'planeta': {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, '#fde68a');
      g.addColorStop(1, '#d97706');
      circulo(ctx, x, y, r);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = 'rgba(146, 64, 14, 0.35)';
      for (let i = 0; i < 5; i++) {
        const a = azar() * Math.PI * 2;
        const d = r * azar() * 0.6;
        circulo(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.08 + azar() * 0.1));
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(254, 243, 199, 0.85)';
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.45, r * 0.38, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'galaxia': {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, '#f0abfc');
      g.addColorStop(0.45, '#7c3aed');
      g.addColorStop(1, '#1e1b4b');
      circulo(ctx, x, y, r);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 18; i++) {
        const a = azar() * Math.PI * 2 + t * 0.4;
        const d = r * Math.sqrt(azar()) * 0.92;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
        circulo(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(0.8, r * 0.025));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'dona': {
      circulo(ctx, x, y, r);
      ctx.fillStyle = '#d6a36a';
      ctx.fill();
      circulo(ctx, x, y, r * 0.86);
      ctx.fillStyle = '#f472b6';
      ctx.fill();
      const colores = ['#facc15', '#38bdf8', '#ffffff', '#a3e635'];
      for (let i = 0; i < 16; i++) {
        const a = azar() * Math.PI * 2;
        const d = r * (0.38 + azar() * 0.4);
        ctx.save();
        ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
        ctx.rotate(azar() * Math.PI);
        ctx.fillStyle = colores[i % colores.length];
        ctx.fillRect(-r * 0.06, -r * 0.018, r * 0.12, r * 0.036);
        ctx.restore();
      }
      circulo(ctx, x, y, r * 0.24);
      ctx.fillStyle = '#0b1020';
      ctx.fill();
      break;
    }
    case 'ojo': {
      circulo(ctx, x, y, r);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = Math.max(1, r * 0.02);
      for (let i = 0; i < 6; i++) {
        const a = azar() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
        ctx.lineTo(x + Math.cos(a + 0.2) * r * 0.6, y + Math.sin(a + 0.2) * r * 0.6);
        ctx.stroke();
      }
      const ix = x + Math.cos(angulo) * r * 0.3;
      const iy = y + Math.sin(angulo) * r * 0.3;
      circulo(ctx, ix, iy, r * 0.45);
      ctx.fillStyle = color;
      ctx.fill();
      circulo(ctx, ix, iy, r * 0.2);
      ctx.fillStyle = '#0b1020';
      ctx.fill();
      circulo(ctx, ix - r * 0.1, iy - r * 0.1, r * 0.07);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      break;
    }
    case 'bug': {
      circulo(ctx, x, y, r);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = Math.max(1.5, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angulo) * r, y + Math.sin(angulo) * r);
      ctx.lineTo(x - Math.cos(angulo) * r, y - Math.sin(angulo) * r);
      ctx.stroke();
      ctx.fillStyle = '#111827';
      circulo(ctx, x + Math.cos(angulo) * r * 0.75, y + Math.sin(angulo) * r * 0.75, r * 0.32);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = azar() * Math.PI * 2;
        const d = r * (0.3 + azar() * 0.45);
        circulo(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.1);
        ctx.fill();
      }
      break;
    }
    // ── Desbloqueables ──────────────────────────────────────
    case 'pixel': {
      ctx.save();
      circulo(ctx, x, y, r);
      ctx.clip();
      const celda = Math.max(3, r / 5);
      const colores = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#34d399'];
      for (let px = x - r; px < x + r; px += celda) {
        for (let py = y - r; py < y + r; py += celda) {
          const i = Math.abs(Math.floor(px / celda) * 7 + Math.floor(py / celda) * 13);
          ctx.fillStyle = colores[(i + Math.floor(t * 2)) % colores.length];
          ctx.fillRect(px, py, celda - 1, celda - 1);
        }
      }
      ctx.restore();
      break;
    }
    case 'cafe': {
      circulo(ctx, x, y, r);
      ctx.fillStyle = '#f5f5f4';
      ctx.fill();
      circulo(ctx, x, y, r * 0.84);
      ctx.fillStyle = '#7c4a2d';
      ctx.fill();
      // Arte latte: un corazón de espuma que se mece.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 0.5) * 0.3);
      ctx.fillStyle = '#f3e3cf';
      ctx.beginPath();
      ctx.moveTo(0, r * 0.45);
      ctx.bezierCurveTo(-r * 0.75, -r * 0.05, -r * 0.35, -r * 0.6, 0, -r * 0.22);
      ctx.bezierCurveTo(r * 0.35, -r * 0.6, r * 0.75, -r * 0.05, 0, r * 0.45);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'terminal': {
      circulo(ctx, x, y, r);
      ctx.fillStyle = '#020617';
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = Math.max(2, r * 0.06);
      ctx.stroke();
      ctx.save();
      circulo(ctx, x, y, r);
      ctx.clip();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
      for (let ly = y - r; ly < y + r; ly += Math.max(3, r * 0.08)) ctx.fillRect(x - r, ly, r * 2, 1);
      ctx.restore();
      ctx.fillStyle = '#4ade80';
      ctx.font = `700 ${r * 0.55}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.floor(t * 2) % 2 ? '>_' : '> ', x, y - r * 0.3);
      break;
    }
    case 'pizza': {
      circulo(ctx, x, y, r);
      ctx.fillStyle = '#d97706';
      ctx.fill();
      circulo(ctx, x, y, r * 0.85);
      ctx.fillStyle = '#fcd34d';
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      for (let i = 0; i < 8; i++) {
        const a = azar() * Math.PI * 2;
        const d = r * (0.15 + azar() * 0.55);
        circulo(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.12);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(146, 64, 14, 0.5)';
      ctx.lineWidth = Math.max(1, r * 0.03);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
        ctx.stroke();
      }
      break;
    }
    case 'arcoiris': {
      const g = ctx.createConicGradient(t, x, y);
      const colores = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ef4444'];
      colores.forEach((c, i) => g.addColorStop(i / (colores.length - 1), c));
      circulo(ctx, x, y, r);
      ctx.fillStyle = g;
      ctx.fill();
      const brillo = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      brillo.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      brillo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = brillo;
      ctx.fill();
      break;
    }
    case 'luna': {
      circulo(ctx, x, y, r * 1.12);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.12)';
      ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#f8fafc');
      g.addColorStop(1, '#94a3b8');
      circulo(ctx, x, y, r);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = 'rgba(71, 85, 105, 0.35)';
      for (let i = 0; i < 7; i++) {
        const a = azar() * Math.PI * 2;
        const d = r * azar() * 0.65;
        circulo(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.07 + azar() * 0.12));
        ctx.fill();
      }
      break;
    }
    case 'sol': {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2 + t * 0.6;
        const largo = i % 2 === 0 ? r * (1.25 + Math.sin(t * 5 + i) * 0.05) : r * 0.95;
        ctx.lineTo(x + Math.cos(a) * largo, y + Math.sin(a) * largo);
      }
      ctx.closePath();
      ctx.fill();
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, '#fef9c3');
      g.addColorStop(0.6, '#facc15');
      g.addColorStop(1, '#f97316');
      circulo(ctx, x, y, r);
      ctx.fillStyle = g;
      ctx.fill();
      break;
    }
    case 'balon': {
      circulo(ctx, x, y, r);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.save();
      circulo(ctx, x, y, r);
      ctx.clip();
      ctx.fillStyle = '#0f172a';
      const pentagono = (cx: number, cy: number, tam: number, giro: number) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = giro + (i / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(cx + Math.cos(a) * tam, cy + Math.sin(a) * tam);
        }
        ctx.closePath();
        ctx.fill();
      };
      const giro = angulo * 0.5;
      pentagono(x, y, r * 0.3, giro);
      for (let i = 0; i < 5; i++) {
        const a = giro + (i / 5) * Math.PI * 2 - Math.PI / 2;
        pentagono(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.26, giro + Math.PI);
      }
      ctx.restore();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1.5, r * 0.04);
      circulo(ctx, x, y, r);
      ctx.stroke();
      break;
    }
    case 'lava': {
      circulo(ctx, x, y, r);
      ctx.fillStyle = '#7f1d1d';
      ctx.fill();
      ctx.save();
      circulo(ctx, x, y, r);
      ctx.clip();
      for (let i = 0; i < 6; i++) {
        const a = azar() * Math.PI * 2 + t * (0.3 + azar() * 0.4);
        const d = r * (0.2 + azar() * 0.5);
        const cx = x + Math.cos(a) * d;
        const cy = y + Math.sin(a) * d;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.55);
        g.addColorStop(0, '#fde047');
        g.addColorStop(0.4, '#f97316');
        g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
      break;
    }
    case 'diamante': {
      const caras = 8;
      for (let i = 0; i < caras; i++) {
        const a0 = (i / caras) * Math.PI * 2 + t * 0.2;
        const a1 = ((i + 1) / caras) * Math.PI * 2 + t * 0.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
        ctx.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r);
        ctx.closePath();
        ctx.fillStyle = `hsl(${190 + i * 6} 90% ${55 + 30 * Math.sin(t * 2 + i * 1.3)}%)`;
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = Math.max(1.5, r * 0.04);
      circulo(ctx, x, y, r);
      ctx.stroke();
      const destello = (Math.sin(t * 1.5) + 1) / 2;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * destello})`;
      circulo(ctx, x - r * 0.35, y - r * 0.35, r * 0.1 * (0.5 + destello));
      ctx.fill();
      break;
    }

    // ── Exclusivas de los bots ──────────────────────────────
    case 'robot': {
      const g = ctx.createLinearGradient(x, y - r, x, y + r);
      g.addColorStop(0, '#e2e8f0');
      g.addColorStop(1, '#64748b');
      circulo(ctx, x, y, r);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.stroke();
      // Visor oscuro con dos ojos LED que parpadean.
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(x - r * 0.62, y - r * 0.32, r * 1.24, r * 0.5, r * 0.22);
      ctx.fill();
      const parpadeo = Math.sin(t * 3 + azar() * 6) > 0.92 ? 0.15 : 1;
      ctx.fillStyle = color;
      ctx.globalAlpha = parpadeo;
      for (const lado of [-1, 1]) {
        circulo(ctx, x + lado * r * 0.27 + Math.cos(angulo) * r * 0.06, y - r * 0.07, r * 0.11);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Antena.
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(1.5, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y - r * 1.25);
      ctx.stroke();
      circulo(ctx, x, y - r * 1.3, r * 0.09);
      ctx.fillStyle = color;
      ctx.fill();
      break;
    }
    case 'virus': {
      // Espinas que laten alrededor del cuerpo.
      const puntas = 14;
      ctx.beginPath();
      for (let i = 0; i <= puntas * 2; i++) {
        const a = (i / (puntas * 2)) * Math.PI * 2 + t * 0.3;
        const largo = i % 2 === 0 ? r * (1.12 + Math.sin(t * 4 + i) * 0.03) : r * 0.92;
        ctx.lineTo(x + Math.cos(a) * largo, y + Math.sin(a) * largo);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 0.9);
      g.addColorStop(0, '#ffffff99');
      g.addColorStop(1, '#00000000');
      circulo(ctx, x, y, r * 0.9);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      for (let i = 0; i < 6; i++) {
        const a = azar() * Math.PI * 2;
        const d = r * azar() * 0.55;
        circulo(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.06 + azar() * 0.08));
        ctx.fill();
      }
      break;
    }
    case 'carita': {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#ffffffaa');
      g.addColorStop(0.35, color);
      g.addColorStop(1, color);
      circulo(ctx, x, y, r);
      ctx.fillStyle = g;
      ctx.fill();
      // Los ojos miran hacia donde va.
      const mx = Math.cos(angulo) * r * 0.08;
      const my = Math.sin(angulo) * r * 0.08;
      for (const lado of [-1, 1]) {
        circulo(ctx, x + lado * r * 0.3, y - r * 0.18, r * 0.2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        circulo(ctx, x + lado * r * 0.3 + mx, y - r * 0.18 + my, r * 0.1);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
      }
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.5, r * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y + r * 0.1, r * 0.35, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
      for (const lado of [-1, 1]) {
        circulo(ctx, x + lado * r * 0.55, y + r * 0.15, r * 0.12);
        ctx.fill();
      }
      break;
    }
    default: {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, oscurecer(color, 0.72));
      circulo(ctx, x, y, r);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = oscurecer(color, 0.6);
      ctx.lineWidth = Math.max(2, r * 0.06);
      circulo(ctx, x, y, r - ctx.lineWidth / 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}
