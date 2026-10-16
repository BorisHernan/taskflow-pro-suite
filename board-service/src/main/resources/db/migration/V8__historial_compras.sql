-- Cada compra queda guardada para siempre: alimenta los gráficos de estadísticas.
-- Nombre y categoría se copian para que el historial no cambie si el producto se edita.
CREATE TABLE purchases (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products (id) ON DELETE SET NULL,
    product_name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    total NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchases_created_at ON purchases (created_at);
