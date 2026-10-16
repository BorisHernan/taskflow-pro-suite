-- Catálogo tipo tienda: categoría, detalle largo y stock inicial guardado en
-- la tabla (el reset diario repone a este valor, en vez de a una lista fija
-- escrita en el código). Más productos y reseñas de los visitantes.

-- icon nació como emoji VARCHAR(8): las claves nuevas (p. ej. 'headphones') no entran.
ALTER TABLE products ALTER COLUMN icon TYPE VARCHAR(40);

ALTER TABLE products ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT 'Accesorios';
ALTER TABLE products ADD COLUMN details TEXT;
ALTER TABLE products ADD COLUMN initial_stock INT;

UPDATE products SET category = 'Hogar', initial_stock = 20,
  details = 'Taza de cerámica esmaltada de 350 ml, apta para microondas y lavavajillas. Ideal para el café de la daily.'
  WHERE name = 'Taza "Bug Free"';
UPDATE products SET category = 'Accesorios', initial_stock = 50,
  details = 'Cinco stickers de vinilo resistentes al agua, con acabado mate. Pegan en laptops, termos y monitores.'
  WHERE name = 'Sticker pack "console.log"';
UPDATE products SET category = 'Ropa', initial_stock = 15,
  details = 'Polo de algodón peinado 100 %, corte unisex. La frase que todo QA ha escuchado alguna vez.'
  WHERE name = 'Polo "En mi compu sí funciona"';
UPDATE products SET category = 'Accesorios', initial_stock = 30,
  details = 'Llavero metálico con forma de memoria USB. No guarda archivos, pero sí tus llaves.'
  WHERE name = 'Llavero USB decorativo';
UPDATE products SET category = 'Oficina', initial_stock = 10,
  details = 'Mousepad XL de 80 × 30 cm con base antideslizante y bordes cosidos. Entra el teclado y el mouse.'
  WHERE name LIKE 'Mousepad "git commit%';
UPDATE products SET category = 'Hogar', initial_stock = 12,
  details = 'Termo de acero inoxidable de doble pared: mantiene el café caliente 12 horas, o lo que dure la reunión.'
  WHERE name = 'Termo "Primero el café, luego hablamos"';
UPDATE products SET category = 'Oficina', initial_stock = 25,
  details = 'Libreta A5 de 80 hojas punteadas, tapa dura. Para anotar la idea antes de que se olvide.'
  WHERE name = 'Libreta "Ideas geniales a las 2am"';
UPDATE products SET category = 'Accesorios', initial_stock = 40,
  details = 'Pin metálico esmaltado con el consejo universal de todo soporte técnico.'
  WHERE name = 'Pin "¿Ya probaste apagar y prender?"';
UPDATE products SET category = 'Ropa', initial_stock = 20,
  details = 'Par de calcetines de algodón con estampado de pequeños bichitos. Talla única.'
  WHERE name = 'Calcetines "100% libres de bugs"';
UPDATE products SET category = 'Tecnología', initial_stock = 8,
  details = 'Funda de neopreno para laptops de hasta 14 pulgadas, con bolsillo para el cargador.'
  WHERE name = 'Funda para laptop "Shh... está compilando"';
UPDATE products SET category = 'Hogar', initial_stock = 10,
  details = 'Cojín de 45 × 45 cm con relleno de microfibra. Para el sillón del home office.'
  WHERE name = 'Cojín "Modo reunión: cámara apagada"';
UPDATE products SET category = 'Hogar', initial_stock = 14,
  details = 'Botella de acero inoxidable de 750 ml con tapa a rosca. Porque hidratarse también es documentación.'
  WHERE name = 'Botella "Hidratación > documentación"';

INSERT INTO products (name, description, price, stock, initial_stock, icon, category, details) VALUES
('Hoodie "Deploy los viernes"', 'Algodón frizado, con capucha', 89.00, 6, 6, 'shirt', 'Ropa',
 'Polerón de algodón frizado con capucha y bolsillo canguro. Para los valientes que despliegan en viernes.'),
('Pijama "Modo oscuro activado"', 'Dos piezas, algodón', 69.00, 9, 9, 'moon', 'Ropa',
 'Pijama de dos piezas en algodón suave, color negro absoluto. Ahorra batería mientras duermes.'),
('Polo "Funciona en producción... a veces"', 'Algodón, corte oversize', 39.00, 18, 18, 'shirt', 'Ropa',
 'Polo oversize de algodón con la frase más honesta de cualquier release.'),
('Mochila "Todo mi entorno local"', '20 litros, compartimento acolchado', 129.00, 5, 5, 'backpack', 'Accesorios',
 'Mochila de 20 litros con compartimento acolchado para laptop de 15 pulgadas y bolsillo para cargadores.'),
