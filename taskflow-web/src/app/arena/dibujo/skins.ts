/** Skins de la arena: cada una se dibuja con canvas 2D, sin imágenes. */

export interface Skin {
  clave: string;
  nombre: string;
}

export const SKINS: Skin[] = [
  { clave: 'clasico', nombre: 'Clásico' },
  { clave: 'sandia', nombre: 'Sandía' },
  { clave: 'planeta', nombre: 'Planeta' },
  { clave: 'galaxia', nombre: 'Galaxia' },
  { clave: 'dona', nombre: 'Dona' },
  { clave: 'ojo', nombre: 'Ojo' },
  { clave: 'bug', nombre: 'Bug' },
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
