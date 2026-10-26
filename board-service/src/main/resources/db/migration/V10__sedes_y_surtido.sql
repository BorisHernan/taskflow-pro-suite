-- Cada sede con su ubicación y su enfoque comercial, y un surtido propio:
-- además del catálogo común, cada tienda vende productos que solo tiene ella.
-- Las direcciones son referenciales (la cadena es ficticia).

ALTER TABLE tiendas ADD COLUMN direccion VARCHAR(160);
ALTER TABLE tiendas ADD COLUMN latitud NUMERIC(9, 6);
ALTER TABLE tiendas ADD COLUMN longitud NUMERIC(9, 6);
ALTER TABLE tiendas ADD COLUMN horario VARCHAR(80);
ALTER TABLE tiendas ADD COLUMN enfoque VARCHAR(200);

UPDATE tiendas SET direccion = 'Av. José Larco 812, Miraflores', latitud = -12.121900, longitud = -77.030000,
    horario = 'Lun a dom · 10:00–22:00',
    enfoque = 'Frente al Parque Kennedy, con mucho público visitante: regalos, ropa y accesorios.'
WHERE codigo = 'T01';

UPDATE tiendas SET direccion = 'Av. Camino Real 348, San Isidro', latitud = -12.097500, longitud = -77.036500,
    horario = 'Lun a sáb · 09:00–20:00',
    enfoque = 'En el centro financiero: tecnología y artículos de oficina para profesionales.'
WHERE codigo = 'T02';

UPDATE tiendas SET direccion = 'Av. Primavera 1050, Santiago de Surco', latitud = -12.110600, longitud = -76.987600,
    horario = 'Lun a dom · 10:00–21:00',
    enfoque = 'Zona residencial: hogar, juegos y productos para la familia.'
WHERE codigo = 'T03';

INSERT INTO products (name, description, price, stock, initial_stock, icon, category, details) VALUES
-- Miraflores: regalos, ropa y accesorios
('Gorra "404 Sleep Not Found"', 'Algodón, ajustable', 45.00, 0, 18, 'cap', 'Ropa',
 'Gorra de algodón con visera curva y ajuste trasero. Para las mañanas después del deploy.'),
('Lentes "Modo oscuro" para el sol', 'Filtro UV400', 59.00, 0, 12, 'glasses', 'Accesorios',
 'Lentes de sol con filtro UV400 y montura liviana. El modo oscuro, ahora también en la calle.'),
('Paraguas "Lluvia de commits"', 'Plegable, 8 varillas', 49.00, 0, 10, 'umbrella', 'Accesorios',
 'Paraguas plegable de ocho varillas, resistente al viento de la Costa Verde.'),
('Caja de regalo "Kit del dev feliz"', 'Taza, stickers y libreta', 79.00, 0, 8, 'gift', 'Accesorios',
 'Caja de regalo con una taza, un pack de stickers y una libreta. Lista para entregar.'),
('Polo "Hecho en Lima con café"', 'Algodón pima', 69.00, 0, 15, 'shirt', 'Ropa',
 'Polo de algodón pima peruano, corte regular. Orgullo local en cada commit.'),
('Postal ilustrada "Miraflores en 8 bits"', 'Set de 4 postales', 18.00, 0, 30, 'map', 'Accesorios',
 'Cuatro postales con vistas de Miraflores dibujadas en pixel art.'),
('Reloj "Siempre es hora de un café"', 'Correa de silicona', 129.00, 0, 6, 'watch', 'Accesorios',
 'Reloj analógico con correa de silicona y caja de acero. Las agujas solo marcan la hora del café.'),
('Bolsa de tela "git add ."', 'Algodón reforzado', 25.00, 0, 25, 'briefcase', 'Accesorios',
 'Bolsa de tela de algodón grueso, con asas reforzadas. Le cabe todo, como al comando.'),
-- San Isidro: tecnología y oficina
('Webcam "Daily en HD"', '1080p con micrófono', 189.00, 0, 8, 'webcam', 'Tecnología',
 'Cámara web Full HD con micrófono doble y tapa de privacidad. Para que te vean en la daily.'),
('Parlante "Build exitoso"', 'Bluetooth, 10 W', 159.00, 0, 7, 'speaker', 'Tecnología',
 'Parlante bluetooth compacto de 10 W con batería para 12 horas.'),
('Router de viaje "Wi-Fi donde sea"', 'Doble banda', 219.00, 0, 5, 'router', 'Tecnología',
 'Router portátil de doble banda para trabajar desde cualquier lugar con red propia.'),
('Soporte para celular "Second screen"', 'Aluminio ajustable', 55.00, 0, 14, 'phone', 'Tecnología',
 'Soporte de aluminio con ángulo ajustable para el celular junto al teclado.'),
('Maletín para laptop "Reunión en 5"', 'Hasta 15 pulgadas', 179.00, 0, 6, 'briefcase', 'Oficina',
 'Maletín acolchado para laptop de hasta 15 pulgadas, con bolsillo para cargador y documentos.'),
('Agenda 2027 "Sprint planning"', 'Semanal, tapa dura', 39.00, 0, 20, 'book', 'Oficina',
 'Agenda semanal con secciones para objetivos del sprint y retrospectivas.'),
