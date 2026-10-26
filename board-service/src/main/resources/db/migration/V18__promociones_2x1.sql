-- Promociones 2 × 1: llevas dos unidades y pagas una (por cada par). Solo en artículos de consumo masivo
-- que no tengan ya un precio rebajado.
ALTER TABLE products ADD COLUMN promo VARCHAR(10);

UPDATE products SET promo = '2X1', list_price = NULL
WHERE subcategory IN ('Gaseosas', 'Galletas', 'Snacks', 'Yogures', 'Detergentes', 'Cereales',
                      'Chocolates y dulces', 'Jugos', 'Fideos y pastas', 'Conservas')
  AND brand IS NOT NULL
  AND id % 3 = 0;
