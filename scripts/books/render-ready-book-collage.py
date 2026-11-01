"""Compose the photographic-style collages (#2854) from verified author-1 originals.

Asset preparation only: the page, type, QR and print geometry come from the shared
ready-book renderer. Each canvas equals one renderer image box (mm), so the asset
is embedded with full artworkBounds. No photo is ever upscaled: the canvas uses a
resolution no higher than the lowest effective resolution of the photographs
placed on it, capped at 300 ppi, and every placement is checked.

Usage: python scripts/books/render-ready-book-collage.py by pl
Reads  data/travelBooks/<country>/photo-evidence.json and the originals index
       .codex-temp/books-photo/originals/index.json
Writes .codex-temp/books-photo/collages/<country>/<stopId>-<box>.png and
       .codex-temp/books-photo/collage-registry.json
"""
import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path.cwd()
PHOTO_ROOT = ROOT / '.codex-temp/books-photo'
PAPER = (0xff, 0xfe, 0xfa)
MAX_PPI = 300.0
# A photo narrower than this at its slot is placed smaller instead of dragging the canvas down.
PLACEMENT_FLOOR_PPI = 180.0
VERSION = 2

# Renderer boxes in millimetres. The A5 destination page keeps the heading band
# (15–40 mm) and the story/QR band (from 138 mm) on plain paper; photos live in 38–136 mm.
BOXES = {
    'page-album-a5': {'size': (148, 210), 'zone': (0, 38, 148, 136), 'feather': 12},
    'page-pocket-150x100': {'size': (62, 42), 'zone': (0, 0, 62, 42), 'feather': 6},
    'cover-album-a5': {'size': (148, 106), 'zone': (0, 0, 148, 106), 'feather': 14},
    'cover-pocket-150x100': {'size': (120, 41), 'zone': (0, 0, 120, 41), 'feather': 7},
}

