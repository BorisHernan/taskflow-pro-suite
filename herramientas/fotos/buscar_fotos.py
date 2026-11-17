#!/usr/bin/env python3
"""Busca fotos libres para cada artículo del catálogo y se queda con las mejores (hasta 8 por artículo).

Fuentes: Openverse (sin cuenta: 20 consultas por minuto y 200 por día) y Wikimedia Commons (sin tope práctico).
Solo acepta licencias que permiten uso comercial: CC0, dominio público, CC BY y CC BY-SA (con crédito).
Se puede cortar y volver a ejecutar: continúa donde se quedó (salida/estado.json).

Uso:
    python buscar_fotos.py                    # los 76 artículos frescos y genéricos
    python buscar_fotos.py --prioridad todo   # los 305 artículos (los envasados salen peor)
    python buscar_fotos.py --solo yuca,papa-blanca
Requiere: Python 3.9+ y Pillow (pip install pillow).
"""
import argparse
import hashlib
import html
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageFilter, ImageStat

AQUI = Path(__file__).resolve().parent
UA = 'TiendaDemoFotos/1.0 (proyecto de portafolio; contacto: mdrncastro@gmail.com)'
MAX_BYTES = 15 * 1024 * 1024
LADO_MIN = 600

# Títulos que delatan una foto de plato, de planta o de ambiente: se busca el alimento suelto, tal como se compra.
PLATO = r'plate|plated|dish|dishes|served|plato|platos'
EVITAR_BASE = re.compile(
    r'\b(recipe|cooked|cooking|restaurant|menu|market|stall|vendor|shop|store|supermarket|tree|trees|plant|plants|garden|'
    r'flower|flowers|blossom|field|farm|orchard|plantation|painting|drawing|illustration|cartoon|logo|museum|kitchen|'
    r'salad|ensalada|soup|sopa|sandwich|pizza|burger|fried|frito|toast|dinner|lunch|breakfast|meal|cafe|snack|snacks|'
    r'fly|flies|housefly|houseflies|insect|insects|maggot|maggots|mosca|moscas|gusano|rotten|spoiled|moldy|mouldy|dirty|'
    r'child|children|kid|kids|baby|toddler|student|students|costume|festival|parade|ceremony|event|unicef|'
    r'diagram|botanical|botany|lithograph|engraving|herbarium|flora|scientific|taxonomy|specimen|'
    r'people|woman|girl|boy|receta|cocinado|arbol|planta|plantas|jardin|flor|cultivo|mercado|restaurante)\b', re.I)
EVITAR_SUCIO = re.compile(r'\b(fly|flies|housefly|houseflies|insect|insects|maggot|maggots|mosca|moscas|gusano|rotten|spoiled|moldy|mouldy)\b', re.I)
EVITAR_PLATO = re.compile(r'\b(' + PLATO + r')\b', re.I)


# Subidores cuyas fotos suelen ser snapshots caseros (platos sobre pasto, moscas); se agregan aquí los que haga falta.
AUTORES_VETADOS = ('judgefloro',)


def autor_vetado(autor):
    return any(v in (autor or '').lower() for v in AUTORES_VETADOS)


def sin_tildes(t):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')


def titulo_aceptable(titulo, subcategoria, excluir=(), estricto=True):
    t = sin_tildes(titulo or '')
    if not estricto:  # envasados y no alimentos: "platos" o "cocina" pueden ser el producto; solo se evita lo sucio
        return not EVITAR_SUCIO.search(t) and not any(re.search(chr(92) + 'b' + re.escape(sin_tildes(e)) + chr(92) + 'b', t, re.I) for e in excluir)
    if any(re.search(r'\b' + re.escape(sin_tildes(e)) + r'\b', t, re.I) for e in excluir):
        return False
    if EVITAR_BASE.search(t):
        return False
    # En panadería y pastelería sí es normal ver el producto servido en un plato.
    return subcategoria in ('Panes', 'Pasteles y tortas') or not EVITAR_PLATO.search(t)


