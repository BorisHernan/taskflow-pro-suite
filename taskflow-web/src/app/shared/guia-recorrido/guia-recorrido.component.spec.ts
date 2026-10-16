import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { GuiaRecorridoComponent } from './guia-recorrido.component';

@Component({ standalone: true, template: '' })
class VacioComponent {}

describe('GuiaRecorridoComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GuiaRecorridoComponent],
      providers: [
        provideRouter(['', 'tablero', 'tienda', 'estadisticas', 'arena'].map((path) => ({ path, component: VacioComponent }))),
      ],
    });
  });

  async function irA(url: string) {
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(GuiaRecorridoComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('en la portada no muestra la barra', async () => {
    const fixture = await irA('/');
    expect(fixture.componentInstance.paso()).toBeNull();
    expect(fixture.nativeElement.querySelector('.guia')).toBeNull();
  });

  it('en la tienda muestra el paso 2 y propone las estadísticas como siguiente', async () => {
    const fixture = await irA('/tienda');
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(fixture.componentInstance.indice()).toBe(1);
    expect(texto).toContain('Paso 2 de 4');
    expect(texto).toContain('Siguiente: Métricas del sistema');
  });

  it('en el último paso ofrece terminar el recorrido', async () => {
    const fixture = await irA('/arena');
    expect(fixture.componentInstance.siguiente()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Terminar el recorrido');
  });
});
