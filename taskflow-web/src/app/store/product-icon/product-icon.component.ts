import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  Armchair, Backpack, BatteryCharging, Box, Bug, Cable, Calendar, Clock, Coffee, CupSoda, Dices,
  Footprints, GlassWater, Headphones, Key, Keyboard, Lamp, Laptop, Monitor, Moon, Mouse,
  MousePointerClick, Notebook, Package, PenLine, Power, Puzzle, Shirt, Sprout, StickyNote, Swords,
  Tag, Usb, GraduationCap, Glasses, Umbrella, Gift, Map, Watch, Briefcase, Webcam, Speaker, Router,
  Smartphone, BookOpen, Scissors, Palette, Flower2, Flame, BedDouble, Pizza, Gamepad2, Spade, Rocket,
  Apple, Banana, Carrot, Cherry, Grape, Citrus, Beef, Drumstick, Fish, Egg, Milk, Wheat, Cookie,
  Croissant, Beer, Candy, Popcorn, Cake, Sandwich, Salad, Utensils, CookingPot, Bean, Droplet,
  Droplets, Sparkles, SprayCan, Scroll, Baby, Dog, Cat, Bone, Bath, ShowerHead, Leaf,
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
  apple: Apple, banana: Banana, carrot: Carrot, cherry: Cherry, grape: Grape, citrus: Citrus, beef: Beef,
  drumstick: Drumstick, fish: Fish, egg: Egg, milk: Milk, wheat: Wheat, cookie: Cookie, croissant: Croissant,
  beer: Beer, candy: Candy, popcorn: Popcorn, cake: Cake, sandwich: Sandwich, salad: Salad, utensils: Utensils,
  pot: CookingPot, bean: Bean, droplet: Droplet, droplets: Droplets, sparkles: Sparkles, spray: SprayCan,
  scroll: Scroll, baby: Baby, dog: Dog, cat: Cat, bone: Bone, bath: Bath, shower: ShowerHead, leaf: Leaf, soda: CupSoda,
};

// Pictogramas a color (nada posterior al emoji 12 para que se vean también en Windows 10).
const PICTOGRAMAS: Record<string, string> = {
  cup: '☕', coffee: '🥤', tag: '🏷️', shirt: '👕', key: '🔑', mousepad: '🖱️', mouse: '🖱️', bottle: '💧',
  notebook: '📓', power: '🔌', sock: '🧦', laptop: '💻', cushion: '🛋️', moon: '🌙', backpack: '🎒',
  keyboard: '⌨️', headphones: '🎧', cable: '🔌', usb: '💾', monitor: '🖥️', battery: '🔋', lamp: '💡',
  calendar: '📅', pen: '🖊️', sticky: '🗒️', sprout: '🌱', clock: '🕒', box: '📦', dices: '🎲', puzzle: '🧩',
  swords: '⚔️', bug: '🐛', cap: '🧢', glasses: '🕶️', umbrella: '☂️', gift: '🎁', map: '🗺️', watch: '⌚',
  briefcase: '💼', webcam: '📷', speaker: '🔊', router: '📶', phone: '📱', book: '📖', scissors: '✂️',
  palette: '🎨', flower: '🌼', flame: '🕯️', blanket: '🛏️', pizza: '🍕', gamepad: '🎮', cards: '🃏', rocket: '🚀',
  apple: '🍎', banana: '🍌', carrot: '🥕', cherry: '🍑', grape: '🍇', citrus: '🍊', beef: '🥩', drumstick: '🍗',
  fish: '🐟', egg: '🥚', milk: '🥛', wheat: '🌾', cookie: '🍪', croissant: '🥐', beer: '🍺', candy: '🍫',
  popcorn: '🍿', cake: '🍰', sandwich: '🍞', salad: '🥬', utensils: '🍝', pot: '🥫', bean: '🌰', droplet: '🌻',
  droplets: '🧼', sparkles: '🧽', spray: '🧴', scroll: '🧻', baby: '🍼', dog: '🐶', cat: '🐱', bone: '🦴',
  bath: '🛁', shower: '🚿', leaf: '🥑', soda: '🥤', potato: '🥔', sausage: '🌭', tooth: '🦷', laundry: '🧺',
  icecream: '🍦', fridge: '❄️', microwave: '🍲', washer: '🧼', fan: '🌀', dumbbell: '🏋️', bike: '🚲',
  tent: '⛺', ball: '⚽',
  cactus: '🌵', plant: '🌿', rice: '🍚', honey: '🍯', peanut: '🥜', cheese: '🧀', strawberry: '🍓', pineapple: '🍍', tomato: '🍅',
  broccoli: '🥦', corn: '🌽', sweetpotato: '🍠', chicken: '🐔', stew: '🥘', burger: '🍔', ribs: '🍖', pig: '🐖',
  sushi: '🍣', shrimp: '🦐', bacon: '🥓', turkey: '🦃', baguette: '🥖', pita: '🥙', cupcake: '🧁', tea: '🍵',
  candy2: '🍬', fries: '🍟', trash: '🗑️', dog2: '🐕', cat2: '🐈', glass: '🥛', plate: '🍽️', cutlery: '🍴',
  frame: '🖼️', vase: '🏺', mirror: '🔮', bed: '🛏️', sleeping: '🛌', harddisk: '💽', soundbar: '📻',
  organizer: '🗂️', chair: '💺', feet: '🦶', folder: '📁', highlighter: '🖍️', formal: '👔', jacket: '🧥',
  pants: '👖', robe: '👘', scarf: '🧣', gloves: '🧤', chess: '♟️', car: '🚗', doll: '🧸', blocks: '🧱',
  wheel: '🏎️', pin: '📌', thread: '🧵', handbag: '👜', lunch: '🍱', glasses2: '👓', card: '💌', shopping: '🛍️',
  iron: '♨️', fire: '🔥', wind: '💨', yoga: '🧘', jump: '🤸', helmet: '⛑️', lock: '🔒', torch: '🔦', volley: '🏐',
};

