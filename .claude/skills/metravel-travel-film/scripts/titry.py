#!/usr/bin/env python3
"""Плашки travel-фильма (3840x2160, прозрачный фон): один вид на все серии. Вызывает film_serial.card().

titry.py <вид> <out.png> <строка> [строка2]
  место   — подпись места справа внизу:            titry.py место out.png "Вёль-ле-Роз · отель"
  дата    — то же, для даты:                         titry.py дата out.png "25 мая · Сен-Обен"
  цена    — сумма жёлтым по центру внизу + пояснение: titry.py цена out.png "167 €" "отель на одну ночь"
  блок    — заголовок + строка слева вверху («Вспоминаем», выход из воспоминания)
  серия   — «Серия N» + название по центру
  крупно  — одна крупная строка по центру («Смотрите в следующей серии»)
  справка — заголовок + 1–3 строки справа внизу (титр-поправка, факт)
  номер   — «Серия N из 7 · название» одной строкой по центру под названием фильма (первые 5 с серии)
Шрифты: FILM_FONT_TITLE / FILM_FONT_TEXT (film.json → "fonts": {"title", "text"}), иначе Yeseva One и Roboto Medium
из загрузок Filmora, иначе системные Georgia Bold и Arial (кириллица есть в обоих).
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

FD = os.path.expanduser("~/Library/Application Support/Wondershare Filmora Mac/ProgramData/Download/")
SYS = "/System/Library/Fonts/Supplemental/"


def _font(env, *paths):
    for p in (os.environ.get(env),) + paths:
        if p and os.path.exists(p): return p
    raise SystemExit(f"шрифт плашек не найден: задай {env} или film.json → fonts")


YES = _font("FILM_FONT_TITLE", FD + "Fonts/YesevaOne-Regular.ttf", SYS + "Georgia Bold.ttf", SYS + "Arial Bold.ttf")
ROB = _font("FILM_FONT_TEXT", FD + "Filmora/title/1_Credit_10_zn/Font/Roboto-Medium.ttf", SYS + "Arial.ttf")
W, H = 3840, 2160
WHITE, YELLOW = (255, 255, 255, 255), (255, 214, 102, 255)
TOP = False


def F(p, s): return ImageFont.truetype(p, s)


def box_text(lines, pad_x, pad_y, gap):
    """lines: [(текст, шрифт, цвет)] → размеры блока и смещения строк."""
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    bb = [d.textbbox((0, 0), t, font=f) for t, f, _ in lines]
    w = max(b[2] - b[0] for b in bb) + 2 * pad_x
    h = sum(b[3] - b[1] for b in bb) + gap * (len(lines) - 1) + 2 * pad_y
    return w, h, bb


def draw(out, lines, anchor, pad_x, pad_y, gap, alpha, center_text=False):
    w, h, bb = box_text(lines, pad_x, pad_y, gap)
    ax, ay, mode = anchor
    if TOP and ay < 0:                         # вид «…-верх»: та же плашка у верхнего края — внизу слева окошко рассказчика
        ay = 120
    x0 = {"left": ax, "right": ax - w, "center": ax - w // 2}[mode]
    y0 = ay if ay >= 0 else -ay - h            # отрицательный y — низ блока
    M = 40                                     # поле кадра: плашка целиком внутри, иначе сборка падает
    if x0 < M or y0 < M or x0 + w > W - M or y0 + h > H - M:
        raise SystemExit(f"плашка не влезает в кадр: x {x0}..{x0 + w}, y {y0}..{y0 + h} "
                         f"(поле {M}, кадр {W}x{H}): {lines[0][0]!r} — короче текст или другой вид плашки")
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=36, fill=(0, 0, 0, alpha))
    y = y0 + pad_y
    for (t, f, c), b in zip(lines, bb):
        tx = x0 + (w - (b[2] - b[0])) // 2 if center_text else x0 + pad_x
        d.text((tx - b[0], y - b[1]), t, font=f, fill=c)
        y += b[3] - b[1] + gap
    im.save(out)
    return w, h


def main():
    global TOP
    kind, out, *txt = sys.argv[1:]
    TOP = kind.endswith("-верх")
    kind = kind[:-5] if TOP else kind
    if kind in ("место", "дата"):
        draw(out, [(txt[0], F(ROB, 92), WHITE)], (3690, -2010, "right"), 62, 42, 0, 71)
    elif kind == "цена":
        draw(out, [(txt[0], F(YES, 150), YELLOW), (txt[1], F(ROB, 58), WHITE)], (1920, -2020, "center"), 62, 57, 75, 150, True)
    elif kind == "блок":
        draw(out, [(txt[0], F(YES, 112), WHITE), (txt[1], F(ROB, 73), WHITE)], (130, 120, "left"), 84, 80, 80, 150)
    elif kind == "серия":
        draw(out, [(txt[0], F(ROB, 100), WHITE), (txt[1], F(YES, 162), WHITE)], (1920, 872, "center"), 87, 70, 20, 150, True)
    elif kind == "крупно":
        draw(out, [(txt[0], F(YES, 140), WHITE)], (1920, 950, "center"), 86, 66, 0, 150, True)
    elif kind == "номер":
        draw(out, [(txt[0], F(ROB, 92), WHITE)], (1920, 1500, "center"), 70, 44, 0, 150, True)
    elif kind == "справка":
        draw(out, [(txt[0], F(YES, 136), WHITE)] + [(t, F(ROB, 88), WHITE) for t in txt[1:]], (3690, -2010, "right"), 89, 89, 42, 150)
    else:
        raise SystemExit("вид: место | дата | цена | блок | серия | крупно | номер | справка (место, дата, цена, справка — и «…-верх»)")
    print(out)


if __name__ == "__main__":
    main()
