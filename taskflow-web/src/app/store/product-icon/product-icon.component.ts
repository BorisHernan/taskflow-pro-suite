import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-icon.component.html',
  styleUrl: './product-icon.component.scss',
})
export class ProductIconComponent {
  @Input() icon = '';
  @Input() size = 32;
}
