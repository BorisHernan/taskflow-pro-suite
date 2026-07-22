import { Routes } from '@angular/router';
import { KanbanBoardComponent } from './kanban-board/kanban-board.component';
import { StoreComponent } from './store/store.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ArenaComponent } from './arena/arena.component';

export const routes: Routes = [
  { path: '', component: KanbanBoardComponent },
  { path: 'tienda', component: StoreComponent },
  { path: 'estadisticas', component: DashboardComponent },
  { path: 'arena', component: ArenaComponent },
  { path: '**', redirectTo: '' },
];
