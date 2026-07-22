import { Routes } from '@angular/router';
import { KanbanBoardComponent } from './kanban-board/kanban-board.component';
import { StoreComponent } from './store/store.component';
import { DashboardComponent } from './dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', component: KanbanBoardComponent },
  { path: 'tienda', component: StoreComponent },
  { path: 'estadisticas', component: DashboardComponent },
  { path: '**', redirectTo: '' },
];
