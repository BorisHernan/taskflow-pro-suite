import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    // jsdom no trae matchMedia; App inyecta ThemeService, que lo llama al
    // arrancar para detectar el tema preferido del sistema.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renderiza la navegación con los 4 enlaces principales', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('.app-nav-links a')).map((a) => a.textContent?.trim());

    expect(links).toEqual([
      '📋 Tablero Kanban',
      '🛒 Tienda',
      '📊 Estadísticas',
      '🕹️ Arena',
    ]);
  });

  it('el botón de tema alterna el tema al hacer click', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    const initialTheme = app.themeService.theme();

    const button = fixture.nativeElement.querySelector('.theme-toggle') as HTMLButtonElement;
    button.click();

    expect(app.themeService.theme()).not.toBe(initialTheme);
  });
});
