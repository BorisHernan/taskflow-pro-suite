import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
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

    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('sin sesión la navegación ofrece ingresar, la tienda online y la arena', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('.app-nav-links a')).map((a) => a.textContent?.trim());
    const accion = compiled.querySelector('.app-nav-acciones a')?.textContent?.trim();

    expect(links).toEqual(['Tienda online', 'Arena']);
    expect(accion).toBe('Ingresar');
  });

  it('el botón de tema alterna el tema al hacer click', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    const inicial = app.themeService.preference();

    const button = fixture.nativeElement.querySelector('app-selector-tema button') as HTMLButtonElement;
    button.click();

    expect(app.themeService.preference()).not.toBe(inicial);
  });
});
