"""Стиль E + F для make-carousel.py (решение владельца 26.10.2026, ТЗ 17 и 18.1).

E — место: фото во всю ширину, низ плавно уходит в тёмный фон сайта; заголовок PT Serif, текст под фото.
    Для маршрута — карточка цифр (длина, подъём и спуск, время, сложность) и карта тропы рядом.
F — наш день: снимок в белой рамке с датой на том же тёмном фоне, заголовок и рассказ под ним.
Порядок в посте: сначала слайд места, потом слайд нашего дня (если эпизод есть в источниках).

Спецификация слайдов:
  {"type": "e", "image", "kicker", "title", "body"?, "role"?: "cover"|"scene", "focus"?: 0..1 (вертикаль окна кадра, 0.45),
   "stats"?: [[значение, подпись], ...] до 4 — только из sources.md,
   "route"?: {"line": "путь к .geojson (LineString)", "length_km": длина из sources.md, "zoom"?: 15,
              "marks": [{"name", "lat", "lng", "kind": "start"|"mid"|"goal"}]}}
  {"type": "f", "image", "date", "kicker", "title", "body", "focus"?, "angle"?}
  Оба типа: "crop"?: [x0, y0, x1, y1] — явный кроп исходника.
Линия маршрута длиннее или короче length_km больше чем на 25 % — сборка падает: карта не должна врать.
"""
import json
import math
import os
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

W, H = 1080, 1350
DARK, CELL = (21, 17, 26), (36, 29, 44)
INK, MUTED, AMBER, DATE = (238, 233, 227), (197, 188, 201), (232, 150, 90), (110, 92, 74)
ROUTE, ROUTE_EDGE = (232, 120, 60), (30, 22, 34)
FONTS = "/System/Library/Fonts/Supplemental/"
REPO = Path(__file__).resolve().parents[2]
TILE_CACHE = REPO / ".codex-temp/instagram/tiles-cache"
USER_AGENT = "metravel-carousel/1.0 (+https://metravel.by)"
TOPO_URL = "https://tile.opentopomap.org/{z}/{x}/{y}.png"
TOPO_CREDIT = "© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)"
LENGTH_TOLERANCE = 0.25


def font(kind, size):
    file, index = {"serif": ("PTSerif.ttc", 0), "serif_b": ("PTSerif.ttc", 3), "serif_i": ("PTSerif.ttc", 1),
                   "sans": ("PTSans.ttc", 0), "bold": ("PTSans.ttc", 7)}[kind]
    return ImageFont.truetype(FONTS + file, size, index=index)


