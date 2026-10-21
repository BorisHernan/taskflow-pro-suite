-- Gestión de tiendas: sedes, usuarios con rol, inventario por sede y los
-- registros del día a día (mermas, incidencias, turnos y pedidos de reposición).
-- El tablero pasa a ser la bandeja de tareas de cada tienda.

CREATE TABLE tiendas (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    nombre VARCHAR(80) NOT NULL,
    distrito VARCHAR(60) NOT NULL
);

INSERT INTO tiendas (codigo, nombre, distrito) VALUES
('T01', 'Tienda Miraflores', 'Miraflores'),
('T02', 'Tienda San Isidro', 'San Isidro'),
('T03', 'Tienda Surco', 'Santiago de Surco');

-- Las claves se cargan al arrancar (UsuariosDemo) para no dejar hashes en el SQL.
CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    usuario VARCHAR(40) NOT NULL UNIQUE,
    nombre VARCHAR(80) NOT NULL,
    clave_hash VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('ADMIN', 'TIENDA')),
    tienda_id BIGINT REFERENCES tiendas (id),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (rol = 'ADMIN' OR tienda_id IS NOT NULL)
);

-- Stock por sede. stock_minimo dispara la alerta; stock_objetivo es lo que se sugiere reponer.
CREATE TABLE inventario (
    id BIGSERIAL PRIMARY KEY,
    tienda_id BIGINT NOT NULL REFERENCES tiendas (id),
    producto_id BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    stock INT NOT NULL CHECK (stock >= 0),
    stock_minimo INT NOT NULL CHECK (stock_minimo >= 0),
    stock_objetivo INT NOT NULL CHECK (stock_objetivo > 0),
    actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (tienda_id, producto_id)
);

-- Miraflores arranca con el stock actual de la tienda online; las otras dos con niveles distintos.
INSERT INTO inventario (tienda_id, producto_id, stock, stock_minimo, stock_objetivo)
SELECT t.id,
       p.id,
       CASE t.codigo
           WHEN 'T01' THEN p.stock
           WHEN 'T02' THEN GREATEST(0, COALESCE(p.initial_stock, p.stock) - (p.id % 4) * 2)
           ELSE CASE WHEN p.id % 5 = 0 THEN p.id % 3 ELSE COALESCE(p.initial_stock, p.stock) END
       END,
       GREATEST(2, COALESCE(p.initial_stock, p.stock, 8) / 4),
       GREATEST(4, COALESCE(p.initial_stock, p.stock, 8))
FROM tiendas t
CROSS JOIN products p;

CREATE TABLE turnos (
    id BIGSERIAL PRIMARY KEY,
    tienda_id BIGINT NOT NULL REFERENCES tiendas (id),
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('MANANA', 'TARDE', 'NOCHE')),
    responsable VARCHAR(80) NOT NULL,
    estado VARCHAR(10) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
    nota_apertura TEXT,
    nota_cierre TEXT,
    abierto_por VARCHAR(40) NOT NULL,
    cerrado_por VARCHAR(40),
    inicio TIMESTAMP NOT NULL DEFAULT now(),
    fin TIMESTAMP
);

-- Un solo turno abierto por tienda.
CREATE UNIQUE INDEX ux_turno_abierto ON turnos (tienda_id) WHERE estado = 'ABIERTO';

