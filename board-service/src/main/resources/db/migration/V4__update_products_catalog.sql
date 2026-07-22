ALTER TABLE products RENAME COLUMN emoji TO icon;

DELETE FROM products;

INSERT INTO products (name, description, price, stock, icon) VALUES
('Taza "Bug Free"', 'Cerámica, 350ml. Garantizada libre de bugs (la taza, no tu código)', 15.00, 20, 'cup'),
('Sticker pack "console.log"', '5 stickers de vinilo para tu laptop', 5.00, 50, 'tag'),
('Polo "En mi compu sí funciona"', 'Algodón, talla única', 35.00, 15, 'shirt'),
('Llavero USB decorativo', 'No funciona, es solo de utilería', 8.00, 30, 'key'),
('Mousepad "git commit -m arreglo definitivo (otra vez)"', 'Tamaño XL', 20.00, 10, 'mousepad'),
('Termo "Primero el café, luego hablamos"', 'Acero inoxidable, 500ml', 25.00, 12, 'bottle'),
('Libreta "Ideas geniales a las 2am"', '80 hojas, casi nunca se recuerdan al día siguiente', 12.00, 25, 'notebook'),
('Pin "¿Ya probaste apagar y prender?"', 'El consejo universal de todo soporte técnico', 6.00, 40, 'power'),
('Calcetines "100% libres de bugs"', 'Los pies, no el código', 10.00, 20, 'sock'),
('Funda para laptop "Shh... está compilando"', 'Neopreno, 14 pulgadas', 30.00, 8, 'laptop'),
('Cojín "Modo reunión: cámara apagada"', 'Ideal para el sillón del home office', 18.00, 10, 'cushion'),
('Botella "Hidratación > documentación"', 'Acero inoxidable, 750ml', 22.00, 14, 'bottle');
