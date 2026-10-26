-- Pedidos de la tienda online: una orden por compra, con su modalidad de
-- entrega y su estado. La tienda la prepara y la entrega; el cliente la sigue
-- con su código. Las líneas siguen en purchases (historial de ventas).

CREATE TABLE ordenes (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(12) NOT NULL UNIQUE,
    tienda_id BIGINT NOT NULL REFERENCES tiendas (id),
    cliente_nombre VARCHAR(80) NOT NULL,
    modalidad VARCHAR(10) NOT NULL CHECK (modalidad IN ('RECOJO', 'ENVIO')),
    direccion VARCHAR(200),
    latitud NUMERIC(9, 6),
    longitud NUMERIC(9, 6),
    distancia_km NUMERIC(6, 2),
    subtotal NUMERIC(10, 2) NOT NULL,
    descuento NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL,
    cupon VARCHAR(20),
    estado VARCHAR(12) NOT NULL DEFAULT 'RECIBIDA'
        CHECK (estado IN ('RECIBIDA', 'PREPARANDO', 'LISTA', 'EN_CAMINO', 'ENTREGADA', 'CANCELADA')),
    tarea_id BIGINT REFERENCES tasks (id) ON DELETE SET NULL,
    creada_en TIMESTAMP NOT NULL DEFAULT now(),
    actualizada_en TIMESTAMP NOT NULL DEFAULT now(),
    CHECK (modalidad = 'RECOJO' OR (latitud IS NOT NULL AND longitud IS NOT NULL))
);

CREATE INDEX idx_ordenes_tienda ON ordenes (tienda_id, estado, creada_en);

ALTER TABLE purchases ADD COLUMN orden_id BIGINT REFERENCES ordenes (id);
CREATE INDEX idx_purchases_orden ON purchases (orden_id);
