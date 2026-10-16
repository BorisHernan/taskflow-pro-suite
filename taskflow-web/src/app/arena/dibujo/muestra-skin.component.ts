import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import { dibujarSkin } from './skins';

/** Miniatura estática de una skin (se dibuja con el mismo código que el juego). */
@Component({
  selector: 'app-muestra-skin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #lienzo [attr.width]="tamano() * 2" [attr.height]="tamano() * 2" [style.width.px]="tamano()" [style.height.px]="tamano()"></canvas>`,
  styles: `:host { display: inline-flex; line-height: 0; } canvas { display: block; }`,
})
export class MuestraSkinComponent {
  readonly skin = input.required<string>();
  readonly tamano = input(34);
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');

  constructor() {
    afterRenderEffect(() => {
      const ctx = this.lienzo().nativeElement.getContext('2d');
      if (!ctx) return;
      const lado = this.tamano();
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, lado, lado);
      // Margen para lo que sobresale del círculo (rayos del sol, anillo del planeta).
      dibujarSkin(ctx, this.skin(), lado / 2, lado / 2, lado * 0.36, '#e11d48', 'muestra-' + this.skin(), 0.6, 1);
    });
  }
}
