import { estimarEnvio, puntoDeEjemplo, vehiculoPara } from './entrega';

describe('entrega', () => {
  const miraflores = { lat: -12.1219, lng: -77.03 };

  it('elige el vehículo según las unidades del pedido', () => {
    expect([1, 8, 9, 12, 13, 30].map((n) => vehiculoPara(n).tipo)).toEqual(['moto', 'moto', 'auto', 'auto', 'camion', 'camion']);
  });

  it('estima distancia por calles y tiempo, y respeta la cobertura', () => {
    const cerca = estimarEnvio(miraflores, { lat: -12.1265, lng: -77.0215 }, 2);
    expect(cerca.enCobertura).toBe(true);
    expect(cerca.recorridoKm).toBeGreaterThan(cerca.lineaRectaKm);
    expect(cerca.minutos).toBe(20 + cerca.viajeMin);

    const chincha = estimarEnvio(miraflores, { lat: -13.41, lng: -76.13 }, 2);
    expect(chincha.enCobertura).toBe(false);
  });

  it('el punto de ejemplo queda dentro de la zona de reparto', () => {
    expect(estimarEnvio(miraflores, puntoDeEjemplo(miraflores), 1).enCobertura).toBe(true);
  });
});
