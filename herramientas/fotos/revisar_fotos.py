#!/usr/bin/env python3
"""Revisión manual de fotos: marca las que no sirven y bórralas todas de una vez.

Abre una página local (http://127.0.0.1:8765) con las fotos agrupadas por artículo. Haz clic en las que quieras
descartar y pulsa "Borrar marcadas": se mueven a salida/rechazadas/<artículo>/ (no se pierden) y no vuelven a
buscarse con --ampliar. "Actualizar tienda" ejecuta procesar_fotos.py con lo que quedó.

Uso:  python revisar_fotos.py
"""
import contextlib
import io
import json
import re
import secrets
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image

import procesar_fotos

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI / 'salida'
CANDIDATAS = SALIDA / 'candidatas'
MINIATURAS = SALIDA / 'miniaturas'
RUTA_SEL = SALIDA / 'seleccion.json'
PUERTO = 8765
TOKEN = secrets.token_hex(16)
CANDADO = threading.Lock()
ARCHIVO_OK = re.compile(r'^[\w.-]+$')


def cargar():
    sel = json.loads(RUTA_SEL.read_text(encoding='utf-8'))
    arts = {a['slug']: a for a in json.loads((AQUI / 'articulos.json').read_text(encoding='utf-8'))}
    return sel, arts


def datos():
    """Artículos con sus fotos; 'tienda' marca las que publicaría procesar_fotos.py (con la misma regla de reemplazo)."""
    sel, arts = cargar()
    lista = []
    for slug, d in sel.items():
        carpeta = CANDIDATAS / slug
        existentes = {f['archivo']: f for f in d['candidatas'] if (carpeta / f['archivo']).exists()}
        if not existentes:
            continue
        elegidas = [f['archivo'] for f in d['elegidas'] if f['archivo'] in existentes]
        falta = len(d['elegidas']) - len(elegidas)
        if falta > 0:
            resto = sorted((f for a, f in existentes.items() if a not in elegidas), key=lambda f: -f['puntaje'])
            elegidas += [f['archivo'] for f in resto[:falta]]
        orden = {a: i + 1 for i, a in enumerate(elegidas)}
        fotos = [{'archivo': a, 'licencia': f['licencia'], 'puntaje': f['puntaje'], 'titulo': f['titulo'], 'autor': f['autor'],
                  'origen': f['origen'], 'nueva': bool(f.get('nueva')), 'orden': orden.get(a, 0)} for a, f in existentes.items()]
        fotos.sort(key=lambda f: (f['orden'] == 0, f['orden'], -f['puntaje']))
        a = arts.get(slug, {})
        lista.append({'slug': slug, 'nombre': a.get('base', d.get('base', slug)), 'depto': a.get('departamento', ''),
                      'sub': a.get('subcategoria', ''), 'fotos': fotos})
    lista.sort(key=lambda x: (x['depto'], x['nombre']))
    return lista


def ruta_foto(slug, archivo, base):
    """Ruta segura dentro de `base`, o None."""
    if not ARCHIVO_OK.match(slug) or not ARCHIVO_OK.match(archivo):
        return None
    ruta = (base / slug / archivo).resolve()
    return ruta if base.resolve() in ruta.parents and ruta.is_file() else None


def miniatura(slug, archivo):
    destino = MINIATURAS / slug / (archivo + '.jpg')
    if not destino.exists():
        origen = ruta_foto(slug, archivo, CANDIDATAS)
        if not origen:
            return None
        destino.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(origen).convert('RGB')
        im.thumbnail((380, 380), Image.LANCZOS)
        im.save(destino, 'JPEG', quality=78)
    return destino


def borrar(marcadas):
    """Mueve las fotos marcadas a salida/rechazadas/ y las anota como descartadas."""
    with CANDADO:
        sel, _ = cargar()
        movidas = 0
        for m in marcadas:
            slug, archivo = m.get('slug', ''), m.get('archivo', '')
            origen = ruta_foto(slug, archivo, CANDIDATAS)
            previo = sel.get(slug)
            if not origen or not previo:
                continue
            destino = SALIDA / 'rechazadas' / slug
            destino.mkdir(parents=True, exist_ok=True)
            origen.replace(destino / archivo)
            for c in previo['candidatas']:
                if c['archivo'] == archivo:
                    previo.setdefault('descartadas', []).append(c['url'])
            movidas += 1
        for slug in {m.get('slug') for m in marcadas}:
            if slug in sel:
                carpeta = CANDIDATAS / slug
                sel[slug]['candidatas'] = [c for c in sel[slug]['candidatas'] if (carpeta / c['archivo']).exists()]
        RUTA_SEL.write_text(json.dumps(sel, ensure_ascii=False, indent=1), encoding='utf-8')
        return movidas