# Slot templates: fractions of the zone (x, y, width) per photo count; the first
# slot is the main photograph. Later slots overlap the main one and dissolve into it.
TEMPLATES = {
    'page-album-a5': {
        1: [(0.03, 0.03, 0.94)],
        2: [(0.0, 0.0, 0.78), (0.42, 0.48, 0.56)],
        3: [(0.01, 0.0, 0.76), (0.62, 0.0, 0.37), (0.44, 0.38, 0.55)],
    },
    'page-pocket-150x100': {
        1: [(0.0, 0.0, 1.0)],
        2: [(0.0, 0.0, 0.8), (0.4, 0.3, 0.6)],
        3: [(0.0, 0.0, 0.72), (0.52, 0.0, 0.48), (0.4, 0.42, 0.56)],
    },
    'cover-album-a5': {
        1: [(0.06, 0.0, 0.88)],
        2: [(0.0, 0.0, 0.7), (0.46, 0.42, 0.54)],
        3: [(0.13, 0.0, 0.73), (0.01, 0.47, 0.5), (0.49, 0.44, 0.51)],
    },
    'cover-pocket-150x100': {
        1: [(0.25, 0.0, 0.5)],
        2: [(0.02, 0.0, 0.5), (0.5, 0.05, 0.47)],
        3: [(0.0, 0.15, 0.38), (0.26, 0.0, 0.48), (0.62, 0.15, 0.38)],
    },
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def smooth(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def feather_mask(w: int, h: int, f: float, power: float = 4.0) -> Image.Image:
    """Superellipse vignette with a fade band about f px wide: no rectangular edge remains."""
    sw, sh = max(8, w // 4), max(8, h // 4)
    band = max(1e-6, 2 * f / min(w, h))
    data = []
    for j in range(sh):
        y = abs(2 * j / (sh - 1) - 1)
        for i in range(sw):
            x = abs(2 * i / (sw - 1) - 1)
            d = (x ** power + y ** power) ** (1 / power)
            data.append(int(255 * smooth((1 - d) / band)))
    small = Image.new('L', (sw, sh))
    small.putdata(data)
    return small.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(max(0.5, f / 6)))


def plan_layout(box: dict, template, photos):
    """Resolve slots to millimetres, shrinking any slot whose photo would fall below the placement floor."""
    zx, zy, zx2, zy2 = box['zone']
    zone_w, zone_h = zx2 - zx, zy2 - zy
    items = []
    for (fx, fy, fw), photo in zip(template, photos):
        width_mm = fw * zone_w
        max_by_floor = photo['widthPx'] * 25.4 / PLACEMENT_FLOOR_PPI
        width_mm = min(width_mm, max_by_floor)
        height_mm = width_mm * photo['heightPx'] / photo['widthPx']
        if height_mm > zone_h:
            height_mm = zone_h
            width_mm = height_mm * photo['widthPx'] / photo['heightPx']
        x = zx + fx * zone_w
        y = zy + fy * zone_h
        # Keep the photo inside the zone (it may still fade past the box edge by the feather).
        x = min(x, zx2 - width_mm)
        y = min(y, zy2 - height_mm)
        x = max(zx, x)
        y = max(zy, y)
        items.append({'photo': photo, 'x': x, 'y': y, 'w': width_mm, 'h': height_mm})
    return items


def build(name: str, box: dict, photos: list, originals: dict, out_dir: Path, feather_scale: float = 1.0) -> dict:
    wmm, hmm = box['size']
    template = TEMPLATES[name][len(photos)]
    items = plan_layout(box, template, photos)
    native_ppi = [item['photo']['widthPx'] / item['w'] * 25.4 for item in items]
    canvas_ppi = min(MAX_PPI, math.floor(min(native_ppi)))
    pxmm = canvas_ppi / 25.4
    W, H = round(wmm * pxmm), round(hmm * pxmm)
    canvas = Image.new('RGB', (W, H), PAPER)
    placed = []
    feather_mm = box['feather'] * feather_scale
    # Later slots sit on top of the main photograph: paste in reverse order of importance.
    for index, item in reversed(list(enumerate(items))):
        src = item['photo']
        with Image.open(ROOT / originals[src['originalUri']]['localPath']) as image:
            image = image.convert('RGB')
            tw = round(item['w'] * pxmm)
            th = round(tw * image.height / image.width)
            if tw > image.width or th > image.height:
                raise SystemExit(f'{name}: photo {src["sha256"][:12]} would be upscaled ({tw}×{th} from {image.width}×{image.height})')
            image = image.resize((tw, th), Image.LANCZOS)
        mask = feather_mask(tw, th, feather_mm * pxmm)
        x, y = round(item['x'] * pxmm), round(item['y'] * pxmm)
        canvas.paste(image, (x, y), mask)
        placed.insert(0, {
            'sha256': src['sha256'], 'originalUri': src['originalUri'], 'widthPx': src['widthPx'], 'heightPx': src['heightPx'],
            'placedWidthMm': round(item['w'], 2), 'placedHeightMm': round(item['h'], 2), 'placedOffsetMm': [round(item['x'], 2), round(item['y'], 2)],
            'nativePpiAtPlacedSize': round(native_ppi[index], 1), 'embeddedPpi': round(min(native_ppi[index], canvas_ppi), 1),
            'resampledTo': [tw, th], 'upscaled': False,
        })
    # Exact paper on the renderer box boundary: 1.5 mm ramp to #fffefa.
    edge = max(1.0, 1.5 * pxmm)
    col = Image.new('L', (W, 1))
    col.putdata([int(255 * smooth(min(x, W - 1 - x) / edge)) for x in range(W)])
    row = Image.new('L', (1, H))
    row.putdata([int(255 * smooth(min(y, H - 1 - y) / edge)) for y in range(H)])
    keep = ImageChops.multiply(col.resize((W, H)), row.resize((W, H)))
    canvas = Image.composite(canvas, Image.new('RGB', (W, H), PAPER), keep)
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f'{name}.png'
    canvas.save(out, optimize=True)
    return {'box': name, 'path': str(out.relative_to(ROOT)), 'sha256': sha256(out), 'widthPx': W, 'heightPx': H,
            'boxMm': [wmm, hmm], 'canvasPpi': canvas_ppi, 'featherMm': round(feather_mm, 2), 'photos': placed}


def main(countries):
    # The index is keyed by the canonical original URI; identical bytes may be published under
    # several URIs (article body and point photo), so look photos up by URI, never by hash alone.
    originals = json.loads((PHOTO_ROOT / 'originals/index.json').read_text())
    registry_path = PHOTO_ROOT / 'collage-registry.json'
    registry = json.loads(registry_path.read_text()) if registry_path.exists() else {'schemaVersion': 1, 'composer': {}, 'countries': {}}
    registry['composer'] = {'script': 'scripts/books/render-ready-book-collage.py', 'version': VERSION, 'sha256': sha256(Path(__file__)),
                            'rules': {'maxPpi': MAX_PPI, 'placementFloorPpi': PLACEMENT_FLOOR_PPI, 'upscaling': False, 'ai': False, 'stock': False, 'resample': 'Pillow LANCZOS downscale only'}}
    for country in countries:
        evidence = json.loads((ROOT / f'data/travelBooks/{country}/photo-evidence.json').read_text())
        if evidence['country'] != country.upper():
            raise SystemExit('Country mismatch: ' + country)
        places = []
        for place in evidence['places']:
            used = [photo for photo in place['photos'] if photo['status'] == 'used']
            if not 1 <= len(used) <= 3:
                raise SystemExit(f'{place["stopId"]}: expected 1–3 used photos, got {len(used)}')
            if used[0].get('role') != 'main':
                raise SystemExit(f'{place["stopId"]}: the first used photo must be the main frame')
            for photo in used:
                entry = originals.get(photo['originalUri'])
                if not entry:
                    raise SystemExit(f'{place["stopId"]}: original {photo["originalUri"]} is not downloaded')
                if (entry['widthPx'], entry['heightPx'], entry['sha256']) != (photo['widthPx'], photo['heightPx'], photo['sha256']):
                    raise SystemExit(f'{place["stopId"]}: evidence differs from the downloaded original')
            out_dir = PHOTO_ROOT / 'collages' / country
            assets = {name: build(name, BOXES[name], used[:3] if name.startswith('page') else used[:3], originals, out_dir / place['stopId'])
                      for name in ('page-album-a5', 'page-pocket-150x100')}
            places.append({'stopId': place['stopId'], 'pointId': place['pointId'], 'articleId': place['articleId'], 'assets': assets})
            print(country, place['stopId'], {name: (asset['widthPx'], asset['heightPx'], asset['canvasPpi']) for name, asset in assets.items()})
        cover_place = next(place for place in evidence['places'] if place['stopId'] == evidence['cover']['stopId'])
        cover_used = [photo for photo in cover_place['photos'] if photo['status'] == 'used']
        cover_assets = {name: build(name, BOXES[name], cover_used[:3], originals, PHOTO_ROOT / 'collages' / country / 'cover')
                        for name in ('cover-album-a5', 'cover-pocket-150x100')}
        registry['countries'][country.upper()] = {'evidenceSha256': sha256(ROOT / f'data/travelBooks/{country}/photo-evidence.json'),
                                                   'places': places, 'cover': {'stopId': cover_place['stopId'], 'assets': cover_assets}}
        print(country, 'cover', {name: (asset['widthPx'], asset['heightPx'], asset['canvasPpi']) for name, asset in cover_assets.items()})
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=1) + '\n')


if __name__ == '__main__':
    countries = [arg for arg in sys.argv[1:] if not arg.startswith('--')]
    if not countries:
        raise SystemExit('Usage: render-ready-book-collage.py by pl')
    main(countries)
