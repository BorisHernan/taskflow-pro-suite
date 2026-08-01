import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: prefersDark,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    mockMatchMedia(false);
  });

  it('usa el tema guardado en localStorage si existe, ignorando la preferencia del sistema', () => {
    localStorage.setItem('taskflow-theme', 'dark');
    mockMatchMedia(false);

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sin tema guardado, cae a la preferencia del sistema (oscuro)', () => {
    mockMatchMedia(true);

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
  });

  it('sin tema guardado ni preferencia del sistema, usa claro por defecto', () => {
    mockMatchMedia(false);

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');
  });

  it('toggle alterna el tema, lo aplica al <html> y lo persiste en localStorage', () => {
    mockMatchMedia(false);
    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');

    service.toggle();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('taskflow-theme')).toBe('dark');

    service.toggle();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('taskflow-theme')).toBe('light');
  });
});