def load(src):
    if str(src).startswith("http"):
        req = urllib.request.Request(src, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            src = __import__("io").BytesIO(resp.read())
    return ImageOps.exif_transpose(Image.open(src)).convert("RGB")


def source(spec):
    """Исходник слайда; "crop": [x0, y0, x1, y1] — явный кроп после EXIF-поворота (записать в package.md)."""
    img = load(spec["image"])
    return img.crop(tuple(spec["crop"])) if spec.get("crop") else img


def wrap(draw, text, fnt, width):
    lines = []
    for para in str(text).split("\n"):
        cur = ""
        for word in para.split():
            test = (cur + " " + word).strip()
            if draw.textlength(test, font=fnt) <= width or not cur:
                cur = test
            else:
                lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


def block(draw, xy, text, fnt, fill, width, gap=1.32):
    x, y = xy
    for line in wrap(draw, text, fnt, width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += int(fnt.size * gap)
    return y


def fade_bottom(img, start, length):
    w, h = img.size
    a = np.clip((np.arange(h) - start) / length, 0, 1)
    a = a * a * (3 - 2 * a)
    mask = Image.fromarray((np.repeat(a[:, None], w, 1) * 255).astype("uint8"), "L")
    return Image.composite(Image.new("RGB", (w, h), DARK), img, mask)


def mercator(lat, lng, z):
    s = 256 * 2 ** z
    return (lng + 180) / 360 * s, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * s


def line_km(coords):
    total = 0.0
    for (lng1, lat1), (lng2, lat2) in zip(coords, coords[1:]):
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp, dl = p2 - p1, math.radians(lng2 - lng1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        total += 6371.0 * 2 * math.asin(math.sqrt(a))
    return total


def route_coords(route):
    data = json.loads(Path(route["line"]).read_text(encoding="utf-8"))
    geom = data.get("geometry", data) if data.get("type") == "Feature" else data
    if geom.get("type") == "FeatureCollection":
        geom = geom["features"][0]["geometry"]
    coords = [c[:2] for c in geom["coordinates"]]
    expected = route.get("length_km")
    if expected:
        got = line_km(coords)
        if abs(got - expected) > expected * LENGTH_TOLERANCE:
            raise SystemExit(f"carousel_ef: линия {route['line']} — {got:.1f} км, а в sources.md {expected} км "
                             f"(допуск {int(LENGTH_TOLERANCE * 100)} %); карта не ставится, пока линия не исправлена")
    return coords


def tile(z, x, y):
    path = TILE_CACHE / f"otm-{z}-{x}-{y}.png"
    if not path.exists():
        TILE_CACHE.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(TOPO_URL.format(z=z, x=x, y=y), headers={"User-Agent": USER_AGENT})
        path.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return Image.open(path).convert("RGB")


def route_map(route, size):
    z = route.get("zoom", 15)
    coords = route_coords(route)
    pts = [mercator(lat, lng, z) for lng, lat in coords]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    span = max(max(xs) - min(xs), max(ys) - min(ys)) * 1.18 + 60
    left = (max(xs) + min(xs)) / 2 - span / 2
    top = (max(ys) + min(ys)) / 2 - span / 2
    tx0, ty0, tx1, ty1 = int(left // 256), int(top // 256), int((left + span) // 256), int((top + span) // 256)
    mosaic = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            mosaic.paste(tile(z, tx, ty), ((tx - tx0) * 256, (ty - ty0) * 256))
    ox, oy = left - tx0 * 256, top - ty0 * 256
    view = mosaic.crop((int(ox), int(oy), int(ox + span), int(oy + span)))
    view = ImageEnhance.Color(view).enhance(0.75).resize((size, size), Image.LANCZOS)
    k = size / span
    d = ImageDraw.Draw(view)
    line = [((x - left) * k, (y - top) * k) for x, y in pts]
    d.line(line, fill=ROUTE_EDGE, width=11, joint="curve")
    d.line(line, fill=ROUTE, width=6, joint="curve")
    lf = font("bold", 26)
    for m in route.get("marks", []):
        x, y = mercator(m["lat"], m["lng"], z)
        x, y = (x - left) * k, (y - top) * k
        kind = m.get("kind", "mid")
        r = 11 if kind == "mid" else 13
        d.ellipse((x - r, y - r, x + r, y + r), fill=ROUTE if kind == "goal" else (255, 255, 255), outline=ROUTE_EDGE, width=4)
        tw = d.textlength(m["name"], font=lf)
        bx = x + 20 if kind == "mid" else x - tw / 2 - 12
        by = {"start": y + 20, "goal": y - 62, "mid": y - 21}[kind]
        bx, by = min(max(bx, 8), size - tw - 32), min(max(by, 8), size - 60)
        d.rounded_rectangle((bx, by, bx + tw + 24, by + 40), 9, fill=(255, 255, 255))
        d.text((bx + 12, by + 5), m["name"], font=lf, fill=ROUTE_EDGE)
    cf = font("sans", 13)
    cw = d.textlength(TOPO_CREDIT, font=cf)
    d.rectangle((size - cw - 16, size - 20, size, size), fill=(255, 255, 255))
    d.text((size - cw - 8, size - 18), TOPO_CREDIT, font=cf, fill=(70, 70, 70))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), 22, fill=255)
    return view, mask


def stat_cells(draw, x, y, width, stats, cols, cell_h, value_size=48, label_size=30):
    gap = 14
    cw = (width - gap * (cols - 1)) // cols
    for k, (val, lab) in enumerate(stats):
        cx = x + (k % cols) * (cw + gap)
        cy = y + (k // cols) * (cell_h + gap)
        draw.rounded_rectangle((cx, cy, cx + cw, cy + cell_h), 16, fill=CELL)
        vs = value_size if draw.textlength(val, font=font("bold", value_size)) <= cw - 40 else int(value_size * 0.72)
        draw.text((cx + 22, cy + 12), val, font=font("bold", vs), fill=AMBER)
        draw.text((cx + 22, cy + cell_h - label_size - 20), lab, font=font("sans", label_size), fill=MUTED)
    rows = (len(stats) + cols - 1) // cols
    return y + rows * cell_h + (rows - 1) * gap


TEXT_BOTTOM = H - 118   # низ текстового блока: над подвалом (птичка, @metravelby, номер)


def e_text(im, d, spec, y, dry):
    """Текст слайда E от y; возвращает низ. dry — только измерить (карту не рисовать)."""
    cover = spec.get("role") == "cover"
    stats, route = spec.get("stats") or [], spec.get("route")
    x, width = 84, W - 168
    measure = (lambda text, fnt, gap: y + len(wrap(d, text, fnt, width)) * int(fnt.size * gap))
    d.text((x, y), spec["kicker"].upper(), font=font("bold", 28 if route or stats else 30), fill=AMBER) if not dry else None
    y += 50
    tsize = 54 if route else 56 if stats else 70 if cover else 62
    y = measure(spec["title"], font("serif_b", tsize), 1.12) if dry else block(d, (x, y), spec["title"], font("serif_b", tsize), INK, width, 1.12)
    if route:
        y += 20
        ms = 480
        if not dry:
            view, mask = route_map(route, ms)
            im.paste(view, (x, y), mask)
            cx = x + ms + 18
            cell_h = (ms - 12 * (len(stats) - 1)) // max(1, len(stats)) if stats else 0
            for k, (val, lab) in enumerate(stats):
                cy = y + k * (cell_h + 12)
                d.rounded_rectangle((cx, cy, W - x, cy + cell_h), 16, fill=CELL)
                vf = font("bold", 42 if d.textlength(val, font=font("bold", 42)) <= W - x - cx - 40 else 32)
                d.text((cx + 20, cy + 10), val, font=vf, fill=AMBER)
                d.text((cx + 20, cy + cell_h - 46), lab, font=font("sans", 26), fill=MUTED)
        y += ms + 26
        body_size = 34
    elif stats:
        y += 22
        cols = 2 if len(stats) == 4 else len(stats)
        if dry:
            rows = (len(stats) + cols - 1) // cols
            y += rows * 124 + (rows - 1) * 14 + 28
        else:
            y = stat_cells(d, x, y, width, stats, cols, 124) + 28
        body_size = 36
    else:
        if not dry:
            d.line((x, y + 18, x + 120, y + 18), fill=AMBER, width=4)
        y += 50
        body_size = 40 if cover else 38
    if spec.get("body"):
        fnt = font("sans", body_size)
        y = measure(spec["body"], fnt, 1.36) if dry else block(d, (x, y), spec["body"], fnt, MUTED, width, 1.36)
    return y


def slide_e(spec):
    """Фото — главное (владелец 26.10.2026: «снизу куча чёрного, а фотография почти не видна»):
    текст прижат к подвалу, фото занимает всё место над ним."""
    im = Image.new("RGB", (W, H), DARK)
    d = ImageDraw.Draw(im)
    route = spec.get("route")
    lead = 24 if route else 40           # насколько кикер заходит на растушёвку фото
    text_h = e_text(im, d, spec, 0, dry=True)
    text_top = TEXT_BOTTOM - text_h
    ph = max(380, min(1120, text_top + lead))
    fade = 150 if route else 220
    top = ImageOps.fit(source(spec), (W, ph), Image.LANCZOS, centering=(0.5, spec.get("focus", 0.45)))
    im.paste(fade_bottom(top, ph - fade, fade), (0, 0))
    d = ImageDraw.Draw(im)
    e_text(im, d, spec, ph - lead, dry=False)
    return im, None


def slide_f(spec):
    """Снимок в рамке занимает всё место над текстом, текст прижат к подвалу."""
    src = source(spec)
    im = Image.blend(Image.new("RGB", (W, H), DARK), ImageOps.fit(src, (W, H)).filter(ImageFilter.GaussianBlur(80)), 0.28)
    d = ImageDraw.Draw(im)
    x, width = 84, W - 168
    title_f, body_f = font("serif_b", 54), font("serif", 37)
    text_h = 48 + len(wrap(d, spec["title"], title_f, width)) * int(54 * 1.12) + 14 + len(wrap(d, spec["body"], body_f, width)) * int(37 * 1.36)
    text_top = TEXT_BOTTOM - text_h
    avail = text_top - 36 - 40          # верхнее поле и зазор до кикера
    pic_w = 900
    pic_h = max(520, min(980, avail - 22 * 2 - 64 - 30))
    pic = ImageOps.fit(src, (pic_w, pic_h), Image.LANCZOS, centering=(0.5, spec.get("focus", 0.45)))
    fr = ImageOps.expand(ImageOps.expand(pic, border=22, fill=(251, 249, 245)), border=(0, 0, 0, 64), fill=(251, 249, 245))
    rot = fr.convert("RGBA").rotate(spec.get("angle", -1.4), expand=True, resample=Image.BICUBIC)
    shadow = Image.new("RGBA", rot.size, (0, 0, 0, 0))
    shadow.paste(Image.new("RGBA", rot.size, (0, 0, 0, 110)), (0, 0), rot)
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    x0 = (W - rot.width) // 2
    y0 = max(24, (text_top - 40 - rot.height) // 2 + 10)
    im.paste(shadow, (x0 + 10, y0 + 12), shadow)
    im.paste(rot, (x0, y0), rot)
    d = ImageDraw.Draw(im)
    d.text((x0 + 44, y0 + rot.height - 78), spec["date"], font=font("serif_i", 32), fill=DATE)
    y = text_top
    d.text((x, y), spec["kicker"].upper(), font=font("bold", 28), fill=AMBER)
    y += 48
    y = block(d, (x, y), spec["title"], title_f, INK, width, 1.12)
    block(d, (x, y + 14), spec["body"], body_f, MUTED, width, 1.36)
    return im, None


def brouter_line(waypoints, out_path, profile="hiking-mountain"):
    """Линия по туристическим тропам OSM (BRouter). waypoints: [(lat, lng), ...]. Возвращает длину, км."""
    q = "|".join(f"{lng},{lat}" for lat, lng in waypoints)
    url = f"https://brouter.de/brouter?lonlats={q}&profile={profile}&alternativeidx=0&format=geojson"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    feature = json.load(urllib.request.urlopen(req, timeout=90))["features"][0]
    coords = [c[:2] for c in feature["geometry"]["coordinates"]]
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    Path(out_path).write_text(json.dumps({"type": "LineString", "coordinates": coords}), encoding="utf-8")
    return line_km(coords)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4 or sys.argv[1] != "route":
        raise SystemExit("usage: carousel_ef.py route <out.geojson> lat,lng lat,lng [...]")
    km = brouter_line([tuple(map(float, p.split(","))) for p in sys.argv[3:]], sys.argv[2])
    print(f"carousel_ef: линия {sys.argv[2]} — {km:.2f} км (сверить с sources.md)")
