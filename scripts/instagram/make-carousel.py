#!/usr/bin/env python3
"""Собирает карусель для Instagram (слайды 1080x1350) из фото и фактов статьи.

Вход — JSON-спецификация: {"out_dir": "...", "slides": [...]}. Типы слайдов:
  cover — {"type": "cover", "image", "kicker", "title", "subtitle"}
  list  — {"type": "list", "image"?, "kicker", "title", "items": [...]}
  map   — {"type": "map", "title", "note", "points": [{"name", "lat", "lng"}], "line"?: false — без ломаной между точками}
  cta   — {"type": "cta", "image", "title", "text"}

Фото — локальный путь или URL (только свои фото автора 1). Карта — плитки OpenStreetMap,
подпись об авторстве ставится на слайд. Тексты — только из статьи.

Запуск: python3 scripts/instagram/make-carousel.py spec.json
Нужен Pillow.
"""
import os
import io
import json
import math
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H, PAD = 1080, 1350, 72
BG, TEXT, MUTED = (253, 252, 251), (58, 58, 58), (99, 99, 99)
BRAND, GREEN, WHITE = (245, 132, 44), (122, 157, 143), (255, 255, 255)
FONTS = "/System/Library/Fonts/Supplemental/"
USER_AGENT = "metravel-carousel/1.0 (+https://metravel.by)"


def font(kind, size):
    file, index = {"serif": ("PTSerif.ttc", 3), "sans": ("PTSans.ttc", 0), "bold": ("PTSans.ttc", 7)}[kind]
    return ImageFont.truetype(FONTS + file, size, index=index)


def fetch(src):
    if str(src).startswith("http"):
        request = urllib.request.Request(src, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=60) as response:
            return io.BytesIO(response.read())
    return src


def photo(src, size):
    return ImageOps.fit(ImageOps.exif_transpose(Image.open(fetch(src))).convert("RGB"), size, Image.LANCZOS)


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        probe = f"{line} {word}".strip()
        if draw.textlength(probe, font=fnt) <= width or not line:
            line = probe
        else:
            lines.append(line)
            line = word
    return lines + [line] if line else lines


def block(draw, text, fnt, x, y, width, fill, gap=1.22):
    """Рисует абзац, возвращает y после него."""
    step = int(fnt.size * gap)
    for line in wrap(draw, text, fnt, width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += step
    return y


def shade(img, top, bottom, strength):
    """Затемняет полосу градиентом сверху вниз — под белый текст на фото."""
    overlay = Image.new("L", (1, H), 0)
    for y in range(top, bottom):
        overlay.putpixel((0, y), int(strength * (y - top) / max(1, bottom - top)))
    img.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), overlay.resize((W, H)))


BRAND_BIRD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "brand-bird.png")


def footer(draw, index, total, fill):
    """Подвал слайда: птичка metravel и @metravelby слева, номер слайда справа (бренд, решение владельца 06.10.2026)."""
    bird = Image.open(BRAND_BIRD).convert("RGBA")
    bird.thumbnail((46, 46))
    if fill == WHITE:  # на фото — знак на тёмной полупрозрачной подложке, как на всех фото-слайдах
        width = bird.width + 12 + draw.textlength("@metravelby", font=font("bold", 30)) + 32
        base = draw._image
        layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle((PAD - 14, H - 94, PAD - 14 + width, H - 30), radius=32, fill=(0, 0, 0, 175))
        base.paste(Image.alpha_composite(base.convert("RGBA"), layer).convert(base.mode))
    draw._image.paste(bird, (PAD - 2, H - 86), bird)
    draw.text((PAD + bird.width + 10, H - 79), "@metravelby", font=font("bold", 30), fill=fill)
    label = f"{index} / {total}"
    draw.text((W - PAD - draw.textlength(label, font=font("sans", 30)), H - 78), label, font=font("sans", 30), fill=fill)


def kicker(draw, text, x, y, fill=BRAND):
    draw.text((x, y), text.upper(), font=font("bold", 30), fill=fill)
    return y + 52


def slide_cover(spec):
    img = photo(spec["image"], (W, H))
    shade(img, 420, H, 215)
    draw = ImageDraw.Draw(img)
    title_font, sub_font = font("serif", 88), font("sans", 44)
    title_lines = wrap(draw, spec["title"], title_font, W - 2 * PAD)
    sub_lines = wrap(draw, spec["subtitle"], sub_font, W - 2 * PAD)
    y = H - 150 - len(sub_lines) * 54 - 28 - len(title_lines) * 100 - 52
    y = kicker(draw, spec["kicker"], PAD, y)
    y = block(draw, spec["title"], title_font, PAD, y, W - 2 * PAD, WHITE, gap=1.14) + 28
    block(draw, spec["subtitle"], sub_font, PAD, y, W - 2 * PAD, WHITE)
    return img, WHITE


def slide_list(spec):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    y = PAD + 30
    if spec.get("image"):
        img.paste(photo(spec["image"], (W, 600)), (0, 0))
        y = 600 + 56
    y = kicker(draw, spec["kicker"], PAD, y)
    y = block(draw, spec["title"], font("serif", 62), PAD, y, W - 2 * PAD, TEXT, gap=1.16) + 30
    room = H - 120 - y
    for size in range(42, 28, -2):
        item_font = font("sans", size)
        heights = [len(wrap(draw, item, item_font, W - 2 * PAD - 46)) * int(size * 1.26) for item in spec["items"]]
        gap = int(size * 0.7)
        if sum(heights) + gap * (len(heights) - 1) <= room:
            break
    for item in spec["items"]:
        draw.ellipse([PAD, y + size * 0.42, PAD + 16, y + size * 0.42 + 16], fill=BRAND)
        y = block(draw, item, item_font, PAD + 46, y, W - 2 * PAD - 46, TEXT, gap=1.26) + gap
    return img, MUTED


