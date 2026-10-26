import { HttpParams } from '@angular/common/http';
import { DemoBackend } from './demo-backend.service';
import { Empleado, FilaInventario, Tienda } from '../../models/gestion.model';
import { Task, TaskEvent } from '../../models/task.model';

const fila = (productoId: number, stock: number, almacen: number): FilaInventario =>
  ({ id: productoId, tiendaId: 3, productoId, producto: `P${productoId}`, categoria: 'Hogar', icono: 'gift', precio: 10, stock, stockMinimo: 2, stockObjetivo: 10, almacen, estado: 'OK', pedidoEnCurso: false }) as FilaInventario;
const persona = (id: number, puesto: string, turno = 'TARDE'): Empleado =>
  ({ id, tiendaId: 3, nombre: `Persona ${id}`, puesto, turno, horario: '15:00–23:00', estado: 'FUERA_DE_TURNO', disponibilidad: 'ACTIVO', avanceTurno: 0 }) as Empleado;

describe('DemoBackend (sede de prueba)', () => {
  let demo: DemoBackend;
  const p = new HttpParams();
  const pedir = <T>(metodo: string, ruta: string, cuerpo?: unknown) => demo.atender(metodo, ruta, cuerpo, p) as T;

  beforeEach(() => {
    demo = new DemoBackend();
    demo.iniciar({
      tienda: { id: 3, codigo: 'T03', nombre: 'Tienda Surco', distrito: 'Surco' } as Tienda,
      inventario: [fila(1, 3, 20), fila(2, 10, 0)],
      personal: [persona(10, 'REPONEDOR'), persona(11, 'CAJERO', 'MANANA')],
      usuario: 'surco',
    });
  });

  afterEach(() => demo.detener());

  it('empieza en blanco: stock al día, sin tareas, y el turno tarde disponible', () => {
    expect(pedir<FilaInventario[]>('GET', '/api/inventario').every((f) => f.estado === 'OK')).toBe(true);
    expect(pedir<Task[]>('GET', '/api/tasks')).toEqual([]);
    expect(pedir<Empleado[]>('GET', '/api/personal').map((e) => e.estado)).toEqual(['DISPONIBLE', 'FUERA_DE_TURNO']);
  });

  it('una venta al mínimo abre la alerta y asignarla avisa a la persona', () => {
    const eventos: TaskEvent[] = [];
    demo.eventos$.subscribe((e) => eventos.push(e));

    pedir('POST', '/api/products/1/purchase', { quantity: 8 });
    const [alerta] = pedir<Task[]>('GET', '/api/tasks');
    expect(alerta).toMatchObject({ tipo: 'REPOSICION', productoId: 1, status: 'TODO' });
    expect(eventos[0].type).toBe('CREATED');

    pedir('POST', `/api/tasks/${alerta.id}/asignar`, { empleadoId: 10, rapido: true });
    expect(pedir<Empleado[]>('GET', '/api/personal')[0].estado).toBe('TRABAJANDO');
    expect(pedir<{ mensaje: string }[]>('GET', '/api/personal/avisos')[0].mensaje).toContain('tienes la orden');
  });

  it('un robo registra la merma y abre una incidencia de seguridad', () => {
    pedir('POST', '/api/mermas', { productoId: 2, cantidad: 1, motivo: 'ROBO' });

    expect(pedir<unknown[]>('GET', '/api/mermas')).toHaveLength(1);
    expect(pedir<{ categoria: string }[]>('GET', '/api/incidencias')[0].categoria).toBe('SEGURIDAD');
  });

  it('lo que no es de la sede (o con la demo apagada) va al servidor real', () => {
    expect(pedir('GET', '/api/tiendas')).toBeUndefined();
    demo.detener();
    expect(demo.activo()).toBe(false);
  });
});
