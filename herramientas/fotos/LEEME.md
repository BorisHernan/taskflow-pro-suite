# Fotos libres para los productos

Dos scripts que corres tú, sin gastar nada de Claude:

1. `buscar_fotos.py` busca fotos con licencia libre (Openverse y Wikimedia Commons) y se queda con las mejores
   **5 por artículo**.
2. `procesar_fotos.py` las convierte a WebP cuadrado de 800 × 800 para la tienda y guarda los créditos.

Un "artículo" es el producto sin marca ni tamaño ("Yuca", "Aceite vegetal"): todas sus marcas y presentaciones
comparten las mismas fotos. Son 305 artículos; 76 son frescos o genéricos y son los que mejor salen.

## Antes de empezar (una vez)

```bash
pip install pillow
```

## Ejecutarlo

Desde esta carpeta (`herramientas/fotos`):

```bash
python buscar_fotos.py
```

Con eso se hacen los 76 artículos frescos y genéricos (frutas, verduras, carnes, pan, huevos, quesos, arroz y
menestras). Tarda entre 30 y 60 minutos. Para dejarlo en segundo plano y seguir usando la PC:

- **Windows (PowerShell):** `Start-Process python -ArgumentList "buscar_fotos.py" -RedirectStandardOutput log.txt -WindowStyle Hidden`
- **Git Bash:** `nohup python buscar_fotos.py > log.txt 2>&1 &`

Se puede cortar en cualquier momento (Ctrl+C) y volver a ejecutar: continúa donde se quedó.

Otras opciones:

| Opción | Para qué |
|---|---|
| `--prioridad todo` | Los 305 artículos (los envasados, como detergente o galletas, tienen pocas fotos neutras) |
| `--solo yuca,papa-blanca` | Solo esos artículos (usa el `slug` de `articulos.json`) |
| `--por-articulo 4` | Menos fotos por artículo |
| `--fuentes commons` | Solo Wikimedia Commons (sin límite diario) |
| `--rehacer` | Vuelve a buscar artículos ya hechos |

**Límites de Openverse sin cuenta:** 20 consultas por minuto y 200 por día. El script lo respeta y, si se acaba
el cupo del día, sigue solo con Wikimedia Commons o se detiene para que lo continúes mañana.

## Segunda pasada (más fotos, una tanda por marca)

```bash
python buscar_fotos.py --ampliar
```

Suma fotos nuevas sin tocar las que dejaste ni traer de vuelta las que borraste. Cada artículo llega a 6 fotos por
cada marca que tiene (mínimo 8); la cantidad de marcas está en `articulos.json` (`marcas`). La tienda reparte
las fotos del artículo entre sus marcas, así cada marca muestra las suyas. En `revision.html` las nuevas llevan
borde naranja. Opciones: `--por-marca 5`, `--minimo 8`, `--total 12` (fija el total).

### Revisor de imágenes (recomendado)

El filtro por título no ve el contenido: deja pasar platos, plantas y locales con títulos neutros. `contenido.py` usa un
modelo de visión (CLIP) que mira la foto y la compara con "el alimento crudo, tal como se compra" frente a platos
servidos, cocinados, plantas, locales y personas. Se instala una vez (unos 1,2 GB, corre en CPU, sin costo):

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install transformers
```

Con eso instalado, `buscar_fotos.py` lo usa solo al descargar. Para limpiar lo que ya bajó la segunda pasada:

```bash
python buscar_fotos.py --limpiar     # aparta a salida/rechazadas/ las fotos nuevas que son platos, plantas o locales
python buscar_fotos.py --ampliar     # repone hasta llegar a la cantidad por marca, ya con el filtro
```

`--limpiar --todas` revisa también las de la primera pasada. `--repetidas` aparta las fotos casi idénticas que aparecen en dos artículos distintos (por ejemplo arroz extra y arroz superior). Orden recomendado: `--limpiar --todas`, `--repetidas`, `--ampliar`, `procesar_fotos.py`. Lo apartado no se borra: está en `salida/rechazadas/`.

## Revisión manual en grupo

```
python revisar_fotos.py
```

Abre una página local con las fotos agrupadas por artículo (las que irán a la tienda llevan etiqueta verde). Haz clic en las que no sirven (se marcan con una ✕ roja; la lupa las muestra grandes), pulsa **Borrar marcadas** y se mueven a `salida/rechazadas/` sin volver a proponerse con `--ampliar`. Al terminar, **Actualizar tienda** ejecuta `procesar_fotos.py`. Cierra con Ctrl+C.
Con `--sin-ia` se omite el revisor.

## Lista siguiente: envasados y no alimentos (prioridad 2)

Son 229 artículos (bebidas, limpieza, cuidado personal, tecnología, hogar...). Ya tienen pista de búsqueda en inglés y
el revisor los trata como producto (sin exigir "ingrediente crudo"):

```bash
python buscar_fotos.py --prioridad 2 --por-articulo 4 --max-candidatas 8
```

Con 4 fotos por artículo son unos 70 MB más en la tienda (con 8 serían unos 150 MB). Salen mejor los objetos (balones,
electrodomésticos) que los envasados con marca, y en muchos de estos la foto "perfecta" no existe con licencia libre:
si un artículo se ve flojo, déjalo con su pictograma.

## Revisar

Abre `salida/revision.html` en el navegador: muestra todas las candidatas de cada artículo con su licencia.
Si una foto no sirve, **borra su archivo** de `salida/candidatas/<artículo>/` (la siguiente mejor ocupa su lugar).

## Dejarlas listas para la tienda

```bash
python procesar_fotos.py
```

Genera `taskflow-web/public/img/articulos/`, el índice `fotos-articulos.ts` y `public/creditos-fotos.json`.
Después avísale a Claude para conectar las fotos con los productos y mostrar los créditos (las licencias CC BY
exigen nombrar al autor).

## Licencias

Solo se aceptan CC0, dominio público, CC BY y CC BY-SA. Se descartan las "NC" (no comercial) y las "ND" (sin
derivadas). Los créditos quedan guardados y deben mostrarse en la tienda.
