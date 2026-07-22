CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    emoji VARCHAR(8)
);

INSERT INTO products (name, description, price, stock, emoji) VALUES
('Taza "Bug Free"', 'Cerámica, 350ml. Garantizada libre de bugs (la taza, no tu código)', 15.00, 20, '☕'),
('Sticker pack "console.log"', '5 stickers de vinilo para tu laptop', 5.00, 50, '🏷️'),
('Polo "It works on my machine"', 'Algodón, talla única', 35.00, 15, '👕'),
('Llavero USB decorativo', 'No funciona, es solo de utilería', 8.00, 30, '🔑'),
('Mousepad "git commit -m fix"', 'Tamaño XL', 20.00, 10, '🖱️'),
('Termo "Café o muerte"', 'Acero inoxidable, 500ml', 25.00, 12, '🥤');