def ampliar_consultas(consultas):
    """Con la pista en inglés se prueban primero las fotos de producto aislado y de ingrediente crudo."""
    if len(consultas) < 2:
        return consultas
    ingles = consultas[0]
    return [f'{ingles} isolated white background', f'{ingles} fresh raw ingredient', ingles] + consultas[1:]


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def pedir(url, intentos=3, espera_429=65):
    """GET con reintentos. Devuelve (bytes, cabeceras) o lanza CuotaAgotada si se acabó el cupo diario."""
    for n in range(intentos):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                datos = r.read(MAX_BYTES + 1)
                if len(datos) > MAX_BYTES:
                    raise ValueError('archivo demasiado grande')
                return datos, r.headers
        except urllib.error.HTTPError as e:
            if e.code == 429:
                cuerpo = ''
                try:
                    cuerpo = e.read().decode('utf-8', 'ignore')
                except Exception:
                    pass
                if 'day' in cuerpo.lower() or 'sustained' in cuerpo.lower():
                    raise CuotaAgotada()
                log(f'  límite por minuto, espero {espera_429} s…')
                time.sleep(espera_429)
                continue
            if e.code in (500, 502, 503, 504) and n < intentos - 1:
                time.sleep(5 * (n + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if n == intentos - 1:
                raise
            time.sleep(4 * (n + 1))
    raise RuntimeError('sin respuesta')


class CuotaAgotada(Exception):
    pass


# ── Fuentes ──────────────────────────────────────────────────────────────

PERMITIDAS = {'cc0', 'pdm', 'by', 'by-sa'}


def licencia_commons(corta):
    t = (corta or '').lower().replace('-', ' ')
    if 'cc0' in t or 'cc zero' in t:
        return 'cc0', 'CC0'
    if t.startswith('public domain') or t.startswith('pd'):
        return 'pdm', 'Dominio público'
    m = re.match(r'cc by sa ([\d.]+)', t)
    if m:
        return 'by-sa', f'CC BY-SA {m.group(1)}'
    m = re.match(r'cc by ([\d.]+)', t)
    if m and 'nc' not in t and 'nd' not in t:
        return 'by', f'CC BY {m.group(1)}'
    return None, corta


def buscar_openverse(consulta, cuota, pagina=1):
    licencias = 'cc0,pdm,by,by-sa'
    q = urllib.parse.quote(consulta)
    url = f'https://api.openverse.org/v1/images/?q={q}&license={licencias}&page_size={min(20, cuota)}&mature=false&category=photograph&page={pagina}'
    datos, _ = pedir(url)
    salida = []
    for r in json.loads(datos).get('results', []):
        lic = (r.get('license') or '').lower()
        if lic not in PERMITIDAS:
            continue
        version = r.get('license_version') or ''
        nombre = {'cc0': 'CC0', 'pdm': 'Dominio público', 'by': f'CC BY {version}', 'by-sa': f'CC BY-SA {version}'}[lic].strip()
        salida.append({
            'fuente': 'Openverse', 'url': r.get('url'), 'ancho': r.get('width') or 0, 'alto': r.get('height') or 0,
            'titulo': r.get('title') or consulta, 'autor': r.get('creator') or 'Autor desconocido',
            'licencia': nombre, 'licencia_url': r.get('license_url') or '', 'origen': r.get('foreign_landing_url') or r.get('url'),
        })
    return salida


def buscar_commons(consulta, cuota, pagina=1):
    q = urllib.parse.quote(consulta + ' filetype:bitmap')
    url = ('https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6'
           f'&gsrsearch={q}&gsrlimit={min(20, cuota)}&gsroffset={(pagina - 1) * 20}&prop=imageinfo&iiprop=url|size|extmetadata'
           '&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist|ObjectName&iiurlwidth=1400&format=json')
    datos, _ = pedir(url)
    salida = []
    for p in (json.loads(datos).get('query', {}).get('pages', {}) or {}).values():
        ii = (p.get('imageinfo') or [{}])[0]
        meta = ii.get('extmetadata', {})
        clave, nombre = licencia_commons((meta.get('LicenseShortName') or {}).get('value'))
        if clave not in PERMITIDAS:
            continue
        autor = re.sub(r'<[^>]+>', '', (meta.get('Artist') or {}).get('value') or 'Autor desconocido')
        salida.append({
            'fuente': 'Wikimedia Commons', 'url': ii.get('thumburl') or ii.get('url'), 'ancho': ii.get('thumbwidth') or ii.get('width') or 0,
            'alto': ii.get('thumbheight') or ii.get('height') or 0, 'titulo': html.unescape(p.get('title', '').replace('File:', '')),
            'autor': html.unescape(autor).strip()[:120], 'licencia': nombre,
            'licencia_url': (meta.get('LicenseUrl') or {}).get('value') or '', 'origen': ii.get('descriptionurl') or ii.get('url'),
        })
    return salida


# ── Calidad de la imagen ─────────────────────────────────────────────────

def hash_perceptual(img):
    g = img.convert('L').resize((8, 8))
    px = list(g.tobytes())
    media = sum(px) / 64
    return ''.join('1' if p > media else '0' for p in px)


def distancia(a, b):
    return sum(x != y for x, y in zip(a, b))


def puntuar(img):
    """Más alto = mejor foto de producto: grande, casi cuadrada, de fondo claro y nítida."""
    w, h = img.size
    tamano = min(1.5, min(w, h) / 1000)
    proporcion = max(0.0, 1 - abs((w / h) - 1) / 1.2)
    rgb = img.convert('RGB')
    esquinas = [rgb.getpixel((3, 3)), rgb.getpixel((w - 4, 3)), rgb.getpixel((3, h - 4)), rgb.getpixel((w - 4, h - 4))]
    claro = 0.7 if all(min(p) > 215 for p in esquinas) else 0.0
    borde = ImageStat.Stat(rgb.convert('L').filter(ImageFilter.FIND_EDGES)).var[0]
    nitidez = min(0.6, borde / 4000)
    return round(tamano + proporcion + claro + nitidez, 3)


def descargar(c, destino):
    try:
        datos, _ = pedir(c['url'], intentos=2)
        img = Image.open(io.BytesIO(datos))
        img.load()
    except Exception as e:
        log('    no se pudo descargar:', str(e)[:80])
        return None
    if min(img.size) < LADO_MIN:
        return None
    img = img.convert('RGB')
    if max(img.size) > 1600:
        img.thumbnail((1600, 1600), Image.LANCZOS)
    c = dict(c, ancho=img.width, alto=img.height, puntaje=puntuar(img), huella=hash_perceptual(img))
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino, 'JPEG', quality=88)
    c['archivo'] = destino.name
    return c


# ── Programa principal ───────────────────────────────────────────────────

def reunir_candidatos(a, args, vistas, objetivo, paginas_extra):
    """Busca en las fuentes y devuelve candidatos nuevos (sin las URL de `vistas`), los más promisorios primero."""
    candidatos = []
    for i, consulta in enumerate(ampliar_consultas(a['consultas'])):
        for fuente in list(args.fuentes):
            paginas = (1, 2) if paginas_extra and (fuente == 'commons' or i == 0) else (1,)
            for pagina in paginas:
                try:
                    encontrados = (buscar_openverse if fuente == 'openverse' else buscar_commons)(consulta, 20, pagina)
                except CuotaAgotada:
                    if fuente == 'openverse':
                        log('  Openverse agotó su cupo del día; sigo solo con Wikimedia Commons.')
                        args.fuentes = [f for f in args.fuentes if f != 'openverse']
                        break
                    raise
                except Exception as e:
                    log(f'  {fuente} falló para "{consulta}": {str(e)[:80]}')
                    continue
                if fuente == 'openverse':
                    time.sleep(args.pausa)
                for c in encontrados:
                    if c['url'] and c['url'] not in vistas and min(c['ancho'], c['alto']) >= LADO_MIN and titulo_aceptable(c['titulo'], a.get('subcategoria'), a.get('excluir', []), a.get('prioridad', 1) == 1) and not autor_vetado(c['autor']):
                        vistas.add(c['url'])
                        candidatos.append(c)
        if len(candidatos) >= objetivo * 3:
            break
    # Se descargan primero los más grandes y cuadrados para no gastar tiempo en los dudosos.
    candidatos.sort(key=lambda c: -(min(c['ancho'], c['alto']) / max(c['ancho'], c['alto'], 1)) * 1000 - min(c['ancho'], c['alto']) / 100)
    return candidatos


def descargar_nuevas(candidatos, carpeta, primer_numero, limite, huellas, filtro=None):
    """Descarga sin repetir fotos parecidas a `huellas` ni entre sí; devuelve las nuevas."""
    guardadas = []
    for c in candidatos:
        if len(guardadas) >= limite:
            break
        res = descargar(c, carpeta / f'{primer_numero + len(guardadas)}.jpg')
        if res is None:
            continue
        if filtro and not filtro(Image.open(carpeta / res['archivo'])):
            (carpeta / res['archivo']).unlink(missing_ok=True)
            continue
        if any(distancia(res['huella'], h) <= 5 for h in huellas + [g['huella'] for g in guardadas]):
            (carpeta / res['archivo']).unlink(missing_ok=True)
            continue
        guardadas.append(res)
    return guardadas


def procesar_articulo(a, args, salida):
    carpeta = salida / 'candidatas' / a['slug']
    candidatos = reunir_candidatos(a, args, set(), args.por_articulo, False)
    guardadas = descargar_nuevas(candidatos, carpeta, 1, args.max_candidatas, [], args.revisor and args.revisor.filtro(a))
    guardadas.sort(key=lambda g: -g['puntaje'])
    return guardadas, guardadas[:args.por_articulo]


def ampliar_articulo(a, previo, args, salida):
    """Segunda pasada: suma fotos nuevas hasta `--total` sin tocar las que quedaron ni traer de vuelta las descartadas."""
    carpeta = salida / 'candidatas' / a['slug']
    vivas = [c for c in previo['candidatas'] if (carpeta / c['archivo']).exists()]
    descartadas = set(previo.get('descartadas', [])) | {c['url'] for c in previo['candidatas'] if not (carpeta / c['archivo']).exists()}
    objetivo = args.total or max(args.minimo, a.get('marcas', 1) * args.por_marca)
    falta = objetivo - len(vivas)
    nuevas = []
    if falta > 0:
        huellas = [hash_perceptual(Image.open(carpeta / c['archivo']).convert('RGB')) for c in vivas]
        conocidas = {c['url'] for c in previo['candidatas']} | descartadas
        candidatos = reunir_candidatos(a, args, conocidas, falta, True)
        primer = max([int(Path(c['archivo']).stem) for c in previo['candidatas']] + [0]) + 1
        nuevas = descargar_nuevas(candidatos, carpeta, primer, falta + 2, huellas, args.revisor and args.revisor.filtro(a))
        nuevas.sort(key=lambda g: -g['puntaje'])
        for g in nuevas[falta:]:
            (carpeta / g['archivo']).unlink(missing_ok=True)
        nuevas = nuevas[:falta]

    def limpia(c):
        return {k: v for k, v in c.items() if k not in ('huella', 'nueva')}

    de_antes = {c['archivo'] for c in previo['elegidas']}
    ordenadas = [c for c in vivas if c['archivo'] in de_antes] + [c for c in vivas if c['archivo'] not in de_antes]
    nuevas = [dict(limpia(g), nueva=True) for g in nuevas]
    return {
        'base': previo['base'], 'descartadas': sorted(descartadas),
        'candidatas': [limpia(c) for c in vivas] + nuevas,
        'elegidas': [limpia(c) for c in ordenadas] + nuevas,
    }, len(nuevas)


def limpiar(articulos, seleccion, args, salida):
    """Mueve a salida/rechazadas/ las fotos que el revisor no acepta (por defecto solo las de la segunda pasada)."""
    movidas = 0
    for a in articulos:
        previo = seleccion.get(a['slug'])
        if not previo:
            continue
        filtro = args.revisor.filtro(a)
        carpeta = salida / 'candidatas' / a['slug']
        for c in previo['candidatas']:
            ruta = carpeta / c['archivo']
            if not ruta.exists() or not (args.todas or c.get('nueva') or autor_vetado(c['autor'])):
                continue
            if autor_vetado(c['autor']) or not titulo_aceptable(c['titulo'], a.get('subcategoria'), a.get('excluir', []), a.get('prioridad', 1) == 1) or not filtro(Image.open(ruta)):
                destino = salida / 'rechazadas' / a['slug']
                destino.mkdir(parents=True, exist_ok=True)
                ruta.replace(destino / c['archivo'])
                previo.setdefault('descartadas', []).append(c['url'])
                movidas += 1
        previo['candidatas'] = [c for c in previo['candidatas'] if (carpeta / c['archivo']).exists()]
        previo['elegidas'] = [c for c in previo['elegidas'] if (carpeta / c['archivo']).exists()]
        log(f'  {a["base"]}: quedan {sum((carpeta / c["archivo"]).exists() for c in previo["candidatas"])} fotos')
    ruta_sel = salida / 'seleccion.json'
    ruta_sel.write_text(json.dumps(seleccion, ensure_ascii=False, indent=1), encoding='utf-8')
    hoja_revision(salida, articulos, seleccion)
    log(f'{movidas} fotos rechazadas movidas a {salida / "rechazadas"}. Ejecuta --ampliar para reponerlas.')


def quitar_repetidas(articulos, seleccion, salida):
    """Aparta las fotos casi idénticas que aparecen en dos artículos distintos (queda la del primero)."""
    vistas, movidas = [], 0
    for a in articulos:
        previo = seleccion.get(a['slug'])
        if not previo:
            continue
        carpeta = salida / 'candidatas' / a['slug']
        for c in previo['candidatas']:
            ruta = carpeta / c['archivo']
            if not ruta.exists():
                continue
            h = hash_perceptual(Image.open(ruta).convert('RGB'))
            otro = next((v for v in vistas if distancia(h, v[0]) <= 6 and v[1] != a['slug']), None)
            if otro:
                destino = salida / 'rechazadas' / a['slug']
                destino.mkdir(parents=True, exist_ok=True)
                ruta.replace(destino / c['archivo'])
                previo.setdefault('descartadas', []).append(c['url'])
                movidas += 1
                log(f'  {a["base"]}: {c["archivo"]} repetía una foto de {otro[1]}')
            else:
                vistas.append((h, a['slug']))
        previo['candidatas'] = [c for c in previo['candidatas'] if (carpeta / c['archivo']).exists()]
        previo['elegidas'] = [c for c in previo['elegidas'] if (carpeta / c['archivo']).exists()]
    (salida / 'seleccion.json').write_text(json.dumps(seleccion, ensure_ascii=False, indent=1), encoding='utf-8')
    hoja_revision(salida, articulos, seleccion)
    log(f'{movidas} fotos repetidas entre artículos movidas a {salida / "rechazadas"}.')


def hoja_revision(salida, articulos, seleccion):
    filas = []
    for a in articulos:
        if a['slug'] not in seleccion:
            continue
        carpeta = salida / 'candidatas' / a['slug']
        existentes = [f for f in seleccion[a['slug']]['candidatas'] if (carpeta / f['archivo']).exists()]
        fotos = ''.join(
            f'<figure class="{"nueva" if f.get("nueva") else ""}"><img loading="lazy" src="candidatas/{a["slug"]}/{f["archivo"]}"><figcaption>{html.escape(f["archivo"])} · {html.escape(f["licencia"])} · {f["puntaje"]}</figcaption></figure>'
            for f in existentes)
        elegidas = ', '.join(f['archivo'] for f in seleccion[a['slug']]['elegidas'] if (carpeta / f['archivo']).exists())
        filas.append(f'<section><h2>{html.escape(a["base"])} <small>({a["slug"]}) · elegidas: {elegidas}</small></h2><div>{fotos}</div></section>')
    (salida / 'revision.html').write_text(
        '<!doctype html><meta charset="utf-8"><title>Fotos candidatas</title>'
        '<style>body{font:14px system-ui;margin:20px}section{margin-bottom:28px}h2{font-size:16px}small{color:#666;font-weight:400}'
        'div{display:flex;gap:10px;overflow-x:auto}figure{margin:0;flex:0 0 190px}img{width:190px;height:190px;object-fit:cover;border-radius:8px}'
        'figcaption{font-size:11px;color:#555}figure.nueva img{outline:3px solid #f47b20}</style><h1>Fotos candidatas</h1>'
        '<p>Para descartar una, borra su archivo de <code>candidatas/&lt;artículo&gt;/</code> y ejecuta <code>procesar_fotos.py</code> otra vez.</p>'
        + ''.join(filas), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--prioridad', default='1', choices=['1', '2', 'todo'], help='1 = frescos y genéricos (por defecto), 2 = envasados, todo = ambos')
    ap.add_argument('--por-articulo', type=int, default=8, help='fotos que se eligen por artículo (cada marca del artículo usa una distinta)')
    ap.add_argument('--max-candidatas', type=int, default=14, help='fotos que se guardan como candidatas por artículo')
    ap.add_argument('--fuentes', default='openverse,commons', help='openverse, commons o ambas separadas por coma')
    ap.add_argument('--pausa', type=float, default=3.2, help='segundos entre consultas a Openverse (límite: 20 por minuto)')
    ap.add_argument('--solo', default='', help='slugs separados por coma')
    ap.add_argument('--salida', default=str(AQUI / 'salida'))
    ap.add_argument('--ampliar', action='store_true', help='segunda pasada: suma fotos nuevas hasta --total sin tocar las que quedaron ni las que descartaste (6 por marca, mínimo 8)')
    ap.add_argument('--por-marca', type=int, default=6, help='con --ampliar, fotos propias para cada marca del artículo (las marcas salen de articulos.json)')
    ap.add_argument('--minimo', type=int, default=8, help='con --ampliar, mínimo de fotos por artículo aunque tenga una sola marca')
    ap.add_argument('--total', type=int, default=0, help='con --ampliar, fija las fotos de cada artículo (ignora --por-marca)')
    ap.add_argument('--limpiar', action='store_true', help='revisa con IA las fotos de la segunda pasada y aparta las que son platos, plantas o locales')
    ap.add_argument('--todas', action='store_true', help='con --limpiar, revisa también las fotos de la primera pasada')
    ap.add_argument('--repetidas', action='store_true', help='aparta las fotos que se repiten entre artículos distintos')
    ap.add_argument('--hoja', action='store_true', help='solo regenera salida/revision.html con las fotos que existen')
    ap.add_argument('--sin-ia', action='store_true', help='no usa el revisor de imágenes (solo filtra por título)')
    ap.add_argument('--rehacer', action='store_true', help='vuelve a buscar aunque el artículo ya estuviera hecho')
    args = ap.parse_args()
    args.fuentes = [f.strip() for f in args.fuentes.split(',') if f.strip()]

    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    articulos = json.loads((AQUI / 'articulos.json').read_text(encoding='utf-8'))
    if args.solo:
        pedidos = {s.strip() for s in args.solo.split(',')}
        articulos = [a for a in articulos if a['slug'] in pedidos]
    elif args.prioridad != 'todo':
        articulos = [a for a in articulos if str(a['prioridad']) == args.prioridad]

    args.revisor = None
    if not args.sin_ia and not args.hoja and not args.repetidas:
        try:
            from contenido import Revisor
            log('Cargando el revisor de imágenes (la primera vez descarga el modelo, unos 600 MB)…')
            args.revisor = Revisor()
        except ImportError:
            if args.limpiar:
                sys.exit('Para --limpiar instala: pip install torch --index-url https://download.pytorch.org/whl/cpu  y  pip install transformers')
            log('AVISO: sin torch/transformers solo se filtra por título; con ellos se descartan platos, plantas y locales (ver contenido.py).')

    ruta_sel, ruta_estado = salida / 'seleccion.json', salida / 'estado.json'
    seleccion = json.loads(ruta_sel.read_text(encoding='utf-8')) if ruta_sel.exists() else {}
    estado = json.loads(ruta_estado.read_text(encoding='utf-8')) if ruta_estado.exists() else {}

    if args.repetidas:
        quitar_repetidas([a for a in articulos if a['slug'] in seleccion], seleccion, salida)
        return 0
    if args.hoja:
        hoja_revision(salida, articulos, seleccion)
        log('revision.html regenerada.')
        return 0
    if args.limpiar:
        limpiar([a for a in articulos if a['slug'] in seleccion], seleccion, args, salida)
        return 0
    if args.ampliar:
        articulos = [a for a in articulos if a['slug'] in seleccion]
        # Cada artículo se compara con su meta (las limpiezas quitan fotos): los que ya la cumplen no gastan ninguna consulta.
        def faltan_fotos(a):
            vivas = sum((salida / 'candidatas' / a['slug'] / c['archivo']).exists() for c in seleccion[a['slug']]['candidatas'])
            return vivas < (args.total or max(args.minimo, a.get('marcas', 1) * args.por_marca))
        pendientes = [a for a in articulos if faltan_fotos(a)]
    else:
        pendientes = [a for a in articulos if args.rehacer or estado.get(a['slug']) != 'ok']
    log(f'{len(articulos)} artículos en total, {len(pendientes)} por hacer. Fuentes: {", ".join(args.fuentes)}.')
    hechos = 0
    try:
        for i, a in enumerate(pendientes, 1):
            log(f'[{i}/{len(pendientes)}] {a["base"]}')
            if args.ampliar:
                seleccion[a['slug']], n = ampliar_articulo(a, seleccion[a['slug']], args, salida)
                estado[a['slug'] + '#ampliado'] = 'ok'
                log(f'  {n} fotos nuevas, {len(seleccion[a["slug"]]["candidatas"])} en total')
                hechos += 1
                ruta_sel.write_text(json.dumps(seleccion, ensure_ascii=False, indent=1), encoding='utf-8')
                ruta_estado.write_text(json.dumps(estado, ensure_ascii=False, indent=1), encoding='utf-8')
                continue
            candidatas, elegidas = procesar_articulo(a, args, salida)
            if not elegidas:
                estado[a['slug']] = 'sin_resultados'
                log('  sin fotos aptas')
            else:
                estado[a['slug']] = 'ok'
                seleccion[a['slug']] = {
                    'base': a['base'],
                    'candidatas': [{k: v for k, v in c.items() if k != 'huella'} for c in candidatas],
                    'elegidas': [{k: v for k, v in c.items() if k != 'huella'} for c in elegidas],
                }
                log(f'  {len(elegidas)} elegidas de {len(candidatas)} candidatas')
                hechos += 1
            ruta_sel.write_text(json.dumps(seleccion, ensure_ascii=False, indent=1), encoding='utf-8')
            ruta_estado.write_text(json.dumps(estado, ensure_ascii=False, indent=1), encoding='utf-8')
    except KeyboardInterrupt:
        log('Interrumpido: el avance queda guardado.')
    except CuotaAgotada:
        log('Se agotó el cupo diario. Vuelve a ejecutarlo mañana y continúa donde se quedó.')
    hoja_revision(salida, articulos, seleccion)
    sin = [s for s, e in estado.items() if e == 'sin_resultados']
    log(f'Listo: {hechos} artículos nuevos. Sin resultados: {len(sin)} ({", ".join(sin[:12])}{"…" if len(sin) > 12 else ""}).')
    log(f'Revisa {salida / "revision.html"} y luego ejecuta procesar_fotos.py')


if __name__ == '__main__':
    sys.exit(main())
