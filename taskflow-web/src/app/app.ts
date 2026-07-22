import { Component } from '@angular/core';
import { KanbanBoardComponent } from './kanban-board/kanban-board.component';

@Component({
  selector: 'app-root',
  imports: [KanbanBoardComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}