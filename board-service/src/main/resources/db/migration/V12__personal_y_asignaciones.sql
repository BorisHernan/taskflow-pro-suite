-- Personal de cada sede: quién trabaja, en qué turno y si está disponible.
CREATE TABLE empleados (
    id             BIGSERIAL PRIMARY KEY,
    tienda_id      BIGINT       NOT NULL REFERENCES tiendas(id),
    nombre         VARCHAR(80)  NOT NULL,
    puesto         VARCHAR(20)  NOT NULL CHECK (puesto IN ('REPONEDOR', 'CAJERO', 'REPARTIDOR', 'ALMACENERO')),
    turno          VARCHAR(10)  NOT NULL CHECK (turno IN ('MANANA', 'TARDE', 'NOCHE')),
    -- ACTIVO o el motivo de la ausencia.
    disponibilidad VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO'
        CHECK (disponibilidad IN ('ACTIVO', 'DESCANSO_MEDICO', 'VACACIONES', 'PERMISO', 'DESCANSO')),
    motivo         VARCHAR(200),
    ausente_desde  DATE,
    ausente_hasta  DATE
);

CREATE INDEX idx_empleados_tienda ON empleados (tienda_id);

-- Stock en el almacén de la tienda (trastienda): de aquí sale la reposición del piso de venta.
ALTER TABLE inventario ADD COLUMN almacen INT NOT NULL DEFAULT 0 CHECK (almacen >= 0);
UPDATE inventario SET almacen = CASE WHEN producto_id % 4 = 0 THEN 0 ELSE stock_objetivo END;

-- A quién se asignó la tarea, cuándo y cuánto debería tardar.
ALTER TABLE tasks ADD COLUMN empleado_id BIGINT REFERENCES empleados(id);
ALTER TABLE tasks ADD COLUMN asignada_en TIMESTAMP;
ALTER TABLE tasks ADD COLUMN minutos_estimados INT;
CREATE INDEX idx_tasks_empleado ON tasks (empleado_id) WHERE status = 'IN_PROGRESS';

ALTER TABLE pedidos ADD COLUMN solicitado_por_empleado BIGINT REFERENCES empleados(id);

-- Plantilla de cada sede.
INSERT INTO empleados (tienda_id, nombre, puesto, turno)
SELECT t.id, e.nombre, e.puesto, e.turno
FROM tiendas t
JOIN (VALUES
    ('T01', 'Rosa Huamán',      'REPONEDOR',  'MANANA'),
    ('T01', 'Diego Flores',     'REPONEDOR',  'MANANA'),
    ('T01', 'Kevin Mamani',     'REPONEDOR',  'TARDE'),
    ('T01', 'Lucía Torres',     'REPONEDOR',  'TARDE'),
    ('T01', 'Jhon Paredes',     'REPONEDOR',  'NOCHE'),
    ('T01', 'Andrea Salas',     'CAJERO',     'MANANA'),
    ('T01', 'Miguel Ríos',      'CAJERO',     'TARDE'),
    ('T01', 'Paola Quispe',     'CAJERO',     'TARDE'),
    ('T01', 'Renzo Vargas',     'REPARTIDOR', 'MANANA'),
    ('T01', 'Bruno Castillo',   'REPARTIDOR', 'TARDE'),
    ('T01', 'Elena Cárdenas',   'ALMACENERO', 'MANANA'),
    ('T01', 'Óscar Benites',    'ALMACENERO', 'TARDE'),
    ('T02', 'Gabriela Ramos',   'REPONEDOR',  'MANANA'),
    ('T02', 'Luis Chávez',      'REPONEDOR',  'MANANA'),
    ('T02', 'Fiorella Medina',  'REPONEDOR',  'TARDE'),
    ('T02', 'Sergio Aguilar',   'REPONEDOR',  'TARDE'),
    ('T02', 'Walter Ccama',     'REPONEDOR',  'NOCHE'),
    ('T02', 'Valeria León',     'CAJERO',     'MANANA'),
    ('T02', 'Hugo Navarro',     'CAJERO',     'TARDE'),
    ('T02', 'Camila Rojas',     'CAJERO',     'TARDE'),
    ('T02', 'Iván Soto',        'REPARTIDOR', 'MANANA'),
    ('T02', 'Pedro Gutiérrez',  'REPARTIDOR', 'TARDE'),
    ('T02', 'Milagros Vega',    'ALMACENERO', 'MANANA'),
    ('T02', 'César Romero',     'ALMACENERO', 'TARDE'),
    ('T03', 'Jorge Palomino',   'REPONEDOR',  'MANANA'),
    ('T03', 'Karen Espinoza',   'REPONEDOR',  'MANANA'),
    ('T03', 'Alex Huerta',      'REPONEDOR',  'TARDE'),
    ('T03', 'Daniela Campos',   'REPONEDOR',  'TARDE'),
    ('T03', 'Raúl Inga',        'REPONEDOR',  'NOCHE'),
    ('T03', 'Sofía Mendoza',    'CAJERO',     'MANANA'),
    ('T03', 'Manuel Ortiz',     'CAJERO',     'TARDE'),
    ('T03', 'Patricia Lozano',  'CAJERO',     'TARDE'),
    ('T03', 'Enzo Delgado',     'REPARTIDOR', 'MANANA'),
    ('T03', 'Ricardo Fuentes',  'REPARTIDOR', 'TARDE'),
    ('T03', 'Natalia Pérez',    'ALMACENERO', 'MANANA'),
    ('T03', 'Gustavo Silva',    'ALMACENERO', 'TARDE')
) AS e(codigo, nombre, puesto, turno) ON e.codigo = t.codigo;

-- Algunas ausencias para que la plantilla se vea real.
UPDATE empleados SET disponibilidad = 'DESCANSO_MEDICO', motivo = 'Gripe, con certificado médico', ausente_desde = CURRENT_DATE
WHERE nombre = 'Manuel Ortiz';
UPDATE empleados SET disponibilidad = 'VACACIONES', motivo = 'Vacaciones programadas', ausente_desde = CURRENT_DATE
WHERE nombre = 'Karen Espinoza';
UPDATE empleados SET disponibilidad = 'PERMISO', motivo = 'Trámite personal', ausente_desde = CURRENT_DATE
WHERE nombre = 'Bruno Castillo';
UPDATE empleados SET disponibilidad = 'DESCANSO', motivo = 'Día libre de la semana', ausente_desde = CURRENT_DATE
WHERE nombre = 'Walter Ccama';
