"""Revisa con un modelo de visión (CLIP) si una foto muestra el alimento suelto, tal como se compra,
y no un plato servido, una planta, un local o una persona.

Necesita (una vez, unos 1,2 GB entre librerías y modelo):
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install transformers
Corre en la CPU, sin cuenta ni costo: unas 3 fotos por segundo.
"""

MODELO = 'openai/clip-vit-base-patch32'
UMBRAL = 0.5

# Qué se espera ver y qué no. Si la suma de las frases "buenas" supera el umbral, la foto sirve.
FRASES_MALAS = [
    'a plate of cooked food served at a restaurant',
    'a meal on a table with sauce and side dishes',
    'fried or grilled food in a basket or bowl',
    'a plant or tree growing outdoors',
    'the outside of a store, a market stall or a building',
    'a person or a group of people',
    'a drawing, a painting or an illustration',
    'food with flies or insects on it',
    'a hand holding food outdoors on grass',
    'dirty, unhygienic or spoiled food',
    'a blurry, dark or low quality snapshot',
    'a live animal on a farm or in the wild',
    'a camera, a machine, a tool or any object that is not food',
    'a close-up of a texture or a surface',
    'a child or a person eating, posing or wearing a costume',
    'a botanical diagram, a scientific illustration or a vintage plate of a plant',
    'green leaves, stems or flowers of a plant growing in a field or garden',
    'shelves in a supermarket aisle full of many different products',
    'a vintage advertisement, poster or old label',
]
# En panadería y pastelería se acepta el producto servido; solo se descartan plantas, locales, personas y dibujos.
FRASES_MALAS_PANADERIA = [f for f in FRASES_MALAS[3:] if 'live animal' not in f]  # sin plato servido, comida cocinada ni mesa


def _tensor(salida):
    """Según la versión de transformers, las características vienen como tensor o dentro de un objeto."""
    return salida if hasattr(salida, 'norm') else salida.pooler_output


class Revisor:
    def __init__(self):
        import torch
        from transformers import CLIPModel, CLIPProcessor
        self.torch = torch
        self.modelo = CLIPModel.from_pretrained(MODELO).eval()
        self.proc = CLIPProcessor.from_pretrained(MODELO)
        self.texto = {}

    def _texto(self, ingles, panaderia, no_es=()):
        clave = (ingles, panaderia, tuple(no_es))
        if clave not in self.texto:
            if panaderia:
                buenas = [f'a photo of {ingles}', f'{ingles}, product photo on a plain background']
                malas = FRASES_MALAS_PANADERIA
            else:
                buenas = [f'raw uncooked {ingles}, an ingredient to cook', f'{ingles} in a store tray or package, product photo']
                malas = FRASES_MALAS + [f'cooked, fried or grilled {ingles}', f'a dish of {ingles} served on a plate with sauce']
            frases = buenas + malas + list(no_es)
            with self.torch.no_grad():
                entrada = self.proc(text=frases, return_tensors='pt', padding=True)
                emb = _tensor(self.modelo.get_text_features(**entrada))
                emb = emb / emb.norm(dim=-1, keepdim=True)
            self.texto[clave] = (emb, len(buenas))
        return self.texto[clave]

    def probabilidad(self, img, ingles, panaderia=False, no_es=()):
        """Probabilidad de que la foto sea el alimento suelto (0 a 1)."""
        emb_texto, n_buenas = self._texto(ingles, panaderia, no_es)
        with self.torch.no_grad():
            entrada = self.proc(images=img.convert('RGB'), return_tensors='pt')
            emb = _tensor(self.modelo.get_image_features(**entrada))
            emb = emb / emb.norm(dim=-1, keepdim=True)
            logits = 100.0 * emb @ emb_texto.T
            probs = logits.softmax(dim=-1)[0]
        return float(probs[:n_buenas].sum())

    def filtro(self, articulo):
        """Función que dice si una foto sirve para ese artículo."""
        ingles = articulo['consultas'][0]
        # Panes, pasteles y los envasados o no alimentos (prioridad 2) no se comparan con "ingrediente crudo".
        panaderia = articulo.get('subcategoria') in ('Panes', 'Pasteles y tortas') or articulo.get('prioridad') == 2
        no_es = articulo.get('no_es', [])
        return lambda img: self.probabilidad(img, ingles, panaderia, no_es) >= UMBRAL
