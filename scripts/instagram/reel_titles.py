#!/usr/bin/env python3
"""Единый шаблон титров Reel @metravelby (владелец, 18.10.2026: прежние плашки «кривые», нужен
аккуратный современный шаблон). Стиль тот же, что у каруселей `make-carousel.py`: без чёрных
коробок — мягкое затемнение под текстом, оранжевый кикер капителью, заголовок PT Serif, тело PT
Sans, выравнивание по левому краю в поле x 160–920 × y 440–1248 (бриф шаг 5).

API (PIL, кадр 1080×1920):
  overlay(title, kicker=None, subtitle=None, anchor="bottom", size=64, brand=False) -> RGBA Image
    anchor "bottom" — блок прижат к y 1248 (низ поля), затемнение снизу;
    anchor "top"    — блок от y 440, затемнение сверху (когда внизу лица/объект).
  save_overlay(path, **kw) — PNG для `ffmpeg -i clip -i overlay.png -filter_complex overlay`.
  brand=True — подвал как у каруселей: птичка + @metravelby слева внизу поля (y ≈ 1170–1248).

CLI: python3 scripts/instagram/reel_titles.py out.png "Заголовок" [--kicker "..."] [--subtitle "..."]
     [--anchor top|bottom] [--size 64] [--brand]
"""
import argparse
import os

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
X0, X1, Y0, Y1 = 160, 920, 440, 1248
FONTS = "/System/Library/Fonts/Supplemental/"
BRAND, WHITE = (245, 132, 44), (255, 255, 255)
BIRD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "brand-bird.png")


def font(kind, size):
    file, index = {"serif": ("PTSerif.ttc", 3), "sans": ("PTSans.ttc", 0), "bold": ("PTSans.ttc", 7)}[kind]
    return ImageFont.truetype(FONTS + file, size, index=index)


def wrap(draw, text, fnt, width):
    """Явный перенос `\\n` из slides.txt сохраняется (иначе «Лестница к скале с / образом…» — висячий
    предлог); внутри абзаца — жадный перенос по ширине поля."""
    lines = []
    for para in text.split("\n"):
        line = ""
        for word in para.split():
            probe = f"{line} {word}".strip()
            if draw.textlength(probe, font=fnt) <= width or not line:
                line = probe
            else:
                lines.append(line)
                line = word
        if line:
            lines.append(line)
    return lines


def _shade(img, y_from, y_to, strength, direction=None, ramp_in=180, ramp_out=170):
    """Затемнение полосой под текстом (поправка 18.10.2026 по находке редактора: глухая заливка до
    края кадра гасила главный объект). Плавный вход за ramp_in px до y_from, ровная полоса от y_from
    до y_to, плавный выход за ramp_out px после y_to; дальше кадр не трогаем."""
    mask = Image.new("L", (1, H), 0)
    for y in range(max(0, y_from - ramp_in), min(H, y_to + ramp_out)):
        if y < y_from:
            k = (y - (y_from - ramp_in)) / ramp_in
        elif y <= y_to:
            k = 1.0
        else:
            k = 1 - (y - y_to) / ramp_out
        mask.putpixel((0, y), int(strength * max(0.0, min(1.0, k)) ** 1.1))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.putalpha(mask.resize((W, H)))
    return layer


def overlay(title, kicker=None, subtitle=None, anchor="bottom", size=64, brand=False, strength=175):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    t_font = font("serif", size)
    s_font = font("sans", max(36, int(size * 0.62)))
    k_font = font("bold", 32)
    width = X1 - X0
    t_lines = wrap(draw, title, t_font, width)
    s_lines = wrap(draw, subtitle, s_font, width) if subtitle else []
    assert all(draw.textlength(l, font=t_font) <= width for l in t_lines), ("титр шире поля", title)
    t_step, s_step = int(size * 1.14), int(s_font.size * 1.3)
    # последняя строка блока — по реальному выносу (у/р/ф), иначе нижний титр уходит за y 1248
    t_tail, s_tail = max(t_step, t_font.getbbox("Ау")[3]), max(s_step, s_font.getbbox("Ау")[3])
    block = (52 if kicker else 0) + (len(t_lines) - 1) * t_step + t_tail
    if s_lines:
        block += (t_step - t_tail) + 18 + (len(s_lines) - 1) * s_step + s_tail
    brand_h = 90 if brand else 0
    if anchor == "top":
        y = Y0
        img.alpha_composite(_shade(img, Y0 - 30, Y0 + block + 30, strength))
    else:
        y = Y1 - brand_h - block
        img.alpha_composite(_shade(img, y - 30, y + block + brand_h + 20, strength))
    assert y >= Y0 and y + block + brand_h <= Y1, ("блок вне поля", title, y, block)
    draw = ImageDraw.Draw(img)
    if kicker:
        draw.text((X0, y), kicker.upper(), font=k_font, fill=BRAND)
        y += 52
    for line in t_lines:
        draw.text((X0 - min(0, t_font.getbbox(line)[0]), y), line, font=t_font, fill=WHITE)  # левый вынос «Л» не за x 160
        y += t_step
    if s_lines:
        y += 18
        for line in s_lines:
            draw.text((X0 - min(0, s_font.getbbox(line)[0]), y), line, font=s_font, fill=WHITE)
            y += s_step
    if brand:
        # Подвал как у каруселей: птичка + @metravelby на тёмной пилюле (поправка 18.10.2026 —
        # без пилюли подпись на светлой листве давала контраст 2,9:1; пилюля не зависит от полосы).
        bird = Image.open(BIRD).convert("RGBA")
        bird.thumbnail((44, 44))
        by = Y1 - 70
        b_font = font("bold", 30)
        pw = bird.width + 12 + draw.textlength("@metravelby", font=b_font) + 32
        pill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(pill).rounded_rectangle((X0, by - 14, X0 + pw, by + 48), radius=31, fill=(0, 0, 0, 165))  # левый край пилюли = x 160 (поле брифа шаг 5), содержимое с отступом 14
        img.alpha_composite(pill)
        draw = ImageDraw.Draw(img)
        img.paste(bird, (X0 + 14, by - 4), bird)
        draw.text((X0 + 14 + bird.width + 12, by), "@metravelby", font=b_font, fill=WHITE)
    return img


def save_overlay(path, **kw):
    overlay(**kw).save(path)
    return path


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("title")
    ap.add_argument("--kicker")
    ap.add_argument("--subtitle")
    ap.add_argument("--anchor", default="bottom", choices=["top", "bottom"])
    ap.add_argument("--size", type=int, default=64)
    ap.add_argument("--brand", action="store_true")
    a = ap.parse_args()
    save_overlay(a.out, title=a.title, kicker=a.kicker, subtitle=a.subtitle, anchor=a.anchor, size=a.size, brand=a.brand)
    print("ok", a.out)
