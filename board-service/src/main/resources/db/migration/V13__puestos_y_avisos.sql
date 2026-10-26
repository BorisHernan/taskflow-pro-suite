-- Dónde está cada persona dentro de la tienda (caja, entrada, pasillos…) y su día libre de la semana.
ALTER TABLE empleados ADD COLUMN puesto_actual VARCHAR(20)
    CHECK (puesto_actual IN ('CAJA_1', 'CAJA_2', 'CAJA_3', 'CAJA_4', 'CAJA_5', 'ENTRADA', 'PASILLOS', 'ALMACEN', 'DESPACHO'));
ALTER TABLE empleados ADD COLUMN puesto_desde TIMESTAMP;
-- 1 = lunes … 7 = domingo.
ALTER TABLE empleados ADD COLUMN dia_libre SMALLINT CHECK (dia_libre BETWEEN 1 AND 7);

-- "No vino" (falta sin aviso) también es una ausencia.
ALTER TABLE empleados DROP CONSTRAINT empleados_disponibilidad_check;
ALTER TABLE empleados ADD CONSTRAINT empleados_disponibilidad_check
    CHECK (disponibilidad IN ('ACTIVO', 'DESCANSO_MEDICO', 'VACACIONES', 'PERMISO', 'DESCANSO', 'FALTA'));

-- Cada persona descansa un día distinto de la semana.
UPDATE empleados SET dia_libre = ((id * 3) % 7) + 1;

-- Puesto habitual de cada uno: cajeros a las cajas, reponedores a pasillos, etc.
UPDATE empleados e SET puesto_actual = x.puesto
FROM (SELECT id,
             CASE puesto
                 WHEN 'CAJERO' THEN 'CAJA_' || ROW_NUMBER() OVER (PARTITION BY tienda_id, turno, puesto ORDER BY id)
                 WHEN 'REPONEDOR' THEN 'PASILLOS'
                 WHEN 'ALMACENERO' THEN 'ALMACEN'
                 ELSE 'DESPACHO'
             END AS puesto
      FROM empleados) x
WHERE e.id = x.id;

-- Avisos al personal: qué debe hacer cada uno (asignaciones de puesto y de órdenes).
CREATE TABLE avisos_personal (
    id          BIGSERIAL PRIMARY KEY,
    tienda_id   BIGINT       NOT NULL REFERENCES tiendas(id),
    empleado_id BIGINT       REFERENCES empleados(id),
    mensaje     VARCHAR(240) NOT NULL,
    creado_en   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_avisos_personal_tienda ON avisos_personal (tienda_id, creado_en DESC);
