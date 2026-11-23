#!/usr/bin/env python3
"""Где резать полосу 16:9 из вертикального (или просто более высокого) кадра, чтобы не срезать людям головы.

Рецензент 23.11 (s3 v20, 9:42 и 9:47): полоса по центру вертикали — Сергей идёт спиной, голова за верхним краем.
band_y(path, a, dur) — YOLOX-S на 5 кадрах куска [a, a+dur]: люди выше 8 % кадра; верх самой высокой рамки минус 5 % высоты —
верх полосы (полоса не ниже этого). Ответ — доля высоты кадра для центра полосы, или None (людей нет / кадр не выше 16:9) —
тогда решает вызывающий (по центру или прежние 42 %). band_y_image(img) — то же для фото (PIL или BGR-массив).
Кеш — ~/.cache/metravel-crop-band.json (путь|от|длина). Модель — --yolox / METRAVEL_YOLOX / модели/ рядом с планом (yolox_path).
python3 crop_band.py <файл> <от> <длина> [--yolox M.onnx] — напечатать центр полосы.
Без OpenCV (render_plan, vertical_render, memory_grade, сборщики серий идут обычным python3): ensure([...]) запускает этот файл
пакетом через uv (`batch <задания.json>`: [[путь, от, длина] | [путь, "img"]]) и читает кеш; cached(путь, от, длина) — из кеша."""
import json, os, subprocess, sys

CACHE = os.path.expanduser("~/.cache/metravel-crop-band.json")
_DET = {}


def _key(path, a=None, dur=None):
    return f"{path}|img" if a is None else f"{path}|{a:.2f}|{dur:.2f}"


def _load():
    if os.path.exists(CACHE):
        try: return json.load(open(CACHE))
        except Exception: pass
    return {}


def _save(C):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    old = _load(); old.update(C)                               # другой процесс мог дописать своё
    tmp = CACHE + f".{os.getpid()}"; json.dump(old, open(tmp, "w")); os.replace(tmp, CACHE)


def cached(path, a=None, dur=None):
    """(есть ли в кеше, центр полосы или None)."""
    C = _load(); k = _key(path, a, dur)
    return (k in C, C.get(k))


def ensure(items, yp=None):
    """items — [(путь, от, длина)] или [(путь, None, None)] для фото. Считает недостающее пакетом через uv (OpenCV), возвращает
    {ключ: центр или None}. Без модели или без uv — пустой ответ: вызывающий режет по-старому."""
    C = _load(); need = [[p, a, d] if a is not None else [p, "img"] for p, a, d in items if _key(p, a, d) not in C]
    if need:
        yp = yp or find_yolox(*[os.path.dirname(p) for p, _, _ in items], os.getcwd())
        if yp:
            jp = os.path.expanduser(f"~/.cache/metravel-crop-band.jobs.{os.getpid()}.json"); json.dump(need, open(jp, "w"))
            r = subprocess.run(["uv", "run", "-q", "--with", "opencv-python-headless<5", "--with", "numpy", "--with", "pillow", "python",
                                os.path.abspath(__file__), "batch", jp, "--yolox", yp], capture_output=True, text=True)
            if r.returncode: print("crop_band: ошибка —", r.stderr[-300:], flush=True)
            try: os.remove(jp)
            except OSError: pass
            C = _load()
    return {_key(p, a, d): C.get(_key(p, a, d)) for p, a, d in items}


def _det(yp):
    if yp not in _DET:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from plates import Det
        _DET[yp] = Det(yp)
    return _DET[yp]


def find_yolox(*starts):
    """Модель: METRAVEL_YOLOX, затем модели/ в папке или выше (до 5 уровней), затем filmora/модели."""
    if os.environ.get("METRAVEL_YOLOX") and os.path.exists(os.environ["METRAVEL_YOLOX"]): return os.environ["METRAVEL_YOLOX"]
    for s in starts:
        d = os.path.abspath(s)
        for _ in range(6):
            for c in (os.path.join(d, "модели"), os.path.join(d, "filmora", "модели"), os.path.join(d, "служебное", "filmora", "модели"),
                      os.path.join(d, "_подготовка к монтажу", "служебное", "filmora", "модели")):
                p = os.path.join(c, "object_detection_yolox_2022nov.onnx")
                if os.path.exists(p): return p
            d = os.path.dirname(d)
    return None


def _center(tops, fw, fh, aspect=16 / 9):
    """Центр полосы (доля высоты) по верхним краям людей (доли высоты); None — людей нет или кадр не выше полосы."""
    band = (fw / aspect) / fh                                  # высота полосы — доля высоты кадра
    if band >= 0.999 or not tops: return None
    top = max(0.0, min(tops) - 0.05)
    return round(min(max(top + band / 2, band / 2), 1 - band / 2), 4)


def _people_tops(det, img):
    h = img.shape[0]
    _, ppl = det(img)
    return [p[1] / h for p in ppl if p[3] / h >= 0.08]


def band_y(path, a, dur, yp=None):
    import numpy as np
    key = _key(path, a, dur); C = _load()
    if key in C: return C[key]
    yp = yp or find_yolox(os.path.dirname(path), os.getcwd())
    if not yp: return None
    det = _det(yp); tops = []; fw = fh = None
    for k in range(5):
        t = a + dur * (k + 0.5) / 5
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", path, "-frames:v", "1", "-vf", "scale=-2:960",
                            "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, stdin=subprocess.DEVNULL)
        if not r.stdout: continue
        import cv2
        img = cv2.imdecode(np.frombuffer(r.stdout, np.uint8), cv2.IMREAD_COLOR)
        if img is None: continue
        fh, fw = img.shape[:2]; tops += _people_tops(det, img)
    y = _center(tops, fw, fh) if fw else None
    _save({key: y})
    return y


def band_y_image(img, yp):
    """Фото: PIL-картинка или BGR-массив → центр полосы или None."""
    if yp is None: return None
    import cv2, numpy as np
    if not isinstance(img, np.ndarray):
        img = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
    h, w = img.shape[:2]; s = 960 / h
    small = cv2.resize(img, (int(w * s), 960))
    return _center(_people_tops(_det(yp), small), small.shape[1], small.shape[0])


if __name__ == "__main__":
    a = sys.argv[1:]
    yp = a[a.index("--yolox") + 1] if "--yolox" in a else None
    if a and a[0] == "batch":
        from PIL import Image, ImageOps
        out = {}
        for j in json.load(open(a[1])):
            if j[1] == "img":
                out[_key(j[0])] = band_y_image(ImageOps.exif_transpose(Image.open(j[0])), yp or find_yolox(os.path.dirname(j[0]), os.getcwd()))
            else:
                out[_key(j[0], j[1], j[2])] = band_y(j[0], float(j[1]), float(j[2]), yp)
        _save(out); print(json.dumps(out, ensure_ascii=False)); sys.exit(0)
    if len(a) < 3: print(__doc__); sys.exit(2)
    print(band_y(a[0], float(a[1]), float(a[2]), yp))
