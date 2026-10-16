import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { registroHttpInterceptor } from './registro-http.interceptor';
import { RegistroEventosService } from './registro-eventos.service';

describe('registroHttpInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let registro: RegistroEventosService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([registroHttpInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    registro = TestBed.inject(RegistroEventosService);
  });

  afterEach(() => httpMock.verify());

  it('anota las llamadas al backend con método, ruta y estado, en la demo que corresponde', () => {
    http.post('https://api.example.com/api/products/3/purchase', { quantity: 1 }).subscribe();
    httpMock.expectOne('https://api.example.com/api/products/3/purchase').flush({});

    const [evento] = registro.eventos();
    expect(evento.demo).toBe('tienda');
    expect(evento.canal).toBe('REST');
    expect(evento.detalle).toMatch(/^POST \/api\/products\/3\/purchase → 200 en \d+ ms$/);
  });

  it('también anota los errores', () => {
    http.get('https://api.example.com/api/tasks').subscribe({ error: () => {} });
    httpMock.expectOne('https://api.example.com/api/tasks').flush('x', { status: 503, statusText: 'Down' });

    expect(registro.eventos()[0].detalle).toContain('GET /api/tasks → 503');
  });

  it('no anota llamadas que no son del backend', () => {
    http.get('https://otro.com/algo').subscribe();
    httpMock.expectOne('https://otro.com/algo').flush({});
    expect(registro.eventos()).toEqual([]);
  });
});
