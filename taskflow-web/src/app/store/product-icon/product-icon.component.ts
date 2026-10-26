import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  Armchair, Backpack, BatteryCharging, Box, Bug, Cable, Calendar, Clock, Coffee, CupSoda, Dices,
  Footprints, GlassWater, Headphones, Key, Keyboard, Lamp, Laptop, Monitor, Moon, Mouse,
  MousePointerClick, Notebook, Package, PenLine, Power, Puzzle, Shirt, Sprout, StickyNote, Swords,
  Tag, Usb, GraduationCap, Glasses, Umbrella, Gift, Map, Watch, Briefcase, Webcam, Speaker, Router,
  Smartphone, BookOpen, Scissors, Palette, Flower2, Flame, BedDouble, Pizza, Gamepad2, Spade, Rocket,
  type IconNode,
} from 'lucide';
import { IconoComponent } from '../../shared/icono/icono.component';

// La columna `icon` de products guarda una clave; aquí se traduce a lucide.
const ICONOS_PRODUCTO: Record<string, IconNode> = {
  cup: Coffee, coffee: CupSoda, tag: Tag, shirt: Shirt, key: Key, mousepad: Mouse,
  mouse: MousePointerClick, bottle: GlassWater, notebook: Notebook, power: Power, sock: Footprints,
  laptop: Laptop, cushion: Armchair, moon: Moon, backpack: Backpack, keyboard: Keyboard,
  headphones: Headphones, cable: Cable, usb: Usb, monitor: Monitor, battery: BatteryCharging,
  lamp: Lamp, calendar: Calendar, pen: PenLine, sticky: StickyNote, sprout: Sprout, clock: Clock,
  box: Box, dices: Dices, puzzle: Puzzle, swords: Swords, bug: Bug,
  cap: GraduationCap, glasses: Glasses, umbrella: Umbrella, gift: Gift, map: Map, watch: Watch,
  briefcase: Briefcase, webcam: Webcam, speaker: Speaker, router: Router, phone: Smartphone, book: BookOpen,
  scissors: Scissors, palette: Palette, flower: Flower2, flame: Flame, blanket: BedDouble, pizza: Pizza,
  gamepad: Gamepad2, cards: Spade, rocket: Rocket,
};

@Component({
  selector: 'app-product-icon',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-icono [icono]="nodo()" [tamano]="size()" [grosor]="1.5" [relleno]="0.16" />`,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class ProductIconComponent {
  readonly icon = input('');
  readonly size = input(32);

  readonly nodo = computed(() => ICONOS_PRODUCTO[this.icon()] ?? Package);
}
