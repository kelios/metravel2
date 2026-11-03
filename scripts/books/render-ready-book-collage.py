"""Compose the photographic-style plates (#2854, #2968) from verified author-1 originals.

Asset preparation only: the page, type, QR and print geometry come from the shared
ready-book renderer. Each canvas equals one renderer image box (mm), so the asset
is embedded with full artworkBounds. A plate carries exactly ONE people-free
photograph with crisp edges: no second frame, no feathering, no fade into the paper.
A photo with an owner-approved `retouch` record is read from its SHA-pinned derivative.
Place pages show the whole frame (contain); covers fill their box (cover crop).
No photo is ever upscaled: the canvas resolution never exceeds the effective
resolution of its photograph and is capped at 300 ppi.

The file keeps its historical name because the collage registry and the source
loader pin it by path and hash (scripts/books/source-ready-book.mjs).

Usage: python scripts/books/render-ready-book-collage.py by pl
Reads  data/travelBooks/<country>/photo-evidence.json and the originals index
       .codex-temp/books-photo/originals/index.json
Writes .codex-temp/books-photo/collages/<country>/<stopId>/<box>.png and
       .codex-temp/books-photo/collage-registry.json
"""
import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image

ROOT = Path.cwd()
PHOTO_ROOT = ROOT / '.codex-temp/books-photo'
PAPER = (0xff, 0xfe, 0xfa)
MAX_PPI = 300.0
# A page photo that would print below this is placed smaller, centred in its zone, instead of dragging the canvas down.
PLACEMENT_FLOOR_PPI = 180.0
VERSION = 3

