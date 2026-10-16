import { Routes } from '@angular/router';

// Cada pantalla se carga recién al entrar (lazy): el bundle inicial solo trae la portada.
export const routes: Routes = [
  {
    path: '',
    title: 'TaskFlow App · Boris Medrano, Full Stack Java',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'tablero',
    title: 'Tablero Kanban en tiempo real · TaskFlow App',
    loadComponent: () => import('./kanban-board/kanban-board.component').then((m) => m.KanbanBoardComponent),
  },
  {
    path: 'tienda',
    title: 'Tienda con stock en vivo · TaskFlow App',
    loadComponent: () => import('./store/store.component').then((m) => m.StoreComponent),
  },
  {
    path: 'estadisticas',
    title: 'Estadísticas · TaskFlow App',
    loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'arena',
    title: 'Arena Lite multijugador · TaskFlow App',
    loadComponent: () => import('./arena/arena.component').then((m) => m.ArenaComponent),
  },
  { path: '**', redirectTo: '' },
];
