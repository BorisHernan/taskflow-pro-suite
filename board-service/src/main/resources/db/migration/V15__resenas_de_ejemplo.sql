-- Reseñas de ejemplo con comentarios de tienda normal (las originales eran bromas de programadores).
UPDATE product_reviews r SET comment = v.comentario
FROM (VALUES
    ('Taza de cerámica 350 ml', 'Lucía', 'La uso todos los días. Mantiene bien el calor y el esmaltado se ve igual después de varios lavados.'),
    ('Taza de cerámica 350 ml', 'Diego', 'Buena taza, el acabado no se borró en el lavavajillas. Es un poco más pequeña de lo que esperaba.'),
    ('Polo de algodón básico', 'Carla', 'Tela suave y el color no se desteñió al lavarlo. Ya compré otro igual.'),
    ('Polo de algodón básico', 'Marco', 'Buen corte y tela fresca. Lo pedí una talla más grande por si encogía y me quedó perfecto.'),
    ('Mousepad XL', 'Andrea', 'Enorme, entra el teclado completo y el mouse se desliza muy bien.'),
    ('Termo de acero 500 ml', 'Javier', 'Mantiene el café caliente toda la mañana y la tapa cierra bien, no gotea en la mochila.'),
    ('Libreta A5 rayada', 'Sofía', 'Las hojas son gruesas y la tinta no traspasa. El elástico mantiene todo cerrado.'),
    ('Polera con capucha', 'Renzo', 'Abriga mucho y el interior es suave. Ideal para las noches frías.'),
    ('Teclado mecánico retroiluminado', 'Valeria', 'El sonido de las teclas es muy satisfactorio y la iluminación se ve genial.'),
    ('Teclado mecánico retroiluminado', 'Tomás', 'Muy bueno, pero es bastante ruidoso para usarlo en videollamadas.'),
    ('Audífonos inalámbricos', 'Camila', 'La cancelación de ruido funciona muy bien en la oficina.'),
    ('Audífonos inalámbricos', 'Bruno', 'Muy cómodos para jornadas largas. La batería dura varios días.'),
    ('Mouse inalámbrico ergonómico', 'Paula', 'Ergonómico y preciso. Los botones laterales son muy útiles para trabajar.'),
    ('Suculenta en maceta', 'Iván', 'Lleva tres meses viva con muy poco riego. Se ve preciosa en el escritorio.'),
    ('Set de dados (x7)', 'Mónica', 'Los usamos en nuestras partidas de rol. Buen peso y los números se leen bien.'),
    ('Juego de cartas familiar', 'Gabriel', 'Muy divertido en familia. Las partidas son rápidas y fáciles de aprender.'),
    ('Peluche de 25 cm', 'Elena', 'Suave y bien cosido. A mi sobrina le encantó.')
) AS v (producto, autor, comentario)
JOIN products p ON p.name = v.producto
WHERE r.product_id = p.id AND r.author = v.autor AND r.seed;