# Renderer boxes in millimetres. The A5 destination page keeps the heading band
# (15–40 mm) and the story/QR band (from 138 mm) on plain paper; the photo lives in
# the zone 38–136 mm with a quiet margin. `fit` is contain for pages, cover for covers.
BOXES = {
    'page-album-a5': {'size': (148, 210), 'zone': (6, 40, 142, 134), 'fit': 'contain'},
    'page-pocket-150x100': {'size': (62, 42), 'zone': (0, 0, 62, 42), 'fit': 'contain'},
    'cover-album-a5': {'size': (148, 106), 'zone': (0, 0, 148, 106), 'fit': 'cover'},
    'cover-pocket-150x100': {'size': (120, 41), 'zone': (0, 0, 120, 41), 'fit': 'cover'},
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def plan(box: dict, photo: dict, focus_y: float):
    """Placed rectangle (mm) and the source crop (px) for one photograph."""
    zx, zy, zx2, zy2 = box['zone']
    zone_w, zone_h = zx2 - zx, zy2 - zy
    pw, ph = photo['widthPx'], photo['heightPx']
    if box['fit'] == 'contain':
        scale = min(zone_w / pw, zone_h / ph, 25.4 / PLACEMENT_FLOOR_PPI)
        w, h = pw * scale, ph * scale
        return {'x': zx + (zone_w - w) / 2, 'y': zy + (zone_h - h) / 2, 'w': w, 'h': h, 'crop': (0, 0, pw, ph)}
    # Cover: fill the zone, cropping the longer side; focus_y picks the vertical band (0 top … 1 bottom).
    if pw / ph > zone_w / zone_h:
        cw, ch = round(ph * zone_w / zone_h), ph
        left, top = (pw - cw) // 2, 0
    else:
        cw, ch = pw, round(pw * zone_h / zone_w)
        left, top = 0, round((ph - ch) * focus_y)
    return {'x': zx, 'y': zy, 'w': zone_w, 'h': zone_h, 'crop': (left, top, left + cw, top + ch)}


def build(name: str, photo: dict, originals: dict, out_dir: Path, focus_y: float = 0.5) -> dict:
    box = BOXES[name]
    wmm, hmm = box['size']
    item = plan(box, photo, focus_y)
    left, top, right, bottom = item['crop']
    native_ppi = (right - left) / item['w'] * 25.4
    canvas_ppi = min(MAX_PPI, math.floor(native_ppi))
    pxmm = canvas_ppi / 25.4
    W, H = round(wmm * pxmm), round(hmm * pxmm)
    canvas = Image.new('RGB', (W, H), PAPER)
    x, y = round(item['x'] * pxmm), round(item['y'] * pxmm)
    tw, th = min(round(item['w'] * pxmm), W - x), min(round(item['h'] * pxmm), H - y)
    # An owner-approved retouch (passers-by removed) replaces the pixels, never the geometry or the source record.
    retouch = photo.get('retouch')
    source = ROOT / (retouch['path'] if retouch else originals[photo['originalUri']]['localPath'])
    if retouch and sha256(source) != retouch['sha256']:
        raise SystemExit(f'{name}: retouched file differs from its record ({photo["sha256"][:12]})')
    with Image.open(source) as image:
        image = image.convert('RGB')
        if (image.width, image.height) != (photo['widthPx'], photo['heightPx']):
            raise SystemExit(f'{name}: photo {photo["sha256"][:12]} differs from its evidence size')
        image = image.crop(item['crop'])
        if tw > image.width or th > image.height:
            raise SystemExit(f'{name}: photo {photo["sha256"][:12]} would be upscaled ({tw}×{th} from {image.width}×{image.height})')
        canvas.paste(image.resize((tw, th), Image.LANCZOS), (x, y))
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f'{name}.png'
    canvas.save(out, optimize=True)
    placed = {
        'sha256': photo['sha256'], 'originalUri': photo['originalUri'], 'widthPx': photo['widthPx'], 'heightPx': photo['heightPx'],
        'placedWidthMm': round(item['w'], 2), 'placedHeightMm': round(item['h'], 2), 'placedOffsetMm': [round(item['x'], 2), round(item['y'], 2)],
        'sourceCropPx': [left, top, right - left, bottom - top], 'fit': box['fit'], 'retouchedSha256': retouch['sha256'] if retouch else None,
        'nativePpiAtPlacedSize': round(native_ppi, 1), 'embeddedPpi': round(min(native_ppi, canvas_ppi), 1),
        'resampledTo': [tw, th], 'upscaled': False,
    }
    return {'box': name, 'path': str(out.relative_to(ROOT)), 'sha256': sha256(out), 'widthPx': W, 'heightPx': H,
            'boxMm': [wmm, hmm], 'canvasPpi': canvas_ppi, 'featherMm': 0, 'photos': [placed]}


def check_original(stop_id: str, photo: dict, originals: dict):
    entry = originals.get(photo['originalUri'])
    if not entry:
        raise SystemExit(f'{stop_id}: original {photo["originalUri"]} is not downloaded')
    if (entry['widthPx'], entry['heightPx'], entry['sha256']) != (photo['widthPx'], photo['heightPx'], photo['sha256']):
        raise SystemExit(f'{stop_id}: evidence differs from the downloaded original')
    if photo.get('peopleFree') is not True:
        raise SystemExit(f'{stop_id}: the printed photograph must be checked free of people')


def main(countries):
    # The index is keyed by the canonical original URI; identical bytes may be published under
    # several URIs (article body and point photo), so look photos up by URI, never by hash alone.
    originals = json.loads((PHOTO_ROOT / 'originals/index.json').read_text())
    registry_path = PHOTO_ROOT / 'collage-registry.json'
    registry = json.loads(registry_path.read_text()) if registry_path.exists() else {'schemaVersion': 1, 'composer': {}, 'countries': {}}
    registry['composer'] = {'script': 'scripts/books/render-ready-book-collage.py', 'version': VERSION, 'sha256': sha256(Path(__file__)),
                            'rules': {'photosPerPlate': 1, 'feather': False, 'pageFit': 'contain', 'coverFit': 'cover', 'maxPpi': MAX_PPI, 'placementFloorPpi': PLACEMENT_FLOOR_PPI,
                                      'upscaling': False, 'ai': False, 'stock': False, 'resample': 'Pillow LANCZOS downscale only'}}
    for country in countries:
        evidence = json.loads((ROOT / f'data/travelBooks/{country}/photo-evidence.json').read_text())
        if evidence['country'] != country.upper():
            raise SystemExit('Country mismatch: ' + country)
        places = []
        for place in evidence['places']:
            used = [photo for photo in place['photos'] if photo['status'] == 'used']
            if len(used) != 1 or used[0].get('role') != 'main':
                raise SystemExit(f'{place["stopId"]}: expected exactly one used main photo, got {len(used)}')
            check_original(place['stopId'], used[0], originals)
            out_dir = PHOTO_ROOT / 'collages' / country / place['stopId']
            assets = {name: build(name, used[0], originals, out_dir) for name in ('page-album-a5', 'page-pocket-150x100')}
            places.append({'stopId': place['stopId'], 'pointId': place['pointId'], 'articleId': place['articleId'], 'assets': assets})
            print(country, place['stopId'], {name: (asset['widthPx'], asset['heightPx'], asset['canvasPpi']) for name, asset in assets.items()})
        cover = evidence['cover']
        check_original('cover', cover['photo'], originals)
        # Vertical band of the cover crop per box (0 top … 1 bottom); the strip and the A5 cover frame different parts.
        focus = cover.get('focusY', {})
        cover_assets = {name: build(name, cover['photo'], originals, PHOTO_ROOT / 'collages' / country / 'cover', focus.get(name, 0.5))
                        for name in ('cover-album-a5', 'cover-pocket-150x100')}
        registry['countries'][country.upper()] = {'evidenceSha256': sha256(ROOT / f'data/travelBooks/{country}/photo-evidence.json'),
                                                   'places': places, 'cover': {'stopId': cover['stopId'], 'assets': cover_assets}}
        print(country, 'cover', {name: (asset['widthPx'], asset['heightPx'], asset['canvasPpi']) for name, asset in cover_assets.items()})
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=1) + '\n')


if __name__ == '__main__':
    countries = [arg for arg in sys.argv[1:] if not arg.startswith('--')]
    if not countries:
        raise SystemExit('Usage: render-ready-book-collage.py by pl')
    main(countries)
