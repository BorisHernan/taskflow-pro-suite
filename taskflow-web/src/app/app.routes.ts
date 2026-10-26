import { Routes } from '@angular/router';
import { conSesion, soloAdmin } from './auth/guards';

// Cada pantalla se carga recién al entrar (lazy): el bundle inicial solo trae la portada.
export const routes: Routes = [
  {
    path: '',
    title: 'TaskFlow · Gestión de tiendas en tiempo real · Boris Medrano',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'ingresar',
    title: 'Ingresar · TaskFlow',
    loadComponent: () => import('./auth/ingresar.component').then((m) => m.IngresarComponent),
  },
  {
    path: 'gestion',
    canActivate: [conSesion],
    loadComponent: () => import('./gestion/gestion-layout.component').then((m) => m.GestionLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      {
        path: 'resumen',
        title: 'Resumen · TaskFlow',
        loadComponent: () => import('./gestion/resumen/resumen.component').then((m) => m.ResumenComponent),
      },
      {
        path: 'tablero',
        title: 'Órdenes de trabajo · TaskFlow',
        loadComponent: () => import('./kanban-board/kanban-board.component').then((m) => m.KanbanBoardComponent),
      },
      {
        path: 'operaciones',
        title: 'Centro de operaciones · TaskFlow',
        loadComponent: () => import('./gestion/operaciones/operaciones.component').then((m) => m.OperacionesComponent),
      },
      {
        path: 'personal',
        title: 'Personal · TaskFlow',
        loadComponent: () => import('./gestion/personal/personal.component').then((m) => m.PersonalComponent),
      },
      {
        path: 'pedidos-online',
        title: 'Pedidos online · TaskFlow',
        loadComponent: () => import('./gestion/pedidos-online/pedidos-online.component').then((m) => m.PedidosOnlineComponent),
      },
      {
        path: 'inventario',
        title: 'Inventario · TaskFlow',
        loadComponent: () => import('./gestion/inventario/inventario.component').then((m) => m.InventarioComponent),
      },
      {
        path: 'compras',
        title: 'Compras · TaskFlow',
        loadComponent: () => import('./gestion/compras/compras.component').then((m) => m.ComprasComponent),
      },
      {
        path: 'mermas',
        title: 'Mermas · TaskFlow',
        loadComponent: () => import('./gestion/mermas/mermas.component').then((m) => m.MermasComponent),
      },
      {
        path: 'incidencias',
        title: 'Incidencias · TaskFlow',
        loadComponent: () => import('./gestion/incidencias/incidencias.component').then((m) => m.IncidenciasComponent),
      },
      {
        path: 'turnos',
        title: 'Turnos · TaskFlow',
        loadComponent: () => import('./gestion/turnos/turnos.component').then((m) => m.TurnosComponent),
      },
      {
        path: 'estadisticas',
        title: 'Estadísticas · TaskFlow',
        canActivate: [soloAdmin],
        loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'reportes',
        title: 'Reportes · TaskFlow',
        canActivate: [soloAdmin],
        loadComponent: () => import('./gestion/reportes/reportes.component').then((m) => m.ReportesComponent),
      },
    ],
  },
  {
    path: 'tienda',
    title: 'Quechuti · Supermercado online',
    loadComponent: () => import('./store/store.component').then((m) => m.StoreComponent),
  },
  {
    path: 'tienda/producto/:id',
    title: 'Producto · Quechuti',
    loadComponent: () =>
      import('./store/producto-detalle/producto-detalle.component').then((m) => m.ProductoDetalleComponent),
  },
  {
    path: 'tienda/boleta',
    title: 'Tu boleta · Quechuti',
    loadComponent: () => import('./store/boleta/boleta.component').then((m) => m.BoletaComponent),
  },
  {
    path: 'tienda/pedido',
    title: 'Seguir mi pedido · Quechuti',
    loadComponent: () => import('./store/seguimiento/seguimiento.component').then((m) => m.SeguimientoComponent),
  },
  {
    path: 'tienda/pedido/:codigo',
    title: 'Seguir mi pedido · Quechuti',
    loadComponent: () => import('./store/seguimiento/seguimiento.component').then((m) => m.SeguimientoComponent),
  },
  {
    path: 'arena',
    title: 'Arena multijugador · TaskFlow',
    loadComponent: () => import('./arena/arena.component').then((m) => m.ArenaComponent),
  },
  // Enlaces viejos (README, CV): siguen funcionando.
  { path: 'tablero', redirectTo: 'gestion/tablero' },
  { path: 'estadisticas', redirectTo: 'gestion/estadisticas' },
  { path: '**', redirectTo: '' },
];