ALTER TABLE tasks ADD COLUMN tienda_id BIGINT REFERENCES tiendas (id);
ALTER TABLE tasks ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE tasks ADD COLUMN prioridad VARCHAR(10) NOT NULL DEFAULT 'MEDIA';
ALTER TABLE tasks ADD COLUMN producto_id BIGINT REFERENCES products (id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN referencia_id BIGINT;
ALTER TABLE tasks ADD COLUMN turno_id BIGINT REFERENCES turnos (id);
ALTER TABLE tasks ADD COLUMN creado_por VARCHAR(40);
ALTER TABLE tasks ADD COLUMN asignado_a VARCHAR(80);
ALTER TABLE tasks ADD COLUMN cerrada_en TIMESTAMP;

-- Nunca dos tareas de reposición abiertas para el mismo producto en la misma tienda.
CREATE UNIQUE INDEX ux_tarea_reposicion_abierta ON tasks (tienda_id, producto_id)
    WHERE tipo = 'REPOSICION' AND status <> 'DONE';
CREATE INDEX idx_tasks_tienda ON tasks (tienda_id, status);

-- Las ventas históricas fueron de la tienda online, que ahora es Miraflores.
ALTER TABLE purchases ADD COLUMN tienda_id BIGINT REFERENCES tiendas (id);
ALTER TABLE purchases ADD COLUMN turno_id BIGINT REFERENCES turnos (id);
UPDATE purchases SET tienda_id = (SELECT id FROM tiendas WHERE codigo = 'T01');
ALTER TABLE purchases ALTER COLUMN tienda_id SET NOT NULL;
CREATE INDEX idx_purchases_tienda ON purchases (tienda_id, created_at);

CREATE TABLE mermas (
    id BIGSERIAL PRIMARY KEY,
    tienda_id BIGINT NOT NULL REFERENCES tiendas (id),
    producto_id BIGINT REFERENCES products (id) ON DELETE SET NULL,
    producto_nombre VARCHAR(120) NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    motivo VARCHAR(20) NOT NULL CHECK (motivo IN ('DANADO', 'VENCIDO', 'ROBO', 'ERROR_INVENTARIO', 'OTRO')),
    costo NUMERIC(10, 2) NOT NULL,
    nota TEXT,
    turno_id BIGINT REFERENCES turnos (id),
    registrado_por VARCHAR(40) NOT NULL,
    creada_en TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_mermas_tienda ON mermas (tienda_id, creada_en);

CREATE TABLE incidencias (
    id BIGSERIAL PRIMARY KEY,
    tienda_id BIGINT NOT NULL REFERENCES tiendas (id),
    titulo VARCHAR(160) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('EQUIPOS', 'LIMPIEZA', 'SEGURIDAD', 'CLIENTE', 'SISTEMAS', 'OTRO')),
    severidad VARCHAR(10) NOT NULL CHECK (severidad IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')),
    estado VARCHAR(10) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'EN_CURSO', 'RESUELTA')),
    solucion TEXT,
    tarea_id BIGINT REFERENCES tasks (id) ON DELETE SET NULL,
    turno_id BIGINT REFERENCES turnos (id),
    reportada_por VARCHAR(40) NOT NULL,
    creada_en TIMESTAMP NOT NULL DEFAULT now(),
    resuelta_en TIMESTAMP
);
CREATE INDEX idx_incidencias_tienda ON incidencias (tienda_id, estado);

