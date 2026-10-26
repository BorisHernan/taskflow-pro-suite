-- Catálogo con nombres reales de producto (antes eran frases en broma) y su historial al día.
CREATE TEMPORARY TABLE renombre (viejo TEXT PRIMARY KEY, nuevo TEXT NOT NULL, descripcion TEXT NOT NULL, detalle TEXT NOT NULL) ON COMMIT DROP;

INSERT INTO renombre (viejo, nuevo, descripcion, detalle) VALUES
    ('Taza "Bug Free"', 'Taza de cerámica 350 ml', 'Cerámica esmaltada, varios colores', 'Taza de cerámica esmaltada de 350 ml con acabado moteado. Apta para microondas y lavavajillas.'),
    ('Sticker pack "console.log"', 'Vinil adhesivo efecto mármol', 'Rollo de 60 × 200 cm, resistente al agua', 'Lámina de vinil autoadhesivo con acabado de mármol para renovar mesas, encimeras y muebles. Se corta a medida y se limpia con un paño húmedo.'),
    ('Polo "En mi compu sí funciona"', 'Polo de algodón básico', 'Algodón 100 %, varios colores', 'Polo de algodón peinado 100 % con cuello redondo y corte regular. Disponible en varios colores.'),
    ('Llavero USB decorativo', 'Llavero de metal', 'Metal y cuero, 4 colores', 'Llavero de metal cromado con tira de cuero sintético y argolla doble. Disponible en negro, azul, rojo y verde.'),
    ('Mousepad "git commit -m arreglo definitivo (otra vez)"', 'Mousepad XL', '80 × 30 cm, base de goma antideslizante', 'Alfombrilla extendida de 80 × 30 cm con superficie de tela de deslizamiento suave, bordes cosidos y base de goma antideslizante.'),
    ('Termo "Primero el café, luego hablamos"', 'Termo de acero 500 ml', 'Mantiene la temperatura hasta 12 horas', 'Termo de acero inoxidable de doble pared con tapa que sirve de vaso. Mantiene bebidas calientes o frías hasta 12 horas.'),
    ('Libreta "Ideas geniales a las 2am"', 'Libreta A5 rayada', '80 hojas, tapa dura con elástico', 'Libreta tamaño A5 con 80 hojas rayadas, tapa dura y cierre con elástico. Disponible en cinco colores.'),
    ('Pin "¿Ya probaste apagar y prender?"', 'Set de pines metálicos', 'Pines esmaltados con cierre de mariposa', 'Colección de pines metálicos esmaltados para mochilas, gorras o chaquetas, con cierre de mariposa.'),
    ('Calcetines "100% libres de bugs"', 'Calcetines de algodón (pack x3)', 'Talla única, puño reforzado', 'Pack de tres pares de calcetines tobilleros de algodón en negro, gris y blanco, con puño y talón reforzados.'),
    ('Funda para laptop "Shh... está compilando"', 'Funda para laptop 14"', 'Funda rígida con asa y cierre', 'Funda protectora para laptops de hasta 14 pulgadas, con estructura acolchada, asa y cierre perimetral.'),
    ('Cojín "Modo reunión: cámara apagada"', 'Cojín decorativo 45 × 45 cm', 'Funda de tela lavable, varios diseños', 'Cojín decorativo de 45 × 45 cm con funda de tela desmontable y lavable, en diseños geométricos.'),
    ('Botella "Hidratación > documentación"', 'Termo de acero 750 ml con asa', 'Con vaso, mantiene el calor 12 horas', 'Termo de acero inoxidable de 750 ml con asa lateral y vaso en la tapa, ideal para viajes o el trabajo.'),
    ('Hoodie "Deploy los viernes"', 'Polera con capucha', 'Algodón frizado, bolsillo canguro', 'Polera de algodón frizado con capucha forrada, bolsillo canguro y puños elásticos.'),
    ('Pijama "Modo oscuro activado"', 'Pijama de algodón', 'Dos piezas, tela suave', 'Pijama de dos piezas de algodón suave: polera de manga larga y pantalón con pretina elástica.'),
    ('Polo "Funciona en producción... a veces"', 'Polo oversize', 'Algodón, corte holgado', 'Polo de algodón de corte oversize con hombros caídos y manga amplia.'),
    ('Mochila "Todo mi entorno local"', 'Mochila de montaña 20 L', 'Espalda ventilada, bolsillo para botella', 'Mochila de 20 litros para caminatas y ciudad, con espalda acolchada, compartimento principal amplio y bolsillo lateral para botella.'),
    ('Teclado mecánico "Clicky McClickface"', 'Teclado mecánico retroiluminado', 'Switches azules, iluminación RGB', 'Teclado mecánico con switches azules táctiles, retroiluminación RGB y teclas antighosting.'),
    ('Audífonos "Modo concentración"', 'Audífonos inalámbricos', 'Cancelación de ruido, Bluetooth', 'Audífonos de diadema con cancelación activa de ruido, Bluetooth 5.0 y hasta 30 horas de batería.'),
    ('Mouse inalámbrico "Ctrl+Z físico"', 'Mouse inalámbrico ergonómico', '6 botones, receptor USB', 'Mouse inalámbrico de diseño ergonómico con 6 botones, sensor de alta precisión y receptor USB.'),
    ('Cable USB-C "El que sí carga"', 'Cable USB-C trenzado 2 m', 'Carga rápida y datos', 'Cable USB-C a USB-C de 2 metros con recubrimiento trenzado, compatible con carga rápida y transferencia de datos.'),
    ('Hub USB "Más puertos que microservicios"', 'Hub USB-C 7 en 1', 'HDMI 4K, USB 3.0 y lector de tarjetas', 'Adaptador USB-C con salida HDMI 4K, tres puertos USB 3.0, lector de tarjetas SD y microSD y carga PD.'),
    ('Monitor portátil "Segunda pantalla para Stack Overflow"', 'Monitor portátil 15,6"', 'Full HD, conexión USB-C', 'Monitor portátil de 15,6 pulgadas con panel IPS Full HD, conexión USB-C y funda que sirve de soporte.'),
    ('Power bank "Batería para el on-call"', 'Batería externa 20 000 mAh', 'Carga rápida, dos puertos', 'Batería externa de 20 000 mAh con carga rápida y dos puertos para cargar dos equipos a la vez.'),
    ('Lámpara de escritorio "Debug nocturno"', 'Lámpara de escritorio LED', 'Regulable, 3 tonos de luz', 'Lámpara LED de escritorio con brazo ajustable, intensidad regulable y tres tonos de luz.'),
    ('Agenda "Sprints y otras mentiras"', 'Agenda semanal 2026', 'Tapa dura, vista semanal', 'Agenda 2026 con vista semanal, tapa dura, cinta marcadora y páginas para notas.'),
    ('Set de lapiceros "Pseudocódigo"', 'Set de lapiceros (x4)', 'Punta fina, 4 colores', 'Set de cuatro lapiceros de tinta de gel con punta fina de 0,5 mm en negro, azul, rojo y verde.'),
    ('Post-its "TODO: refactorizar"', 'Notas adhesivas (6 blocks)', '100 hojas por block', 'Seis blocks de notas adhesivas de 76 × 76 mm en colores surtidos, con 100 hojas cada uno.'),
    ('Soporte para laptop "Postura > bugs"', 'Soporte de aluminio para laptop', 'Altura regulable, plegable', 'Soporte de aluminio para laptop con altura regulable y diseño plegable que mejora la postura y la ventilación.'),
    ('Suculenta "Sobrevive a los deploys"', 'Suculenta en maceta', 'Maceta de cerámica incluida', 'Suculenta de interior en maceta de cerámica, de bajo mantenimiento y riego ocasional.'),
    ('Reloj de pared "Siempre son las 5 en algún servidor"', 'Reloj de pared 30 cm', 'Mecanismo silencioso', 'Reloj de pared de 30 cm de diámetro con mecanismo de cuarzo silencioso.'),
    ('Taza térmica "Café asíncrono"', 'Taza térmica 450 ml', 'Tapa hermética para llevar', 'Taza térmica de 450 ml con doble pared y tapa hermética antiderrames.'),
    ('Cubo Rubik "Backtracking"', 'Cubo mágico 3 × 3', 'Giro suave, colores vivos', 'Cubo de rompecabezas 3 × 3 con mecanismo de giro suave y colores vivos.'),
    ('Dados "Estimación de story points"', 'Set de dados (x7)', 'Acrílico, colores surtidos', 'Set de siete dados poliédricos de acrílico para juegos de mesa y rol.'),
    ('Puzzle "Arquitectura de microservicios"', 'Rompecabezas 1000 piezas', 'Paisaje, 70 × 50 cm', 'Rompecabezas de 1000 piezas con ilustración de paisaje; armado mide 70 × 50 cm.'),
    ('Juego de cartas "Code Review: la batalla"', 'Juego de cartas familiar', '2 a 6 jugadores', 'Juego de cartas para toda la familia, de 2 a 6 jugadores y partidas de 20 minutos.'),
    ('Peluche "El bug que nunca se arregló"', 'Peluche de 25 cm', 'Suave y lavable', 'Peluche de 25 cm de felpa suave, relleno hipoalergénico y lavable a mano.'),
    ('Gorra "404 Sleep Not Found"', 'Gorra de algodón', 'Ajustable, visera curva', 'Gorra de algodón con visera curva y cierre ajustable.'),
    ('Lentes "Modo oscuro" para el sol', 'Lentes de sol', 'Filtro UV400', 'Lentes de sol con filtro UV400, marco liviano y estuche incluido.'),
    ('Paraguas "Lluvia de commits"', 'Paraguas plegable', '8 varillas, antiviento', 'Paraguas plegable con ocho varillas reforzadas, apertura automática y funda.'),
    ('Caja de regalo "Kit del dev feliz"', 'Caja de regalo', 'Taza, libreta y stickers', 'Caja de regalo con taza de cerámica, libreta A5 y set de stickers.'),
    ('Polo "Hecho en Lima con café"', 'Polo de algodón pima', 'Hecho en Perú', 'Polo de algodón pima peruano, de tejido suave y cuello reforzado.'),
    ('Postal ilustrada "Miraflores en 8 bits"', 'Set de postales de Lima (x4)', 'Ilustraciones de la ciudad', 'Cuatro postales ilustradas con lugares emblemáticos de Lima, impresas en papel de alto gramaje.'),
    ('Reloj "Siempre es hora de un café"', 'Reloj de pulsera', 'Correa de silicona', 'Reloj analógico de pulsera con caja de acero y correa de silicona, resistente a salpicaduras.'),
    ('Bolsa de tela "git add ."', 'Bolsa de tela', 'Algodón reforzado', 'Bolsa de tela de algodón reforzado con asas largas, ideal para compras y uso diario.'),
    ('Webcam "Daily en HD"', 'Cámara web Full HD', '1080p con micrófono incorporado', 'Cámara web Full HD 1080p con micrófono incorporado, enfoque automático y clip para monitor.'),
    ('Parlante "Build exitoso"', 'Parlante Bluetooth 10 W', 'Batería de 12 horas', 'Parlante portátil Bluetooth de 10 W, resistente a salpicaduras y con hasta 12 horas de batería.'),
    ('Router de viaje "Wi-Fi donde sea"', 'Router de viaje', 'Doble banda, Wi-Fi 5', 'Router compacto de doble banda con Wi-Fi 5, ideal para hoteles y oficinas temporales.'),
    ('Soporte para celular "Second screen"', 'Soporte para celular', 'Aluminio, ángulo ajustable', 'Soporte de aluminio para celular y tablet con ángulo ajustable y base antideslizante.'),
    ('Maletín para laptop "Reunión en 5"', 'Maletín para laptop 15"', 'Cuero sintético, varios bolsillos', 'Maletín para laptop de hasta 15 pulgadas, de cuero sintético con compartimento acolchado y varios bolsillos.'),
    ('Agenda 2027 "Sprint planning"', 'Agenda 2027', 'Semanal, tapa dura', 'Agenda 2027 con vista semanal, tapa dura y calendario anual.'),
    ('Tijera de oficina "Corta el scope"', 'Tijera de oficina', 'Acero inoxidable, 21 cm', 'Tijera de oficina de 21 cm con hojas de acero inoxidable y mango ergonómico.'),
    ('Paleta de colores "Design tokens"', 'Set de marcadores (x12)', 'Colores surtidos, punta doble', 'Set de doce marcadores de colores con punta doble, fina y biselada.'),
    ('Planta "Suculenta de producción"', 'Planta en maceta', 'Maceta de cerámica, interior', 'Planta de interior en maceta de cerámica, apta para oficinas con poca luz.'),
    ('Vela aromática "Refactor de lavanda"', 'Vela aromática de lavanda', '200 g, cera de soya', 'Vela aromática de lavanda de 200 g en frasco de vidrio, hecha con cera de soya.'),
    ('Manta "Fin de sprint"', 'Manta polar 150 × 200 cm', 'Polar suave, lavable', 'Manta de polar suave de 150 × 200 cm, liviana y lavable en lavadora.'),
    ('Set de cocina "Pizza del deploy"', 'Set para pizza', 'Cortador y tabla de madera', 'Set para pizza con cortador de rueda de acero inoxidable y tabla de madera.'),
    ('Control "Pausa activa"', 'Control inalámbrico', 'Compatible con PC y consola', 'Control inalámbrico compatible con PC y consola, con vibración y batería recargable.'),
    ('Cartas "Planning poker"', 'Mazo de cartas', 'Baraja de 54 cartas', 'Baraja de 54 cartas plastificadas en estuche rígido.'),
    ('Cohete armable "To the moon"', 'Cohete armable', '120 piezas de construcción', 'Set de construcción de 120 piezas para armar un cohete espacial.'),
    ('Juego de mesa "Merge conflict"', 'Juego de mesa de estrategia', '2 a 6 jugadores', 'Juego de mesa de estrategia para 2 a 6 jugadores, con tablero y fichas.');