('Teclado mecánico "Clicky McClickface"', 'Switches azules, retroiluminado', 189.00, 4, 4, 'keyboard', 'Tecnología',
 'Teclado mecánico de 87 teclas con switches azules y retroiluminación. Tus compañeros de oficina lo van a escuchar.'),
('Audífonos "Modo concentración"', 'Cancelación de ruido, Bluetooth', 249.00, 7, 7, 'headphones', 'Tecnología',
 'Audífonos inalámbricos con cancelación activa de ruido y 30 horas de batería. El "no molestar" físico.'),
('Mouse inalámbrico "Ctrl+Z físico"', 'Ergonómico, 6 botones', 79.00, 15, 15, 'mouse', 'Tecnología',
 'Mouse ergonómico inalámbrico de seis botones programables. Lástima que no deshace los deploys.'),
('Cable USB-C "El que sí carga"', 'Trenzado, 2 metros', 25.00, 40, 40, 'cable', 'Tecnología',
 'Cable USB-C trenzado de 2 metros con carga rápida de 100 W. El que nunca está cuando lo necesitas.'),
('Hub USB "Más puertos que microservicios"', '7 en 1, HDMI 4K', 119.00, 6, 6, 'usb', 'Tecnología',
 'Hub USB-C 7 en 1 con HDMI 4K, lector de tarjetas y tres puertos USB-A. Casi tantos puertos como tus servicios.'),
('Monitor portátil "Segunda pantalla para Stack Overflow"', '15,6 pulgadas, Full HD', 459.00, 3, 3, 'monitor', 'Tecnología',
 'Monitor portátil de 15,6 pulgadas Full HD que se conecta con un solo cable USB-C. Funda incluida.'),
('Power bank "Batería para el on-call"', '20 000 mAh, carga rápida', 99.00, 11, 11, 'battery', 'Tecnología',
 'Batería externa de 20 000 mAh con carga rápida. Para cuando te llaman a las 3 a. m. y no hay enchufe.'),
('Lámpara de escritorio "Debug nocturno"', 'LED regulable, 3 tonos', 85.00, 9, 9, 'lamp', 'Oficina',
 'Lámpara LED con brazo articulado, tres tonos de luz y cinco niveles de brillo. Para depurar sin forzar la vista.'),
('Agenda "Sprints y otras mentiras"', 'Planner semanal 2026', 35.00, 22, 22, 'calendar', 'Oficina',
 'Planner semanal con páginas para planificar sprints, retrospectivas y estimaciones que no se cumplirán.'),
('Set de lapiceros "Pseudocódigo"', '4 colores, punta fina', 15.00, 35, 35, 'pen', 'Oficina',
 'Cuatro lapiceros de punta fina de 0,5 mm en colores distintos, para diagramas en la pizarra.'),
('Post-its "TODO: refactorizar"', '6 blocks de 100 hojas', 18.00, 28, 28, 'sticky', 'Oficina',
 'Seis blocks de notas adhesivas de colores. Cada TODO merece su propio papelito.'),
('Soporte para laptop "Postura > bugs"', 'Aluminio, altura regulable', 95.00, 8, 8, 'laptop', 'Oficina',
 'Soporte de aluminio con seis alturas. Tu espalda te lo va a agradecer más que tu jefe.'),
('Suculenta "Sobrevive a los deploys"', 'Maceta de cerámica incluida', 29.00, 12, 12, 'sprout', 'Hogar',
 'Suculenta natural en maceta de cerámica blanca. Necesita menos cuidados que tu pipeline de CI.'),
('Reloj de pared "Siempre son las 5 en algún servidor"', 'Silencioso, 30 cm', 59.00, 7, 7, 'clock', 'Hogar',
 'Reloj de pared de 30 cm con mecanismo silencioso. El horario de producción es relativo.'),
('Taza térmica "Café asíncrono"', '450 ml, tapa hermética', 45.00, 16, 16, 'coffee', 'Hogar',
 'Taza térmica de 450 ml con tapa hermética. El café se mantiene caliente mientras esperas el build.'),
('Cubo Rubik "Backtracking"', '3 × 3, giro suave', 32.00, 13, 13, 'box', 'Juegos',
 'Cubo de 3 × 3 de giro suave, sin stickers. Para practicar algoritmos con las manos.'),
('Dados "Estimación de story points"', '7 dados con Fibonacci', 22.00, 19, 19, 'dices', 'Juegos',
 'Siete dados con la secuencia de Fibonacci. Tan precisos como cualquier planning poker.'),