('Tijera de oficina "Corta el scope"', 'Acero inoxidable', 15.00, 0, 30, 'scissors', 'Oficina',
 'Tijera de acero inoxidable con mango ergonómico. Para recortar alcance… y papel.'),
('Paleta de colores "Design tokens"', 'Set de marcadores', 35.00, 0, 16, 'palette', 'Oficina',
 'Doce marcadores de colores para pizarras y bocetos de interfaz.'),
-- Surco: hogar y juegos
('Planta "Suculenta de producción"', 'Maceta de cerámica', 32.00, 0, 14, 'flower', 'Hogar',
 'Suculenta en maceta de cerámica. Aguanta todo, como un sistema bien hecho.'),
('Vela aromática "Refactor de lavanda"', '200 g, soya', 38.00, 0, 12, 'flame', 'Hogar',
 'Vela de cera de soya con aroma a lavanda. Cuarenta horas de calma.'),
('Manta "Fin de sprint"', 'Polar, 150 × 200 cm', 89.00, 0, 8, 'blanket', 'Hogar',
 'Manta polar suave para el sofá. Ideal para el viernes después del release.'),
('Set de cocina "Pizza del deploy"', 'Cortador y tabla', 59.00, 0, 10, 'pizza', 'Hogar',
 'Cortador de pizza de acero y tabla de bambú para celebrar cada paso a producción.'),
('Control "Pausa activa"', 'Inalámbrico, PC y consola', 149.00, 0, 9, 'gamepad', 'Juegos',
 'Control inalámbrico compatible con PC y consolas, con batería recargable.'),
('Cartas "Planning poker"', 'Mazo de 55 cartas', 29.00, 0, 20, 'cards', 'Juegos',
 'Mazo de cartas para estimar historias en equipo, con la secuencia de Fibonacci.'),
('Cohete armable "To the moon"', '120 piezas', 99.00, 0, 6, 'rocket', 'Juegos',
 'Cohete de bloques armables de 120 piezas, con base de exhibición.'),
('Juego de mesa "Merge conflict"', '2 a 6 jugadores', 89.00, 0, 7, 'puzzle', 'Juegos',
 'Juego de mesa cooperativo: resuelvan los conflictos antes de que se acabe el sprint.');

-- Surtido por sede: los exclusivos solo existen en su tienda; algunos se comparten.
INSERT INTO inventario (tienda_id, producto_id, stock, stock_minimo, stock_objetivo)
SELECT t.id, p.id, s.stock, GREATEST(2, p.initial_stock / 4), p.initial_stock
FROM (VALUES
    ('Gorra "404 Sleep Not Found"', 'T01', 18),
    ('Lentes "Modo oscuro" para el sol', 'T01', 12),
    ('Paraguas "Lluvia de commits"', 'T01', 10),
    ('Caja de regalo "Kit del dev feliz"', 'T01', 8),
    ('Caja de regalo "Kit del dev feliz"', 'T03', 5),
    ('Polo "Hecho en Lima con café"', 'T01', 15),
    ('Postal ilustrada "Miraflores en 8 bits"', 'T01', 30),
    ('Reloj "Siempre es hora de un café"', 'T01', 6),
    ('Reloj "Siempre es hora de un café"', 'T02', 3),
    ('Bolsa de tela "git add ."', 'T01', 25),
    ('Webcam "Daily en HD"', 'T02', 8),
    ('Parlante "Build exitoso"', 'T02', 7),
    ('Parlante "Build exitoso"', 'T03', 4),
    ('Router de viaje "Wi-Fi donde sea"', 'T02', 5),
    ('Soporte para celular "Second screen"', 'T02', 14),
    ('Soporte para celular "Second screen"', 'T01', 6),
    ('Maletín para laptop "Reunión en 5"', 'T02', 6),
    ('Agenda 2027 "Sprint planning"', 'T02', 20),
    ('Tijera de oficina "Corta el scope"', 'T02', 30),
    ('Paleta de colores "Design tokens"', 'T02', 16),
    ('Planta "Suculenta de producción"', 'T03', 14),
    ('Vela aromática "Refactor de lavanda"', 'T03', 12),
    ('Vela aromática "Refactor de lavanda"', 'T01', 5),
    ('Manta "Fin de sprint"', 'T03', 8),
    ('Set de cocina "Pizza del deploy"', 'T03', 10),
    ('Control "Pausa activa"', 'T03', 9),
    ('Cartas "Planning poker"', 'T03', 20),
    ('Cartas "Planning poker"', 'T02', 10),
    ('Cohete armable "To the moon"', 'T03', 6),
    ('Juego de mesa "Merge conflict"', 'T03', 7)
) AS s (producto, codigo, stock)
JOIN products p ON p.name = s.producto
JOIN tiendas t ON t.codigo = s.codigo;

-- products.stock es la suma de las sedes (referencial); el stock que manda vive en inventario.
UPDATE products p SET stock = COALESCE((SELECT SUM(i.stock) FROM inventario i WHERE i.producto_id = p.id), 0);
