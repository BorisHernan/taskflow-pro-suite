import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { GuiaRecorridoComponent } from './shared/guia-recorrido/guia-recorrido.component';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, GuiaRecorridoComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor(public themeService: ThemeService) {}
}