('Puzzle "Arquitectura de microservicios"', '1000 piezas', 49.00, 6, 6, 'puzzle', 'Juegos',
 'Rompecabezas de 1000 piezas con un diagrama de microservicios. Más fácil de armar que el de verdad.'),
('Juego de cartas "Code Review: la batalla"', '2 a 6 jugadores', 55.00, 10, 10, 'swords', 'Juegos',
 'Juego de cartas para 2 a 6 jugadores: aprueba, pide cambios o bloquea el merge de tus rivales.'),
('Peluche "El bug que nunca se arregló"', '25 cm, lavable', 39.00, 4, 4, 'bug', 'Juegos',
 'Peluche de 25 cm con forma de bichito. Lo vas a querer aunque nunca lo hayas podido arreglar.');

UPDATE products SET initial_stock = stock WHERE initial_stock IS NULL;
ALTER TABLE products ALTER COLUMN initial_stock SET NOT NULL;

CREATE TABLE product_reviews (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    author VARCHAR(40) NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by_ip VARCHAR(64),
    -- Marca las reseñas de ejemplo para distinguirlas de las de visitantes.
    seed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_product_reviews_product ON product_reviews (product_id, created_at DESC);

INSERT INTO product_reviews (product_id, author, rating, comment, created_at, seed)
SELECT p.id, r.author, r.rating, r.comment, now() - (r.dias || ' days')::interval, TRUE
FROM (VALUES
  ('Taza "Bug Free"', 'Lucía', 5, 'La uso todos los días. El café sabe igual, pero el código compila a la primera. Coincidencia, seguro.', 3),
  ('Taza "Bug Free"', 'Diego', 4, 'Buena taza, el estampado no se borró en el lavavajillas. Le quito una estrella porque igual tengo bugs.', 12),
  ('Polo "En mi compu sí funciona"', 'Carla', 5, 'Se lo regalé a mi equipo de QA y no saben si reírse o llorar.', 6),
  ('Polo "En mi compu sí funciona"', 'Marco', 4, 'Talla única pero queda bien. La tela es suave.', 20),
  ('Mousepad "git commit -m arreglo definitivo (otra vez)"', 'Andrea', 5, 'Enorme, entra el teclado completo. El mensaje es demasiado real.', 2),
  ('Termo "Primero el café, luego hablamos"', 'Javier', 5, 'Mantiene el café caliente toda la mañana. Mis reuniones de las 9 mejoraron.', 9),
  ('Libreta "Ideas geniales a las 2am"', 'Sofía', 4, 'Las hojas punteadas son perfectas para diagramas. Las ideas de las 2 a. m. siguen siendo malas.', 15),
  ('Hoodie "Deploy los viernes"', 'Renzo', 5, 'Abriga mucho. Lo uso solo los viernes, por solidaridad con el on-call.', 4),
  ('Teclado mecánico "Clicky McClickface"', 'Valeria', 5, 'El sonido es adictivo. Mis compañeros pidieron que vuelva a trabajar remoto.', 1),
  ('Teclado mecánico "Clicky McClickface"', 'Tomás', 3, 'Muy bueno, pero demasiado ruidoso para videollamadas.', 8),
  ('Audífonos "Modo concentración"', 'Camila', 5, 'La cancelación de ruido es real. No escuché ni la alarma del incidente.', 5),
  ('Audífonos "Modo concentración"', 'Bruno', 4, 'Muy cómodos para jornadas largas. La batería dura toda la semana.', 18),
  ('Mouse inalámbrico "Ctrl+Z físico"', 'Paula', 4, 'Ergonómico y preciso. Los botones extra los configuré para copiar y pegar de Stack Overflow.', 11),
  ('Hub USB "Más puertos que microservicios"', 'Héctor', 5, 'Conecto todo con un solo cable. Funciona perfecto con dos monitores.', 7),
  ('Lámpara de escritorio "Debug nocturno"', 'Natalia', 5, 'La luz cálida ayuda mucho en las sesiones de noche.', 14),
  ('Suculenta "Sobrevive a los deploys"', 'Iván', 5, 'Lleva tres meses viva. Es lo único estable de mi escritorio.', 30),
  ('Dados "Estimación de story points"', 'Mónica', 5, 'Los usamos en el planning. Las estimaciones son igual de exactas que antes.', 10),
  ('Juego de cartas "Code Review: la batalla"', 'Gabriel', 4, 'Muy divertido con el equipo. Las partidas se alargan como un PR grande.', 16),
  ('Peluche "El bug que nunca se arregló"', 'Elena', 5, 'Ahora el bug vive en mi escritorio y no en producción. Bueno, en los dos.', 2)
) AS r (producto, author, rating, comment, dias)
JOIN products p ON p.name = r.producto;
