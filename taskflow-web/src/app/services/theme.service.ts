import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
/** Preferencia del usuario: un tema fijo o seguir al sistema operativo. */
export type ThemePreference = Theme | 'system';

const STORAGE_KEY = 'taskflow-theme';
const ORDEN: ThemePreference[] = ['light', 'dark', 'system'];

/**
 * Única fuente de verdad del tema. Escribe el tema resuelto en
 * <html data-theme>, de donde salen todos los tokens --tf-*.
 * El script de index.html aplica lo mismo antes de pintar (sin destello).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly sistemaOscuro = signal(this.media?.matches ?? false);

  readonly preference = signal<ThemePreference>(this.leerPreferencia());
  readonly theme = computed<Theme>(() => {
    const p = this.preference();
    return p === 'system' ? (this.sistemaOscuro() ? 'dark' : 'light') : p;
  });

  readonly etiqueta = computed(() =>
    ({ light: 'Tema claro', dark: 'Tema oscuro', system: 'Tema del sistema' })[this.preference()],
  );

  constructor() {
    const alCambiar = (e: MediaQueryListEvent) => {
      this.sistemaOscuro.set(e.matches);
      this.aplicar();
    };
    this.media?.addEventListener?.('change', alCambiar);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener?.('change', alCambiar));
    this.aplicar();
  }

  /** Recorre claro → oscuro → sistema. */
  toggle(): void {
    this.set(ORDEN[(ORDEN.indexOf(this.preference()) + 1) % ORDEN.length]);
  }

  set(preferencia: ThemePreference): void {
    this.preference.set(preferencia);
    try {
      localStorage.setItem(STORAGE_KEY, preferencia);
    } catch {}
    this.aplicar();
  }

  private leerPreferencia(): ThemePreference {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {}
    return 'system';
  }

  private aplicar(): void {
    document.documentElement.setAttribute('data-theme', this.theme());
  }
}
