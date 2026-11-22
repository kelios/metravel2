#!/usr/bin/env python3
"""Где на кадре плашка и окошко «картинка в картинке»: общая геометрия раскладки плана и проверки audit_cut (ОКНО).

Окошко (cards с "pip": {x, y, scale}) render_plan.py рисует шириной scale·W с белой рамкой 2 px, центр (x·W, y·H),
высота — по пропорциям файла. Плашка — PNG во весь кадр (titry.py), видимая часть — непрозрачные пиксели.
Координаты — доли кадра 0..1. s5 v1 (рецензент 22.11): справка справа внизу длинной строкой уходила под окошко
рассказчика слева внизу — «…чими и в шерсти»; поле 40 px в titry.py меряет край кадра, а не окошко.
"""
import functools, json, os, subprocess

FRAME = 16 / 9


@functools.lru_cache(None)
def card_box(png):
    """Видимая часть плашки (x0, y0, x1, y1) в долях кадра; пустая или нечитаемая — None."""
    from PIL import Image
    if not os.path.exists(png):
        return None
    im = Image.open(png)
    if im.mode != "RGBA":
        return (0.0, 0.0, 1.0, 1.0)
    b = im.getchannel("A").getbbox()
    w, h = im.size
    return (b[0] / w, b[1] / h, b[2] / w, b[3] / h) if b else None


@functools.lru_cache(None)
def aspect(path):
    """Высота / ширина кадра файла с учётом поворота (вертикальное видео с телефона)."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height:stream_side_data=rotation", "-of", "json", path], capture_output=True, text=True)
    try:
        st = json.loads(r.stdout)["streams"][0]
    except Exception:
        return 9 / 16
    w, h = st["width"], st["height"]
    rot = next((abs(int(float(d.get("rotation", 0)))) for d in st.get("side_data_list", []) if "rotation" in d), 0)
    return w / h if rot in (90, 270) else h / w


def pip_box(o):
    """Окошко (x0, y0, x1, y1) в долях кадра: как его ставит render_plan.py."""
    p = o["pip"]
    sw = float(p.get("scale", 0.3))
    sh = sw * aspect(o["file"]) * FRAME
    cx, cy = float(p.get("x", 0.5)), float(p.get("y", 0.5))
    return (cx - sw / 2, cy - sh / 2, cx + sw / 2, cy + sh / 2)


def hit(a, b, pad=0.006):
    """Прямоугольники пересекаются (с запасом pad ≈ 23 px по ширине 4K: рамка и тень не касаются текста)."""
    return a[0] < b[2] + pad and b[0] < a[2] + pad and a[1] < b[3] + pad and b[1] < a[3] + pad


def clashes(seg):
    """Плашки отрезка, которые на экране вместе с окошком и заходят на него: [(плашка, окошко)]."""
    cards = seg.get("cards", [])
    pips = [o for o in cards if o.get("pip")]
    out = []
    for c in cards:
        if c.get("pip") or not c["file"].lower().endswith(".png"):
            continue
        cb = card_box(c["file"])
        if not cb:
            continue
        for p in pips:
            if min(c["at"] + c["dur"], p["at"] + p["dur"]) - max(c["at"], p["at"]) > 0.05 and hit(cb, pip_box(p)):
                out.append((c, p))
                break
    return out
