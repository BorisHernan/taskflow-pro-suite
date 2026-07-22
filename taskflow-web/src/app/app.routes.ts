import { Routes } from '@angular/router';
import { KanbanBoardComponent } from './kanban-board/kanban-board.component';
import { StoreComponent } from './store/store.component';

export const routes: Routes = [
  { path: '', component: KanbanBoardComponent },
  { path: 'tienda', component: StoreComponent },
  { path: '**', redirectTo: '' },
];