-- Compras de la tienda al almacén central: la tienda pide, el administrador aprueba y la tienda recibe.
CREATE TABLE pedidos (
    id BIGSERIAL PRIMARY KEY,
    tienda_id BIGINT NOT NULL REFERENCES tiendas (id),
    producto_id BIGINT NOT NULL REFERENCES products (id),
    producto_nombre VARCHAR(120) NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    costo NUMERIC(10, 2) NOT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'SOLICITADO' CHECK (estado IN ('SOLICITADO', 'APROBADO', 'RECIBIDO', 'RECHAZADO')),
    nota TEXT,
    tarea_id BIGINT REFERENCES tasks (id) ON DELETE SET NULL,
    solicitado_por VARCHAR(40) NOT NULL,
    revisado_por VARCHAR(40),
    creado_en TIMESTAMP NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_pedidos_tienda ON pedidos (tienda_id, estado);

-- Alertas iniciales: lo que ya está bajo el mínimo tiene su tarea de reposición.
INSERT INTO tasks (title, description, status, position, tienda_id, tipo, prioridad, producto_id, creado_por, created_at, updated_at)
SELECT 'Reponer ' || p.name,
       CASE i.stock WHEN 0 THEN 'Agotado' WHEN 1 THEN 'Queda 1 unidad' ELSE 'Quedan ' || i.stock || ' unidades' END
           || ' (mínimo ' || i.stock_minimo || '). Sugerido: pedir ' || (i.stock_objetivo - i.stock) || '.',
       'TODO',
       ROW_NUMBER() OVER (PARTITION BY i.tienda_id ORDER BY i.stock, p.id),
       i.tienda_id,
       'REPOSICION',
       CASE WHEN i.stock = 0 THEN 'CRITICA' ELSE 'ALTA' END,
       p.id,
       'sistema',
       now(),
       now()
FROM inventario i
JOIN products p ON p.id = i.producto_id
WHERE i.stock <= i.stock_minimo;

-- Algo de historia para que cada tienda no arranque vacía.
INSERT INTO turnos (tienda_id, tipo, responsable, estado, nota_apertura, nota_cierre, abierto_por, cerrado_por, inicio, fin)
SELECT id, 'MANANA', 'Equipo de apertura', 'CERRADO', 'Caja inicial S/ 200.', 'Sin novedades. Caja cuadrada.',
       'sistema', 'sistema', CURRENT_DATE - 1 + TIME '08:00', CURRENT_DATE - 1 + TIME '15:00'
FROM tiendas;

INSERT INTO incidencias (tienda_id, titulo, descripcion, categoria, severidad, estado, solucion, reportada_por, creada_en, resuelta_en)
SELECT t.id, x.titulo, x.descripcion, x.categoria, x.severidad, x.estado, x.solucion, 'sistema',
       now() - x.hace, CASE WHEN x.estado = 'RESUELTA' THEN now() - x.hace + INTERVAL '3 hours' END
FROM tiendas t
JOIN (VALUES
    ('T01', 'Impresora de boletas atasca el papel', 'La caja 2 imprime cortado desde la mañana.', 'EQUIPOS', 'MEDIA', 'ABIERTA', NULL, INTERVAL '5 hours'),
    ('T02', 'Derrame en el pasillo 3', 'Se cayó una botella; zona señalizada.', 'LIMPIEZA', 'BAJA', 'RESUELTA', 'Limpieza realizada y piso seco.', INTERVAL '2 days'),
    ('T03', 'Alarma de la puerta suena sin motivo', 'Suena al pasar clientes sin productos.', 'SEGURIDAD', 'ALTA', 'EN_CURSO', NULL, INTERVAL '1 day')
) AS x (codigo, titulo, descripcion, categoria, severidad, estado, solucion, hace) ON x.codigo = t.codigo;

INSERT INTO mermas (tienda_id, producto_id, producto_nombre, cantidad, motivo, costo, nota, registrado_por, creada_en)
SELECT i.tienda_id, p.id, p.name, 1 + (p.id % 2), m.motivo, p.price * (1 + (p.id % 2)), m.nota, 'sistema', now() - m.hace
FROM inventario i
JOIN products p ON p.id = i.producto_id
JOIN (VALUES
    (0, 'DANADO', 'Empaque roto en la recepción.', INTERVAL '6 days'),
    (1, 'ERROR_INVENTARIO', 'Diferencia en el conteo semanal.', INTERVAL '3 days'),
    (2, 'VENCIDO', 'Promoción vencida, retirado de góndola.', INTERVAL '1 day')
) AS m (resto, motivo, nota, hace) ON p.id % 7 = m.resto
WHERE p.id <= 12;

INSERT INTO pedidos (tienda_id, producto_id, producto_nombre, cantidad, costo, estado, nota, solicitado_por, creado_en, actualizado_en)
SELECT i.tienda_id, p.id, p.name, i.stock_objetivo - i.stock, p.price * 0.6 * (i.stock_objetivo - i.stock), 'SOLICITADO',
       'Pedido de ejemplo pendiente de aprobación.', 'sistema', now() - INTERVAL '2 hours', now() - INTERVAL '2 hours'
FROM inventario i
JOIN products p ON p.id = i.producto_id
JOIN tiendas t ON t.id = i.tienda_id
WHERE t.codigo = 'T03' AND i.stock < i.stock_objetivo
ORDER BY i.stock
LIMIT 2;

-- Esas tareas ya tienen pedido: pasan a "En progreso" y quedan enlazadas.
UPDATE tasks t SET status = 'IN_PROGRESS'
FROM pedidos pe
WHERE t.tipo = 'REPOSICION' AND t.tienda_id = pe.tienda_id AND t.producto_id = pe.producto_id;
UPDATE pedidos pe SET tarea_id = t.id
FROM tasks t
WHERE t.tipo = 'REPOSICION' AND t.tienda_id = pe.tienda_id AND t.producto_id = pe.producto_id;

-- Tareas de rutina de cada tienda.
INSERT INTO tasks (title, description, status, position, tienda_id, tipo, prioridad, creado_por, created_at, updated_at)
SELECT x.titulo, x.descripcion, x.estado, 100 + x.orden, t.id, 'MANUAL', x.prioridad, 'sistema', now(), now()
FROM tiendas t
CROSS JOIN (VALUES
    (1, 'Cambiar precios de la campaña', 'Etiquetas nuevas para la vitrina principal.', 'TODO', 'MEDIA'),
    (2, 'Inventario cíclico de Accesorios', 'Contar y comparar con el sistema.', 'IN_PROGRESS', 'BAJA'),
    (3, 'Capacitar al nuevo cajero', 'Uso del POS y arqueo de caja.', 'DONE', 'MEDIA')
) AS x (orden, titulo, descripcion, estado, prioridad);
