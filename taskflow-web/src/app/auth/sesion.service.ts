import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Sesion } from '../models/gestion.model';

const CLAVE = 'taskflow-sesion';
export const API_BASE = environment.apiUrl.replace(/\/api\/tasks\/?$/, '');

function leerGuardada(): Sesion | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Sesion | null;
    return s && new Date(s.expira).getTime() > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/** Sesión del usuario (JWT). Sobrevive a recargas hasta que el token expira. */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly sesion = signal<Sesion | null>(leerGuardada());
  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly activa = computed(() => this.sesion() !== null);
  readonly esAdmin = computed(() => this.usuario()?.rol === 'ADMIN');
  readonly token = computed(() => this.sesion()?.token ?? null);

  ingresar(usuario: string, clave: string): Observable<Sesion> {
    return this.http.post<Sesion>(`${API_BASE}/api/auth/login`, { usuario, clave }).pipe(
      tap((s) => {
        this.sesion.set(s);
        try {
          localStorage.setItem(CLAVE, JSON.stringify(s));
        } catch {}
      }),
    );
  }

  salir(motivo?: 'expirada'): void {
    this.sesion.set(null);
    try {
      localStorage.removeItem(CLAVE);
    } catch {}
    this.router.navigate(['/ingresar'], { queryParams: motivo ? { motivo } : {} });
  }
}
