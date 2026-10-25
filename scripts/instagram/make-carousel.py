#!/usr/bin/env python3
"""Собирает карусель для Instagram (слайды 1080x1350) из фото и фактов статьи.

Вход — JSON-спецификация: {"out_dir": "...", "slides": [...]}. Типы слайдов:
  cover — {"type": "cover", "image", "kicker", "title", "subtitle", "kicker_plate"?: true — тёмная подложка под надзаголовком}
  list  — {"type": "list", "image"?, "kicker", "title", "items": [...], "size"?: фиксированный кегль пунктов (единый на всю карусель),
           "layout"?: "full" (по умолчанию с 18.10.2026, владелец: фото на весь кадр, снизу затемнение, текст белым у низа — как обложка)
           | "split" (прежняя раскладка: фото сверху photo_h, текст на светлом поле)}
  map   — {"type": "map", "title", "note", "points": [{"name", "lat", "lng"}], "line"?: false — без ломаной между точками, "map_h"?: высота карты (800), "row_h"?: шаг строки легенды (62), "zoom"?, "patches"?: [{"box","from"}], "tile_url"?, "credit"?, "inset_line"?: "auto"|"none", "inset"?: {"from","to","x","y","w","h"} — врезка крупным масштабом для тесного кластера точек (номера from..to, 1-based)}
  cta   — {"type": "cta", "image", "title", "text", "layout"?: "full" (по умолчанию: затемнение снизу, текст у низа) | "center" (прежняя: кадр
           притемнён целиком, текст по центру, "top"?: y начала текста, по умолчанию 430)}
  story — MeTravel C (раздел 17 ТЗ, владелец 23.10.2026; шаблон 18.1): {"type": "story", "image", "kicker", "title", "body",
           "role"?: "cover" (заголовок крупнее) | "scene" (по умолчанию) | "final",
           "layout"?: "below" (по умолчанию для сцен, владелец 25.10.2026: фото НЕ перекрывается текстом — фото занимает верх до текстового блока,
           текст на тёмном поле ниже; квадрат/портрет подрезаются по центру до нужной высоты, "focus": "top"|"center"|"bottom" двигает окно,
           "fit": "contain" — без подрезки: поля заполняет размытая подложка из того же кадра, края растушёваны) | "overlay" (по умолчанию для обложки: фото на весь кадр, текст на затемнении у низа),
           "fit"?: "width" (overlay: фото целиком по ширине, у верха; портрет — contain по высоте) | "cover" (на весь кадр, только для обложки),
           "crop"?: [x0, y0, x1, y1] — явный кроп исходника (пиксели после EXIF-поворота; записать в package.md),
           "protect"?: true — текст только ниже фото (лица/объект у низа кадра не затемняются)}
           Фото у верха, тёмное поле и мягкое затемнение под белым текстом у низа; кикер 25 px, заголовок 57 px (обложка 76), тело 40 px,
           подвал: птичка, @metravelby, «NN / TT». Текст слайда — только `body`: 2–4 предложения, до 50 слов (линт F2).

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
    """Перенос по словам; «\n» в тексте — принудительный разрыв строки, пустая строка — абзацный отступ
    (форматирование слайда, владелец 25.10.2026: шаги и абзацы, а не стена текста)."""
    lines = []
    for paragraph in text.split("\n"):
        line = ""
        for word in (w for w in paragraph.split(" ") if w):  # \u00a0 не разрываем
            probe = f"{line} {word}".strip()
            if draw.textlength(probe, font=fnt) <= width or not line:
                line = probe
            else:
                lines.append(line)
                line = word
        lines.append(line)
    return lines


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


def shade_bottom(img, text_top, ramp=260, strength=215):
    """Затемнение под текст у низа кадра (все фото-слайды, решение владельца 18.10.2026): плавный
    подъём от text_top - ramp до text_top, ниже — ровная тёмная полоса до низа кадра."""
    overlay = Image.new("L", (1, H), 0)
    for y in range(max(0, text_top - ramp), H):
        overlay.putpixel((0, y), strength if y >= text_top else int(strength * (y - (text_top - ramp)) / ramp))
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
    if spec.get("kicker_plate"):  # светлый/цветной фон под оранжевым надзаголовком гасит контраст
        width = draw.textlength(spec["kicker"].upper(), font=font("bold", 30))
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle((PAD - 16, y - 12, PAD + width + 16, y + 46), radius=14, fill=(0, 0, 0, 190))
        img.paste(Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB"))
        draw = ImageDraw.Draw(img)
    y = kicker(draw, spec["kicker"], PAD, y)
    y = block(draw, spec["title"], title_font, PAD, y, W - 2 * PAD, WHITE, gap=1.14) + 28
    block(draw, spec["subtitle"], sub_font, PAD, y, W - 2 * PAD, WHITE)
    return img, WHITE


def slide_list_full(spec):
    """Фото на весь кадр, текст белым у низа поверх затемнения; текст начинается не выше y 440."""
    img = photo(spec["image"], (W, H))
    draw = ImageDraw.Draw(img)
    title_font = font("serif", 62)
    title_h = len(wrap(draw, spec["title"], title_font, W - 2 * PAD)) * int(62 * 1.16) + 30
    room = H - 130 - 440 - 52 - title_h
    for size in ([spec["size"]] if spec.get("size") else range(42, 28, -2)):
        item_font = font("sans", size)
        heights = [len(wrap(draw, item, item_font, W - 2 * PAD - 46)) * int(size * 1.26) for item in spec["items"]]
        gap = int(size * 0.7)
        items_h = sum(heights) + gap * (len(heights) - 1)
        if items_h <= room:
            break
    y = H - 130 - items_h - title_h - 52
    shade_bottom(img, y - 40)
    draw = ImageDraw.Draw(img)
    y = kicker(draw, spec["kicker"], PAD, y)
    y = block(draw, spec["title"], title_font, PAD, y, W - 2 * PAD, WHITE, gap=1.16) + 30
    for item in spec["items"]:
        draw.ellipse([PAD, y + size * 0.42, PAD + 16, y + size * 0.42 + 16], fill=BRAND)
        y = block(draw, item, item_font, PAD + 46, y, W - 2 * PAD - 46, WHITE, gap=1.26) + gap
    return img, WHITE


def slide_list(spec):
    if spec.get("image") and spec.get("layout", "full") == "full":
        return slide_list_full(spec)
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    y = PAD + 30
    if spec.get("image"):
        photo_h = spec.get("photo_h", 600)  # портретный кадр с лицами: photo_h 720
        img.paste(photo(spec["image"], (W, photo_h)), (0, 0))
        y = photo_h + 56
    y = kicker(draw, spec["kicker"], PAD, y)
    y = block(draw, spec["title"], font("serif", 62), PAD, y, W - 2 * PAD, TEXT, gap=1.16) + 30
    room = H - 120 - y
    for size in ([spec["size"]] if spec.get("size") else range(42, 28, -2)):
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
    tile_url = spec.get("tile_url", "https://tile.openstreetmap.org/{z}/{x}/{y}.png")  # "tile_url": подложка без подписей (напр. CARTO light_nolabels)
    map_h = spec.get("map_h", 800)  # для 12 и более точек легенда не помещается: map_h 720, row_h 54
    row_h = spec.get("row_h", 62)
    points = spec["points"]
    for zoom in ([spec["zoom"]] if spec.get("zoom") else range(14, 4, -1)):  # "zoom": фиксированный масштаб плиток (крупнее — тесный маршрут без врезки)
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
            tile = Image.open(fetch(tile_url.format(z=zoom, x=tx, y=ty))).convert("RGB")
            tiles.paste(tile, ((tx - int(left // 256)) * 256, (ty - int(top // 256)) * 256))
    ox, oy = left - int(left // 256) * 256, top - int(top // 256) * 256
    view = tiles.crop((int(ox), int(oy), int(ox + span), int(oy + view_h))).resize((W, map_h), Image.LANCZOS)
    view = Image.blend(view, Image.new("RGB", view.size, WHITE), 0.18)
    for patch in spec.get("patches", []):  # {"box": [x0,y0,x1,y1], "from": [x,y]} — закрасить значок/подпись карты цветом соседнего пикселя
        view.paste(view.getpixel(tuple(patch["from"])), tuple(patch["box"]))
    img = Image.new("RGB", (W, H), BG)
    img.paste(view, (0, 0))
    draw = ImageDraw.Draw(img)
    k = W / span
    dots = [((x - left) * k, (y - top) * k) for x, y in xy]
    if spec.get("line", True):
        draw.line(dots, fill=BRAND, width=7, joint="curve")
    inset = spec.get("inset")  # {"from": 1, "to": 8, "x", "y", "w", "h"}: тесный кластер точек — врезка крупнее
    hidden = set(range(inset["from"] - 1, inset["to"])) if inset else set()
    for i, (x, y) in enumerate(dots, 1):
        if i - 1 in hidden:
            continue
        draw.ellipse([x - 24, y - 24, x + 24, y + 24], fill=WHITE, outline=BRAND, width=5)
        label = str(i)
        draw.text((x - draw.textlength(label, font=font("bold", 28)) / 2, y - 17), label, font=font("bold", 28), fill=TEXT)
    if inset:
        cl = [dots[i] for i in sorted(hidden)]
        bx0, by0 = min(p[0] for p in cl) - 30, min(p[1] for p in cl) - 30
        bx1, by1 = max(p[0] for p in cl) + 30, max(p[1] for p in cl) + 30
        draw.rounded_rectangle([bx0, by0, bx1, by1], radius=18, outline=BRAND, width=5)
        ix, iy, iw, ih = inset["x"], inset["y"], inset["w"], inset["h"]
        pts = [points[i] for i in sorted(hidden)]
        z = 17  # плитки берём на z17 и сжимаем коэффициентом f, чтобы кластер влез во врезку и метки не касались
        q = [mercator(p["lat"], p["lng"], z) for p in pts]
        qx, qy = [a for a, _ in q], [b for _, b in q]
        f = min(1.0, (iw - 90) / max(1, max(qx) - min(qx)), (ih - 90) / max(1, max(qy) - min(qy)))
        sw, sh = iw / f, ih / f
        l2, t2 = (max(qx) + min(qx)) / 2 - sw / 2, (max(qy) + min(qy)) / 2 - sh / 2
        mosaic = Image.new("RGB", ((int((l2 + sw) // 256) - int(l2 // 256) + 1) * 256, (int((t2 + sh) // 256) - int(t2 // 256) + 1) * 256))
        for tx in range(int(l2 // 256), int((l2 + sw) // 256) + 1):
            for ty in range(int(t2 // 256), int((t2 + sh) // 256) + 1):
                tile = Image.open(fetch(tile_url.format(z=z, x=tx, y=ty))).convert("RGB")
                mosaic.paste(tile, ((tx - int(l2 // 256)) * 256, (ty - int(t2 // 256)) * 256))
        o2x, o2y = l2 - int(l2 // 256) * 256, t2 - int(t2 // 256) * 256
        box = mosaic.crop((int(o2x), int(o2y), int(o2x + sw), int(o2y + sh))).resize((iw, ih), Image.LANCZOS)
        box = Image.blend(box, Image.new("RGB", (iw, ih), WHITE), 0.18)
        img.paste(box, (ix, iy))
        draw.rectangle([ix, iy, ix + iw, iy + ih], outline=BRAND, width=5)
        if spec.get("inset_line") == "auto":  # линия рамка→врезка к ближнему краю врезки, не через неё; "none" — без линии
            if ix + iw <= bx0:
                draw.line([(bx0, (by0 + by1) / 2), (ix + iw, iy + ih / 2)], fill=BRAND, width=4)
            elif ix >= bx1:
                draw.line([(bx1, (by0 + by1) / 2), (ix, iy + ih / 2)], fill=BRAND, width=4)
        elif spec.get("inset_line") != "none":
            draw.line([(bx1, (by0 + by1) / 2), (ix, iy + ih / 2)], fill=BRAND, width=4)
        d2 = [((a - l2) * f + ix, (b - t2) * f + iy) for a, b in q]
        draw.line(d2, fill=BRAND, width=6, joint="curve")
        for n, (x, y) in zip(sorted(hidden), d2):
            draw.ellipse([x - 21, y - 21, x + 21, y + 21], fill=WHITE, outline=BRAND, width=4)
            lab = str(n + 1)
            draw.text((x - draw.textlength(lab, font=font("bold", 26)) / 2, y - 16), lab, font=font("bold", 26), fill=TEXT)
    credit = spec.get("credit", "© OpenStreetMap")
    draw.text((W - 16 - draw.textlength(credit, font=font("sans", 22)), map_h - 34), credit, font=font("sans", 22), fill=MUTED)
    y = block(draw, spec["title"], font("serif", 58), PAD, map_h + 40, W - 2 * PAD, TEXT) + 10
    y = block(draw, spec["note"], font("sans", 36), PAD, y, W - 2 * PAD, MUTED) + 26
    # Легенда в две колонки: номер в кружке и название точки.
    rows = math.ceil(len(points) / 2)
    for i, point in enumerate(points):
        x, row_y = PAD + (i // rows) * (W - 2 * PAD) // 2, y + (i % rows) * row_h
        draw.ellipse([x, row_y, x + 44, row_y + 44], outline=BRAND, width=4)
        label = str(i + 1)
        draw.text((x + 22 - draw.textlength(label, font=font("bold", 26)) / 2, row_y + 6), label, font=font("bold", 26), fill=TEXT)
        draw.text((x + 62, row_y + 2), point["name"], font=font("sans", 36), fill=TEXT)
    return img, MUTED


def slide_cta(spec):
    img = photo(spec["image"], (W, H))
    if spec.get("layout", "full") == "full":  # как обложка: затемнение снизу, текст у низа
        draw = ImageDraw.Draw(img)
        t_font, x_font = font("serif", 72), font("sans", 42)
        t_lines = wrap(draw, spec["title"], t_font, W - 2 * PAD)
        x_lines = wrap(draw, spec["text"], x_font, W - 2 * PAD)
        y = H - 150 - len(x_lines) * 54 - 30 - len(t_lines) * 86
        shade_bottom(img, y - 40)
        draw = ImageDraw.Draw(img)
        y = block(draw, spec["title"], t_font, PAD, y, W - 2 * PAD, WHITE, gap=1.19) + 30
        block(draw, spec["text"], x_font, PAD, y, W - 2 * PAD, WHITE, gap=1.29)
        return img, WHITE
    img = Image.blend(img, Image.new("RGB", (W, H), (0, 0, 0)), 0.45)
    draw = ImageDraw.Draw(img)
    y = spec.get("top", 430)
    for line in wrap(draw, spec["title"], font("serif", 80), W - 2 * PAD):
        draw.text(((W - draw.textlength(line, font=font("serif", 80))) / 2, y), line, font=font("serif", 80), fill=WHITE)
        y += 96
    y += 30
    for line in wrap(draw, spec["text"], font("sans", 42), W - 2 * PAD - 80):
        draw.text(((W - draw.textlength(line, font=font("sans", 42))) / 2, y), line, font=font("sans", 42), fill=WHITE)
        y += 54
    return img, WHITE


C_BG, C_FADE, C_SAGE, C_LINE = (20, 34, 27), (10, 20, 16), (207, 223, 215), (122, 157, 143)


def soft_fit(img, size, darken=0.45, feather=48, blur=30):
    """Фото в окно без голых полей (владелец, 25.10.2026): подложка — размытая и притемнённая копия того же
    кадра на всё окно, сверху — кадр целиком (contain) с растушёванными краями."""
    from PIL import ImageFilter
    w, h = size
    back = ImageOps.fit(img, (w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
    back = Image.blend(back, Image.new("RGB", (w, h), (0, 0, 0)), darken)
    fit = ImageOps.contain(img, (w, h), Image.LANCZOS)
    if fit.size == (w, h):
        return fit
    mask = Image.new("L", fit.size, 0)
    ImageDraw.Draw(mask).rectangle((feather // 2, feather // 2, fit.width - feather // 2, fit.height - feather // 2), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather / 2))
    back.paste(fit, ((w - fit.width) // 2, (h - fit.height) // 2), mask)
    return back


def story_photo(spec):
    """Фото для MeTravel C: целиком по ширине у верха (4:3 → 810 px, 1:1 → 1080 px); портрет не режется —
    contain по высоте с полями; "cover" — на весь кадр (обложка); "crop" — явное окно исходника."""
    img = ImageOps.exif_transpose(Image.open(fetch(spec["image"]))).convert("RGB")
    if spec.get("crop"):
        img = img.crop(tuple(spec["crop"]))
    if spec.get("fit") == "cover":
        return ImageOps.fit(img, (W, H), Image.LANCZOS)
    scaled = img.resize((W, round(img.height * W / img.width)), Image.LANCZOS)
    return scaled if scaled.height <= H else soft_fit(img, (W, H))


def fade_c(img, top, bottom, strength=220):
    """Затемнение C: прозрачно выше top, плавно до bottom, ниже — ровно (под белый текст)."""
    overlay = Image.new("L", (1, H), 0)
    for y in range(max(0, top), H):
        overlay.putpixel((0, y), strength if y >= bottom else int(strength * (y - top) / max(1, bottom - top)))
    img.paste(Image.new("RGB", (W, H), C_FADE), (0, 0), overlay.resize((W, H)))


def footer_c(img, index, total):
    draw = ImageDraw.Draw(img)
    bird = Image.open(BRAND_BIRD).convert("RGBA")
    bird.thumbnail((40, 40))
    img.paste(bird, (58, 1262), bird)
    draw.text((112, 1265), "@metravelby", font=font("bold", 28), fill=WHITE)
    label = f"{index:02d} / {total:02d}"
    lw = draw.textlength(label, font=font("sans", 28))
    draw.text((1022 - lw, 1266), label, font=font("sans", 28), fill=WHITE)
    draw.line((1022 - lw - 52, 1285, 1022 - lw - 15, 1285), fill=C_LINE, width=3)


def story_photo_below(spec, avail_h):
    """Фото для layout "below": на всю ширину, высотой ровно avail_h; лишнее по вертикали срезается окном
    ("focus": top|center|bottom), "fit": "contain" — целиком с полями. Апскейла нет: исходник уже ≥ 1080 px."""
    img = ImageOps.exif_transpose(Image.open(fetch(spec["image"]))).convert("RGB")
    if spec.get("crop"):
        img = img.crop(tuple(spec["crop"]))
    if spec.get("fit") == "contain":
        return soft_fit(img, (W, avail_h))
    scaled = img.resize((W, round(img.height * W / img.width)), Image.LANCZOS)
    if scaled.height <= avail_h:
        return scaled
    focus = spec.get("focus", "center")
    y0 = {"top": 0, "bottom": scaled.height - avail_h}.get(focus, (scaled.height - avail_h) // 2)
    return scaled.crop((0, y0, W, y0 + avail_h))


def slide_story(spec):
    """MeTravel C: фото у верха, тёмное поле, кикер + заголовок + один абзац. Шаблон 18.1 ТЗ.
    Сцены по умолчанию — layout "below": текст не ложится на фото (владелец, 25.10.2026)."""
    img = Image.new("RGB", (W, H), C_BG)
    draw = ImageDraw.Draw(img)
    title_size = 76 if spec.get("role") == "cover" else 57
    title_font, body_font, x, width = font("bold", title_size), font("sans", 40), 58, 964
    title_step, body_step = round(title_size * 1.10), 51
    title_lines = wrap(draw, spec["title"], title_font, width)
    body_lines = wrap(draw, spec["body"], body_font, width)
    block_h = 45 + len(title_lines) * title_step + 20 + len(body_lines) * body_step
    layout = spec.get("layout") or ("overlay" if spec.get("role") == "cover" else "below")
    if layout == "below" and not spec.get("protect"):
        top = 1235 - block_h
        if top < 700:
            raise SystemExit(f"story «{spec['title']}»: фото останется меньше 680 px ({top} < 700) — сократить тело или заголовок")
        photo_img = story_photo_below(spec, top - 24)
        img.paste(photo_img, ((W - photo_img.width) // 2, 0))
        fade_c(img, photo_img.height - 6, photo_img.height + 6)
        draw = ImageDraw.Draw(img)
        draw.text((x, top), spec["kicker"].upper(), font=font("bold", 25), fill=C_SAGE)
        y = block(draw, spec["title"], title_font, x, top + 45, width, WHITE, gap=1.10) + 20
        block(draw, spec["body"], body_font, x, y, width, WHITE, gap=1.275)
        return img, None
    photo_img = story_photo(spec)
    img.paste(photo_img, ((W - photo_img.width) // 2, 0))
    top = min(785, 1220 - block_h)
    if spec.get("protect"):
        top = max(top, photo_img.height + 8)
        if top + block_h > 1235:
            raise SystemExit(f"story «{spec['title']}»: текст под фото не помещается ({top + block_h} > 1235) — короче тело или без protect")
        fade_c(img, photo_img.height, photo_img.height + 10)
    else:
        if top < 520:  # затемнение начинается не выше 460: выше текст ложится на незатемнённое фото
            raise SystemExit(f"story «{spec['title']}»: текст поднимается на фото ({top} < 520) — сократить тело или заголовок")
        fade_c(img, max(460, top - 145), top + 60)
    draw = ImageDraw.Draw(img)
    draw.text((x, top), spec["kicker"].upper(), font=font("bold", 25), fill=C_SAGE)
    y = block(draw, spec["title"], title_font, x, top + 45, width, WHITE, gap=1.10) + 20
    end = block(draw, spec["body"], body_font, x, y, width, WHITE, gap=1.275)
    if end > 1235:
        raise SystemExit(f"story «{spec['title']}»: текст заходит на подвал ({end} > 1235) — сократить тело")
    return img, None


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_dir = Path(spec["out_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    builders = {"cover": slide_cover, "list": slide_list, "map": slide_map, "cta": slide_cta, "story": slide_story}
    total = len(spec["slides"])
    for index, slide in enumerate(spec["slides"], 1):
        img, footer_fill = builders[slide["type"]](slide)
        if footer_fill is None:
            footer_c(img, index, total)
        else:
            footer(ImageDraw.Draw(img), index, total, footer_fill)
        img.save(out_dir / f"{index:02d}.jpg", quality=92)
    print(f"make-carousel: {total} слайдов в {out_dir}")


if __name__ == "__main__":
    main()
