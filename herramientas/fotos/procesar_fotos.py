#!/usr/bin/env python3
"""Convierte las fotos elegidas por buscar_fotos.py en imágenes WebP cuadradas de 800 × 800 para la tienda.

Respeta lo que hayas borrado de salida/candidatas/<artículo>/ (las que ya no existan se omiten) y escribe:
  taskflow-web/public/img/articulos/<artículo>/<n>.webp
  taskflow-web/src/app/store/fotos-articulos.ts      (qué artículos tienen foto y cuántas)
  taskflow-web/public/creditos-fotos.json            (autor, licencia y origen de cada foto: hay que mostrarlos)

Uso:  python procesar_fotos.py
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageChops

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
SALIDA = AQUI / 'salida'
DESTINO = RAIZ / 'taskflow-web' / 'public' / 'img' / 'articulos'
INDICE = RAIZ / 'taskflow-web' / 'src' / 'app' / 'store' / 'fotos-articulos.ts'
CREDITOS = RAIZ / 'taskflow-web' / 'public' / 'creditos-fotos.json'
LADO = 800


def color_fondo(im):
    w, h = im.size
    esquinas = [im.getpixel(p) for p in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
    if not all(min(p[:3]) > 225 for p in esquinas):
        return None
    return tuple(sum(p[i] for p in esquinas) // 4 for i in range(3))


def cuadrar(ruta):
    im = Image.open(ruta).convert('RGB')
    fondo = color_fondo(im)
    if fondo:  # foto de producto sobre fondo claro: se recorta el margen vacío y se centra
        dif = ImageChops.difference(im, Image.new('RGB', im.size, fondo)).convert('L').point(lambda v: 255 if v > 18 else 0)
        caja = dif.getbbox()
        if caja:
            im = im.crop(caja)
        margen = int(LADO * 0.08)
        im.thumbnail((LADO - 2 * margen, LADO - 2 * margen), Image.LANCZOS)
        lienzo = Image.new('RGB', (LADO, LADO), fondo)
        lienzo.paste(im, ((LADO - im.width) // 2, (LADO - im.height) // 2))
        return lienzo
    lado = min(im.size)  # foto de ambiente: recorte cuadrado al centro
    x, y = (im.width - lado) // 2, (im.height - lado) // 2
    return im.crop((x, y, x + lado, y + lado)).resize((LADO, LADO), Image.LANCZOS)


def main():
    ruta_sel = SALIDA / 'seleccion.json'
    if not ruta_sel.exists():
        sys.exit('No hay salida/seleccion.json: ejecuta primero buscar_fotos.py')
    seleccion = json.loads(ruta_sel.read_text(encoding='utf-8'))
    articulos = {a['slug']: a for a in json.loads((AQUI / 'articulos.json').read_text(encoding='utf-8'))}

    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    cantidades, creditos, total_kb = {}, {}, 0
    for slug, datos in sorted(seleccion.items()):
        existentes = {f['archivo']: f for f in datos['candidatas'] if (SALIDA / 'candidatas' / slug / f['archivo']).exists()}
        elegidas = [f for f in datos['elegidas'] if f['archivo'] in existentes]
        # Si borraste alguna elegida, la reemplaza la siguiente mejor candidata que quede.
        if len(elegidas) < len(datos['elegidas']):
            resto = sorted((f for a, f in existentes.items() if f not in elegidas), key=lambda f: -f['puntaje'])
            elegidas += resto[:len(datos['elegidas']) - len(elegidas)]
        if not elegidas:
            continue
        carpeta = DESTINO / slug
        carpeta.mkdir(parents=True, exist_ok=True)
        lista = []
        for n, f in enumerate(elegidas, 1):
            salida = carpeta / f'{n}.webp'
            cuadrar(SALIDA / 'candidatas' / slug / f['archivo']).save(salida, 'WEBP', quality=80, method=6)
            total_kb += salida.stat().st_size / 1024
            lista.append({'n': n, 'titulo': f['titulo'], 'autor': f['autor'], 'licencia': f['licencia'],
                          'licencia_url': f['licencia_url'], 'origen': f['origen'], 'fuente': f['fuente']})
        cantidades[slug] = len(lista)
        creditos[slug] = {'articulo': articulos.get(slug, {}).get('base', slug), 'fotos': lista}

    lineas = ['/** Artículos con fotos libres en img/articulos/<artículo>/<n>.webp (la 1 es la principal). Lo genera herramientas/fotos/procesar_fotos.py. */',
              'export const FOTOS_ARTICULOS: Record<string, { base: string; cantidad: number }> = {']
    for slug, n in cantidades.items():
        base = creditos[slug]['articulo'].replace("'", "\\'")
        lineas.append(f"  '{slug}': {{ base: '{base}', cantidad: {n} }},")
    lineas += ['};', '']
    INDICE.write_text('\r\n'.join(lineas), encoding='utf-8', newline='')
    CREDITOS.write_text(json.dumps(creditos, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{sum(cantidades.values())} fotos de {len(cantidades)} artículos, {total_kb / 1024:.1f} MB en total.')
    print('Siguiente paso: avísale a Claude para conectar las fotos con los productos y mostrar los créditos.')


if __name__ == '__main__':
    main()