def mercator(lat, lng, zoom):
    scale = 256 * 2 ** zoom
    x = (lng + 180) / 360 * scale
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * scale
    return x, y


def slide_map(spec):
    map_h = 800
    points = spec["points"]
    for zoom in range(14, 4, -1):
        xy = [mercator(p["lat"], p["lng"], zoom) for p in points]
        xs, ys = [p[0] for p in xy], [p[1] for p in xy]
        if max(xs) - min(xs) <= 1500 and max(ys) - min(ys) <= 1500 * map_h / W:
            break
    # Рамка: точки с полями, в пропорции слайда; плитки берём с запасом и уменьшаем до ширины слайда.
    span = max((max(xs) - min(xs)) * 1.35, (max(ys) - min(ys)) * 1.6 * W / map_h, 600)
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    left, top, view_h = cx - span / 2, cy - span * map_h / W / 2, span * map_h / W
    tiles = Image.new("RGB", ((int((left + span) // 256) - int(left // 256) + 1) * 256,
                              (int((top + view_h) // 256) - int(top // 256) + 1) * 256))
    for tx in range(int(left // 256), int((left + span) // 256) + 1):
        for ty in range(int(top // 256), int((top + view_h) // 256) + 1):
            tile = Image.open(fetch(f"https://tile.openstreetmap.org/{zoom}/{tx}/{ty}.png")).convert("RGB")
            tiles.paste(tile, ((tx - int(left // 256)) * 256, (ty - int(top // 256)) * 256))
    ox, oy = left - int(left // 256) * 256, top - int(top // 256) * 256
    view = tiles.crop((int(ox), int(oy), int(ox + span), int(oy + view_h))).resize((W, map_h), Image.LANCZOS)
    view = Image.blend(view, Image.new("RGB", view.size, WHITE), 0.18)
    img = Image.new("RGB", (W, H), BG)
    img.paste(view, (0, 0))
    draw = ImageDraw.Draw(img)
    k = W / span
    dots = [((x - left) * k, (y - top) * k) for x, y in xy]
    if spec.get("line", True):
        draw.line(dots, fill=BRAND, width=7, joint="curve")
    for i, (x, y) in enumerate(dots, 1):
        draw.ellipse([x - 24, y - 24, x + 24, y + 24], fill=WHITE, outline=BRAND, width=5)
        label = str(i)
        draw.text((x - draw.textlength(label, font=font("bold", 28)) / 2, y - 17), label, font=font("bold", 28), fill=TEXT)
    credit = "© OpenStreetMap"
    draw.text((W - 16 - draw.textlength(credit, font=font("sans", 22)), map_h - 34), credit, font=font("sans", 22), fill=MUTED)
    y = block(draw, spec["title"], font("serif", 58), PAD, map_h + 40, W - 2 * PAD, TEXT) + 10
    y = block(draw, spec["note"], font("sans", 36), PAD, y, W - 2 * PAD, MUTED) + 26
    # Легенда в две колонки: номер в кружке и название точки.
    rows = math.ceil(len(points) / 2)
    for i, point in enumerate(points):
        x, row_y = PAD + (i // rows) * (W - 2 * PAD) // 2, y + (i % rows) * 62
        draw.ellipse([x, row_y, x + 44, row_y + 44], outline=BRAND, width=4)
        label = str(i + 1)
        draw.text((x + 22 - draw.textlength(label, font=font("bold", 26)) / 2, row_y + 6), label, font=font("bold", 26), fill=TEXT)
        draw.text((x + 62, row_y + 2), point["name"], font=font("sans", 36), fill=TEXT)
    return img, MUTED


def slide_cta(spec):
    img = photo(spec["image"], (W, H))
    img = Image.blend(img, Image.new("RGB", (W, H), (0, 0, 0)), 0.45)
    draw = ImageDraw.Draw(img)
    y = 430
    for line in wrap(draw, spec["title"], font("serif", 80), W - 2 * PAD):
        draw.text(((W - draw.textlength(line, font=font("serif", 80))) / 2, y), line, font=font("serif", 80), fill=WHITE)
        y += 96
    y += 30
    for line in wrap(draw, spec["text"], font("sans", 42), W - 2 * PAD - 80):
        draw.text(((W - draw.textlength(line, font=font("sans", 42))) / 2, y), line, font=font("sans", 42), fill=WHITE)
        y += 54
    return img, WHITE


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_dir = Path(spec["out_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    builders = {"cover": slide_cover, "list": slide_list, "map": slide_map, "cta": slide_cta}
    total = len(spec["slides"])
    for index, slide in enumerate(spec["slides"], 1):
        img, footer_fill = builders[slide["type"]](slide)
        footer(ImageDraw.Draw(img), index, total, footer_fill)
        img.save(out_dir / f"{index:02d}.jpg", quality=92)
    print(f"make-carousel: {total} слайдов в {out_dir}")


if __name__ == "__main__":
    main()