def publicar():
    salida = io.StringIO()
    with CANDADO, contextlib.redirect_stdout(salida):
        try:
            procesar_fotos.main()
        except SystemExit as e:
            print(e)
    return salida.getvalue().strip()


class Manejador(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def enviar(self, tipo, cuerpo, codigo=200):
        if isinstance(cuerpo, str):
            cuerpo = cuerpo.encode('utf-8')
        self.send_response(codigo)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(cuerpo)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        ruta = urlparse(self.path).path
        if ruta == '/':
            return self.enviar('text/html; charset=utf-8', PAGINA.replace('__TOKEN__', TOKEN))
        if ruta == '/datos':
            return self.enviar('application/json', json.dumps(datos(), ensure_ascii=False))
        partes = ruta.split('/')
        if len(partes) == 4 and partes[1] in ('mini', 'foto'):
            archivo = miniatura(partes[2], partes[3]) if partes[1] == 'mini' else ruta_foto(partes[2], partes[3], CANDIDATAS)
            if archivo:
                tipo = 'image/jpeg' if archivo.suffix.lower() in ('.jpg', '.jpeg') else 'image/' + archivo.suffix.lower().lstrip('.')
                return self.enviar(tipo, archivo.read_bytes())
        self.enviar('text/plain', 'No encontrado', 404)

    def do_POST(self):
        if self.headers.get('X-Token') != TOKEN:
            return self.enviar('text/plain', 'No autorizado', 403)
        largo = int(self.headers.get('Content-Length') or 0)
        cuerpo = json.loads(self.rfile.read(largo) or b'{}')
        ruta = urlparse(self.path).path
        if ruta == '/borrar':
            return self.enviar('application/json', json.dumps({'movidas': borrar(cuerpo.get('marcadas', []))}))
        if ruta == '/publicar':
            return self.enviar('application/json', json.dumps({'mensaje': publicar()}, ensure_ascii=False))
        self.enviar('text/plain', 'No encontrado', 404)


PAGINA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisión de fotos</title>
<style>
:root{--rojo:#d92300;--verde:#1b7a3a;--gris:#6b6b6b;--borde:#ddd}
*{box-sizing:border-box}
body{margin:0;font:14px system-ui,sans-serif;background:#f6f4f1;color:#222}
header{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 20px;background:#fff;border-bottom:1px solid var(--borde)}
header h1{font-size:16px;margin:0 8px 0 0}
input[type=search],select{padding:7px 10px;border:1px solid var(--borde);border-radius:8px;font:inherit}
button{padding:8px 14px;border:1px solid var(--borde);border-radius:8px;background:#fff;font:inherit;cursor:pointer}
button.peligro{background:var(--rojo);border-color:var(--rojo);color:#fff;font-weight:700}
button.primario{background:#222;border-color:#222;color:#fff}
button:disabled{opacity:.45;cursor:default}
.cuenta{margin-left:auto;font-weight:700}
main{padding:14px 20px 80px}
section{margin-bottom:22px}
section h2{display:flex;gap:10px;align-items:baseline;margin:0 0 8px;font-size:15px}
section h2 small{color:var(--gris);font-weight:400}
section h2 a{margin-left:auto;font-size:12px;color:#06c;cursor:pointer}
.fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
figure{position:relative;margin:0;border:3px solid transparent;border-radius:10px;background:#fff;overflow:hidden;cursor:pointer}
figure img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
figure.extra img{opacity:.55}
figure.nueva{border-color:#f47b20}
figure.marcada{border-color:var(--rojo)}
figure.marcada img{opacity:.35;filter:grayscale(.6)}
figure.marcada::after{content:"\\2715";position:absolute;inset:0;display:grid;place-items:center;font-size:64px;font-weight:700;color:var(--rojo);pointer-events:none}
figcaption{padding:4px 7px;font-size:11px;color:var(--gris);line-height:1.3}
.etiqueta{position:absolute;top:6px;left:6px;padding:2px 7px;border-radius:99px;background:var(--verde);color:#fff;font-size:11px;font-weight:700}
.etiqueta.extra{background:#777}
.lupa{position:absolute;top:6px;right:6px;width:28px;height:28px;padding:0;border-radius:99px;border:0;background:rgb(0 0 0/.6);color:#fff;font-size:14px;z-index:2}
#visor{position:fixed;inset:0;z-index:20;display:none;place-items:center;background:rgb(0 0 0/.85);padding:20px}
#visor.abierto{display:grid}
#visor div{max-width:min(92vw,900px);color:#fff;text-align:center}
#visor img{max-width:100%;max-height:78vh;border-radius:8px}
#visor a{color:#9cf}
#aviso{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);padding:10px 18px;border-radius:10px;background:#222;color:#fff;display:none;z-index:30;max-width:90vw;white-space:pre-line}
</style></head><body>
<header>
<h1>Revisión de fotos</h1>
<input type="search" id="buscar" placeholder="Buscar artículo…">
<select id="depto"><option value="">Todos los departamentos</option></select>
<label><input type="checkbox" id="solotienda"> Solo las de la tienda</label>
<span class="cuenta" id="cuenta">Marcadas: 0</span>
<button id="quitar">Quitar marcas</button>
<button class="peligro" id="borrar" disabled>Borrar marcadas</button>
<button class="primario" id="publicar">Actualizar tienda</button>
</header>
<main id="lista"></main>
<div id="visor"><div><img id="visorimg" alt=""><p id="visortxt"></p></div></div>
<div id="aviso"></div>
<script>
const TOKEN = "__TOKEN__";
let articulos = [];
let marcadas = new Set(JSON.parse(localStorage.getItem("marcadas") || "[]"));
const $ = (id) => document.getElementById(id);
const clave = (slug, archivo) => slug + "/" + archivo;

function aviso(t, ms = 4500) {
  const a = $("aviso"); a.textContent = t; a.style.display = "block";
  clearTimeout(aviso.t); aviso.t = setTimeout(() => (a.style.display = "none"), ms);
}
function guardar() { localStorage.setItem("marcadas", JSON.stringify([...marcadas])); actualizarCuenta(); }
function actualizarCuenta() {
  $("cuenta").textContent = "Marcadas: " + marcadas.size;
  $("borrar").disabled = marcadas.size === 0;
  $("borrar").textContent = marcadas.size ? "Borrar " + marcadas.size + (marcadas.size === 1 ? " marcada" : " marcadas") : "Borrar marcadas";
}
function visible(a) {
  const q = $("buscar").value.trim().toLowerCase();
  return (!q || a.nombre.toLowerCase().includes(q)) && (!$("depto").value || a.depto === $("depto").value);
}
function foto(a, f) {
  const fig = document.createElement("figure");
  const k = clave(a.slug, f.archivo);
  fig.className = (f.orden ? "" : "extra ") + (f.nueva ? "nueva " : "") + (marcadas.has(k) ? "marcada" : "");
  const img = document.createElement("img");
  img.loading = "lazy"; img.src = "/mini/" + a.slug + "/" + f.archivo; img.alt = "";
  const et = document.createElement("span");
  et.className = "etiqueta" + (f.orden ? "" : " extra");
  et.textContent = f.orden ? (f.orden === 1 ? "portada" : "tienda " + f.orden) : "extra";
  const lupa = document.createElement("button");
  lupa.className = "lupa"; lupa.textContent = "\\u{1F50D}"; lupa.title = "Ver grande";
  lupa.onclick = (e) => { e.stopPropagation(); abrirVisor(a, f); };
  const cap = document.createElement("figcaption");
  cap.textContent = f.archivo + " \\u00b7 " + f.licencia + " \\u00b7 " + f.puntaje;
  fig.append(img, et, lupa, cap);
  fig.onclick = () => {
    if (marcadas.has(k)) marcadas.delete(k); else marcadas.add(k);
    fig.classList.toggle("marcada"); guardar();
  };
  return fig;
}
function pintar() {
  const cont = $("lista"); cont.textContent = "";
  const solo = $("solotienda").checked;
  for (const a of articulos.filter(visible)) {
    const fotos = a.fotos.filter((f) => !solo || f.orden);
    if (!fotos.length) continue;
    const sec = document.createElement("section");
    const h = document.createElement("h2");
    h.textContent = a.nombre;
    const sm = document.createElement("small");
    sm.textContent = a.depto + " \\u00b7 " + a.fotos.filter((f) => f.orden).length + " en la tienda \\u00b7 " + a.fotos.length + " en total";
    const tog = document.createElement("a"); tog.textContent = "marcar / quitar todas";
    tog.onclick = () => {
      const ks = fotos.map((f) => clave(a.slug, f.archivo));
      const todas = ks.every((k) => marcadas.has(k));
      ks.forEach((k) => (todas ? marcadas.delete(k) : marcadas.add(k)));
      guardar(); pintar();
    };
    h.append(sm, tog);
    const grid = document.createElement("div"); grid.className = "fotos";
    fotos.forEach((f) => grid.append(foto(a, f)));
    sec.append(h, grid); cont.append(sec);
  }
  if (!cont.firstChild) cont.textContent = "No hay fotos con ese filtro.";
  actualizarCuenta();
}
async function cargar() {
  articulos = await (await fetch("/datos")).json();
  const vivas = new Set(articulos.flatMap((a) => a.fotos.map((f) => clave(a.slug, f.archivo))));
  marcadas = new Set([...marcadas].filter((k) => vivas.has(k)));
  const sel = $("depto"), actual = sel.value;
  sel.length = 1;
  [...new Set(articulos.map((a) => a.depto))].filter(Boolean).forEach((d) => sel.add(new Option(d, d)));
  sel.value = actual; guardar(); pintar();
}
function abrirVisor(a, f) {
  $("visorimg").src = "/foto/" + a.slug + "/" + f.archivo;
  const t = $("visortxt"); t.textContent = a.nombre + " \\u00b7 " + f.titulo + " \\u00b7 " + f.autor + " \\u00b7 " + f.licencia + " ";
  const l = document.createElement("a"); l.href = f.origen; l.target = "_blank"; l.rel = "noopener"; l.textContent = "origen";
  t.append(l); $("visor").classList.add("abierto");
}
$("visor").onclick = () => $("visor").classList.remove("abierto");
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("visor").classList.remove("abierto"); });
async function enviar(ruta, cuerpo) {
  const r = await fetch(ruta, { method: "POST", headers: { "X-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  if (!r.ok) throw new Error("Error " + r.status);
  return r.json();
}
$("borrar").onclick = async () => {
  if (!confirm("\\u00bfMover " + marcadas.size + " fotos a salida/rechazadas?")) return;
  const lista = [...marcadas].map((k) => { const i = k.indexOf("/"); return { slug: k.slice(0, i), archivo: k.slice(i + 1) }; });
  try {
    const r = await enviar("/borrar", { marcadas: lista });
    marcadas.clear(); guardar(); await cargar();
    aviso(r.movidas + " fotos movidas a rechazadas.\\nPulsa \\u201cActualizar tienda\\u201d cuando termines.");
  } catch (e) { aviso(e.message); }
};
$("quitar").onclick = () => { marcadas.clear(); guardar(); pintar(); };
$("publicar").onclick = async () => {
  $("publicar").disabled = true; aviso("Procesando fotos\\u2026", 60000);
  try { aviso((await enviar("/publicar", {})).mensaje, 9000); } catch (e) { aviso(e.message); }
  $("publicar").disabled = false;
};
["buscar", "depto", "solotienda"].forEach((id) => $(id).addEventListener("input", pintar));
cargar();
</script></body></html>
"""


def main():
    if not RUTA_SEL.exists():
        raise SystemExit('No hay salida/seleccion.json: ejecuta primero buscar_fotos.py')
    servidor = None
    for puerto in range(PUERTO, PUERTO + 10):
        try:
            servidor = ThreadingHTTPServer(('127.0.0.1', puerto), Manejador)
            break
        except OSError:
            continue
    if not servidor:
        raise SystemExit(f'No hay un puerto libre entre {PUERTO} y {PUERTO + 9}.')
    url = f'http://127.0.0.1:{servidor.server_address[1]}/'
    print(f'Revisión de fotos en {url}  (Ctrl+C para cerrar)')
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('Cerrado.')


if __name__ == '__main__':
    main()