// Formas dibujadas para lo que no tiene emoji: "forma:#color[:#color2]" (el color es el del producto).
const FORMAS = new Set(['granos', 'papa', 'yuca', 'olluco', 'chile', 'frasco', 'botella', 'lata', 'bolsa', 'carton', 'pote', 'pimiento', 'cebolla', 'bloque', 'tubo']);

@Component({
  selector: 'app-product-icon',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (forma(); as f) {
      <svg class="forma" viewBox="0 0 64 64" [attr.width]="size() * 0.92" [attr.height]="size() * 0.92" aria-hidden="true"
        stroke="#0000003d" stroke-width="1.6" stroke-linejoin="round">
        @switch (f) {
          @case ('granos') {
            <ellipse cx="22" cy="41" rx="11" ry="7" transform="rotate(-22 22 41)" [attr.fill]="c1()" />
            <ellipse cx="43" cy="40" rx="11" ry="7" transform="rotate(18 43 40)" [attr.fill]="c1()" />
            <ellipse cx="32" cy="24" rx="11" ry="7" transform="rotate(-6 32 24)" [attr.fill]="c1()" />
            <g fill="#fff" opacity=".35" stroke="none"><ellipse cx="19" cy="38" rx="4" ry="1.8" transform="rotate(-22 19 38)" /><ellipse cx="40" cy="37" rx="4" ry="1.8" transform="rotate(18 40 37)" /><ellipse cx="29" cy="21" rx="4" ry="1.8" transform="rotate(-6 29 21)" /></g>
          }
          @case ('papa') {
            <path d="M9 36c0-12 11-21 25-21s21 8 21 21-11 14-25 14S9 49 9 36z" [attr.fill]="c1()" />
            <g fill="#00000033" stroke="none"><circle cx="24" cy="33" r="2" /><circle cx="38" cy="40" r="2" /><circle cx="44" cy="28" r="1.8" /><circle cx="30" cy="24" r="1.6" /></g>
          }
          @case ('yuca') {
            <path d="M6 22c8-8 24-4 34 7s17 22 18 29c-9 2-23-3-33-14S2 30 6 22z" [attr.fill]="c1()" />
            <ellipse cx="9" cy="24" rx="5" ry="7" transform="rotate(-35 9 24)" fill="#f6efd8" />
            <path d="M20 30l4 5M30 38l4 5M38 46l3 4" fill="none" stroke-linecap="round" />
          }
          @case ('olluco') {
            <ellipse cx="22" cy="36" rx="12" ry="9" [attr.fill]="c1()" />
            <ellipse cx="42" cy="38" rx="11" ry="8" [attr.fill]="c1()" />
            <ellipse cx="32" cy="22" rx="11" ry="8" [attr.fill]="c1()" />
            <g [attr.fill]="c2()" stroke="none"><circle cx="18" cy="34" r="2" /><circle cx="25" cy="39" r="2" /><circle cx="40" cy="36" r="2" /><circle cx="45" cy="41" r="1.8" /><circle cx="29" cy="20" r="2" /><circle cx="35" cy="25" r="1.8" /></g>
          }
          @case ('chile') {
            <path d="M42 14c10 6 12 18 6 30-5 10-16 14-30 12 12-5 17-13 18-23 1-8-1-14 6-19z" [attr.fill]="c1()" />
            <path d="M42 14c-1-5 3-8 8-8" fill="none" stroke="#4d7c2a" stroke-width="4" stroke-linecap="round" />
          }
          @case ('frasco') {
            <rect x="21" y="9" width="22" height="9" rx="3" [attr.fill]="c2()" />
            <rect x="14" y="17" width="36" height="40" rx="7" [attr.fill]="c1()" />
            <rect x="19" y="29" width="26" height="16" rx="3" fill="#fff" opacity=".85" stroke="none" />
          }
          @case ('botella') {
            <rect x="27" y="5" width="10" height="8" rx="2" [attr.fill]="c2()" />
            <path d="M27 13h10v8c0 4 9 7 9 15v18a5 5 0 0 1-5 5H23a5 5 0 0 1-5-5V36c0-8 9-11 9-15z" [attr.fill]="c1()" />
            <rect x="20" y="36" width="24" height="14" rx="2" fill="#fff" opacity=".85" stroke="none" />
          }
          @case ('lata') {
            <rect x="15" y="14" width="34" height="38" rx="4" [attr.fill]="c1()" />
            <ellipse cx="32" cy="14" rx="17" ry="5" fill="#dcdcdc" />
            <rect x="15" y="26" width="34" height="14" fill="#fff" opacity=".85" stroke="none" />
          }
          @case ('bolsa') {
            <path d="M14 18h36l-3 38a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4z" [attr.fill]="c1()" />
            <rect x="13" y="9" width="38" height="9" rx="2" [attr.fill]="c1()" />
            <rect x="13" y="9" width="38" height="9" rx="2" fill="#000" opacity=".15" stroke="none" />
            <ellipse cx="32" cy="38" rx="11" ry="9" fill="#fff" opacity=".85" stroke="none" />
          }
          @case ('carton') {
            <path d="M18 24 32 8l14 16z" [attr.fill]="c1()" />
            <path d="M18 24 32 8l14 16z" fill="#000" opacity=".15" stroke="none" />
            <rect x="18" y="24" width="28" height="34" rx="2" [attr.fill]="c1()" />
            <circle cx="32" cy="41" r="8" fill="#fff" opacity=".85" stroke="none" />
          }
          @case ('pote') {
            <path d="M13 26h38l-4 28a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4z" [attr.fill]="c1()" />
            <rect x="11" y="16" width="42" height="11" rx="5" fill="#f4f4f4" />
            <rect x="21" y="35" width="22" height="12" rx="3" fill="#fff" opacity=".85" stroke="none" />
          }
          @case ('pimiento') {
            <path d="M32 16c-10-2-20 6-19 20 1 14 9 22 19 22s18-8 19-22c1-14-9-22-19-20z" [attr.fill]="c1()" />
            <path d="M32 16v40M24 18c-4 10-4 26 2 38M40 18c4 10 4 26-2 38" fill="none" stroke="#0000002a" />
            <path d="M32 16c0-5 2-8 6-9" fill="none" stroke="#4d7c2a" stroke-width="4" stroke-linecap="round" />
          }
          @case ('cebolla') {
            <path d="M32 8c3 6 4 9 3 12 12 4 19 14 16 26-3 10-12 14-19 14S16 56 13 46c-3-12 4-22 16-26-1-3 0-6 3-12z" [attr.fill]="c1()" />
            <path d="M32 20c-8 6-10 22-4 38M32 20c8 6 10 22 4 38" fill="none" stroke="#0000002a" />
          }
          @case ('bloque') {
            <rect x="9" y="22" width="46" height="26" rx="4" [attr.fill]="c1()" />
            <rect x="9" y="22" width="46" height="9" rx="4" fill="#fff" opacity=".35" stroke="none" />
            <path d="M18 38h28" fill="none" stroke-width="2" stroke-linecap="round" />
          }
          @case ('tubo') {
            <rect x="26" y="6" width="12" height="9" rx="2" [attr.fill]="c2()" />
            <path d="M22 15h20l4 42a2 2 0 0 1-2 3H20a2 2 0 0 1-2-3z" [attr.fill]="c1()" />
            <rect x="22" y="30" width="20" height="12" rx="2" fill="#fff" opacity=".85" stroke="none" />
          }
        }
      </svg>
    } @else if (pictograma(); as p) {
      <span class="pictograma" [style.font-size.px]="size() * 0.82" aria-hidden="true">{{ p }}</span>
    } @else {
      <app-icono [icono]="nodo()" [tamano]="size()" [grosor]="1.5" [relleno]="0.16" />
    }
  `,
  styles: `
    :host { display: inline-flex; line-height: 0; }
    .forma { display: block; }
    .pictograma { display: inline-block; line-height: 1; font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif; }
  `,
})
export class ProductIconComponent {
  readonly icon = input('');
  readonly size = input(32);

  private readonly partes = computed(() => this.icon().split(':'));
  readonly forma = computed(() => (FORMAS.has(this.partes()[0]) ? this.partes()[0] : ''));
  readonly c1 = computed(() => this.partes()[1] || '#c8b79a');
  readonly c2 = computed(() => this.partes()[2] || '#6b5a4a');
  readonly pictograma = computed(() => PICTOGRAMAS[this.icon()] ?? '');
  readonly nodo = computed(() => ICONOS_PRODUCTO[this.icon()] ?? Package);
}
