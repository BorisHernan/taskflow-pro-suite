import { Pipe, PipeTransform } from '@angular/core';

const FORMATO_SOLES = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

/** Formatea montos en soles con Intl (S/ 15.00), en vez de armarlos a mano con toFixed. */
@Pipe({ name: 'soles', standalone: true })
export class SolesPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return FORMATO_SOLES.format(valor ?? 0);
  }
}