UPDATE products p SET name = r.nuevo, description = r.descripcion, details = r.detalle
FROM renombre r WHERE p.name = r.viejo;

-- El vinil es un rollo de 60 × 200 cm: su precio anterior no tenía sentido.
UPDATE products SET price = 35 WHERE name = 'Vinil adhesivo efecto mármol';

-- Lo ya registrado (ventas, compras, mermas, pedidos online, tareas e incidencias) también con el nombre nuevo.
UPDATE purchases x SET product_name = r.nuevo FROM renombre r WHERE x.product_name = r.viejo;
UPDATE pedidos x SET producto_nombre = r.nuevo FROM renombre r WHERE x.producto_nombre = r.viejo;
UPDATE mermas x SET producto_nombre = r.nuevo FROM renombre r WHERE x.producto_nombre = r.viejo;
UPDATE tasks x SET title = replace(x.title, r.viejo, r.nuevo) FROM renombre r WHERE strpos(x.title, r.viejo) > 0;
UPDATE tasks x SET description = replace(x.description, r.viejo, r.nuevo) FROM renombre r WHERE strpos(x.description, r.viejo) > 0;
UPDATE incidencias x SET titulo = replace(x.titulo, r.viejo, r.nuevo) FROM renombre r WHERE strpos(x.titulo, r.viejo) > 0;
UPDATE incidencias x SET descripcion = replace(x.descripcion, r.viejo, r.nuevo) FROM renombre r WHERE strpos(x.descripcion, r.viejo) > 0;
