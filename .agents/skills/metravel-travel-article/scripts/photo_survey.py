#!/usr/bin/env python3
"""
Разведка папки с фото перед написанием/обогащением статьи metravel.by.

Делает три вещи, которые невозможно сделать «на глаз» и без которых статья
выходит с выдуманной географией и случайными кадрами:

  1. читает EXIF (GPS + дата съёмки) у всех фото;
  2. кластеризует точки съёмки в места и (опционально) обратно геокодирует их
     через OSM/Nominatim — так восстанавливается фактический маршрут по дням;
  3. собирает контактные листы 6x6, чтобы просмотреть ВСЕ кадры глазами
     и осознанно отобрать те, что пойдут в статью.

Использование:
    python3 photo_survey.py "<папка>" --out /tmp/survey [--geocode] [--no-sheets]

Папка может содержать подпапки (по дням/местам) — они обрабатываются отдельно,
каждая со своей нумерацией кадров. Нумерация кадров = порядок `sorted()` имён
файлов внутри подпапки; ровно эти номера печатаются в отчёте и подписывают
плитки контактных листов, поэтому по номеру всегда можно вернуться к исходнику
через survey.json.

Требуется: Pillow (есть в node_modules-независимом системном python3) и ffmpeg.
"""

import argparse
import json
import math
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request

IMAGE_EXT = (".jpg", ".jpeg", ".png", ".heic")
VIDEO_EXT = (".mp4", ".mov", ".avi")
CLUSTER_KM = 1.2
TILE_W, TILE_H = 264, 198
GRID_COLS, GRID_ROWS = 6, 6
NOMINATIM_UA = "metravel-article-bot/1.0 (savran.juli@gmail.com)"


def die(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def loose_key(s):
    """Ключ для сравнения имён файлов/папок «как их видит человек».

    Два независимых источника расхождений на реальных папках с фото:
      * macOS хранит имена в NFD, а из чата путь прилетает в NFC;
      * экспорт Apple Photos ставит в имена НЕРАЗРЫВНЫЕ пробелы
        (U+00A0 «Адршпашские скалы», U+202F «2025 г.»), а человек копирует
        путь с обычными — и папка «не находится».
    """
    import unicodedata
    s = unicodedata.normalize("NFC", s)
    for ch in (" ", " ", " ", " ", " ", "\t"):
        s = s.replace(ch, " ")
    return " ".join(s.split()).casefold()


def resolve_path(p):
    """Находит папку, даже если путь отличается нормализацией или пробелами."""
    if os.path.isdir(p):
        return p
    import unicodedata
    for form in ("NFD", "NFC"):
        c = unicodedata.normalize(form, p)
        if os.path.isdir(c):
            return c
    parent = os.path.dirname(p.rstrip("/")) or "."
    base = os.path.basename(p.rstrip("/"))
    for parent_c in (parent,
                     unicodedata.normalize("NFD", parent),
                     unicodedata.normalize("NFC", parent)):
        if not os.path.isdir(parent_c):
            continue
        want = loose_key(base)
        hits = [e for e in os.listdir(parent_c)
                if not e.startswith("._") and loose_key(e) == want
                and os.path.isdir(os.path.join(parent_c, e))]
        if len(hits) == 1:
            return os.path.join(parent_c, hits[0])
        pref = [e for e in os.listdir(parent_c)
                if not e.startswith("._")
                and loose_key(e).startswith(want[:12])
                and os.path.isdir(os.path.join(parent_c, e))]
        if len(pref) == 1:
            return os.path.join(parent_c, pref[0])
    return None


def list_dirs(root):
    """Возвращает [(ключ, путь)] — либо подпапки, либо сама папка."""
    subs = sorted(
        d for d in os.listdir(root)
        if not d.startswith(".") and os.path.isdir(os.path.join(root, d))
    )
    if not subs:
        return [("all", root)]
    return [(_slug(d, i), os.path.join(root, d)) for i, d in enumerate(subs)]


def _slug(name, i):
    lat = "".join(ch for ch in name.lower() if ch.isascii() and (ch.isalnum()))
    return (lat[:8] or "d%d" % i)


def list_images(path):
    return sorted(
        f for f in os.listdir(path)
        if not f.startswith("._") and f.lower().endswith(IMAGE_EXT)
    )


def count_videos(path):
    return sum(
        1 for f in os.listdir(path)
        if not f.startswith("._") and f.lower().endswith(VIDEO_EXT)
    )


def read_exif(path):
    """-> (lat, lon, 'YYYY:MM:DD HH:MM:SS'|None). Тихо отдаёт (None, None, None)."""
    try:
        from PIL import Image
    except ImportError:
        die("нужен Pillow: python3 -m pip install --user Pillow")
    try:
        img = Image.open(path)
        ex = img.getexif()
        dt = ex.get(306)
        gps = ex.get_ifd(0x8825) or {}
        lat = lon = None
        if 2 in gps and 4 in gps:
            def dms(v):
                d, m, s = (float(x) for x in v)
                return d + m / 60 + s / 3600
            lat, lon = dms(gps[2]), dms(gps[4])
            if gps.get(1) == "S":
                lat = -lat
            if gps.get(3) == "W":
                lon = -lon
        return lat, lon, dt
    except Exception:
        return None, None, None


def haversine(a, b):
    r = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def cluster(rows):
    out = []
    for r in rows:
        if r["lat"] is None:
            continue
        pt = (r["lat"], r["lon"])
        for c in out:
            if haversine(pt, (c["lat"], c["lon"])) < CLUSTER_KM:
                c["n"] += 1
                c["frames"].append(r["i"])
                c["days"].add((r["dt"] or "")[:10])
                break
        else:
            out.append({"lat": r["lat"], "lon": r["lon"], "n": 1,
                        "frames": [r["i"]], "days": {(r["dt"] or "")[:10]}})
    out.sort(key=lambda c: -c["n"])
    return out


def reverse_geocode(lat, lon, zoom=16):
    url = ("https://nominatim.openstreetmap.org/reverse?format=jsonv2"
           "&lat=%f&lon=%f&zoom=%d&accept-language=pl,en" % (lat, lon, zoom))
    req = urllib.request.Request(url, headers={"User-Agent": NOMINATIM_UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            j = json.load(r)
        return j.get("name") or "", j.get("display_name", "")
    except Exception as e:
        return "", "ERR %s" % e


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def build_sheets(key, folder, files, out_dir):
    """Нормализует превью и собирает контактные листы 6x6.

    Две грабли ffmpeg, из-за которых лист выходит с 1-2 картинками:
      * фильтр `tile` сбрасывается при переинициализации графа — её вызывает
        не только смена размера, но и смена pix_fmt между кадрами (экспорт из
        Apple Photos даёт вперемешку yuvj420p и yuvj444p). Поэтому превью
        нормализуются в ОДИН размер И один pix_fmt отдельным проходом;
      * `-start_number N -i %04d.jpg` для нарезки на листы врёт — листы едут на
        кадр. Надёжно только `-f concat` со списком ровно нужных файлов.
      * `pad` может упасть на округлении — скейлим в чуть меньший бокс.
    """
    thumbs = os.path.join(out_dir, "thumbs", key)
    os.makedirs(thumbs, exist_ok=True)
    jobs = []
    for i, f in enumerate(files, 1):
        dst = os.path.join(thumbs, "%04d.jpg" % i)
        if not os.path.exists(dst):
            jobs.append((os.path.join(folder, f), dst))
    vf = ("scale=%d:%d:force_original_aspect_ratio=decrease,"
          "pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=0x1a1a1a,setsar=1,format=yuvj420p"
          % (TILE_W - 8, TILE_H - 6, TILE_W, TILE_H))
    for src, dst in jobs:
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", vf,
             "-pix_fmt", "yuvj420p", "-q:v", "3", dst])

    per = GRID_COLS * GRID_ROWS
    sheets = []
    sheets_dir = os.path.join(out_dir, "sheets")
    os.makedirs(sheets_dir, exist_ok=True)
    for s in range((len(files) + per - 1) // per):
        lo, hi = s * per + 1, min((s + 1) * per, len(files))
        lst = os.path.join(out_dir, "thumbs", "%s_cat_%02d.txt" % (key, s + 1))
        with open(lst, "w") as fh:
            for i in range(lo, hi + 1):
                fh.write("file '%s'\n" % os.path.join(thumbs, "%04d.jpg" % i))
        out = os.path.join(sheets_dir, "%s-%02d.jpg" % (key, s + 1))
        run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
             "-i", lst, "-vf", "tile=%dx%d:padding=2:color=0x404040" % (GRID_COLS, GRID_ROWS),
             "-frames:v", "1", "-q:v", "3", out])
        sheets.append({"file": out, "from": lo, "to": hi})
    return sheets


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--out", required=True, help="куда сложить thumbs/sheets/survey.json")
    ap.add_argument("--geocode", action="store_true",
                    help="обратное геокодирование кластеров через OSM (1 запрос/сек)")
    ap.add_argument("--no-sheets", action="store_true", help="не собирать контактные листы")
    args = ap.parse_args()

    root = resolve_path(os.path.abspath(args.folder))
    if not root:
        die("нет такой папки: " + args.folder)
    os.makedirs(args.out, exist_ok=True)

    survey = {"root": root, "groups": []}
    for key, path in list_dirs(root):
        files = list_images(path)
        if not files:
            continue
        rows = []
        for i, f in enumerate(files, 1):
            lat, lon, dt = read_exif(os.path.join(path, f))
            rows.append({"i": i, "file": f, "lat": lat, "lon": lon, "dt": dt})
        cl = cluster(rows)
        if args.geocode:
            for c in cl:
                if c["n"] < 2:
                    continue
                name, disp = reverse_geocode(c["lat"], c["lon"])
                c["place"] = name
                c["address"] = disp
                time.sleep(1.1)
        sheets = [] if args.no_sheets else build_sheets(key, path, files, args.out)

        print("\n=== %s  (%s)" % (key, os.path.basename(path)))
        print("    фото: %d, видео: %d, с GPS: %d"
              % (len(files), count_videos(path), sum(1 for r in rows if r["lat"])))
        days = sorted({(r["dt"] or "")[:10] for r in rows if r["dt"]})
        if days:
            print("    даты: %s" % ", ".join(days))
        for c in cl:
            if c["n"] < 2:
                continue
            fr = c["frames"]
            print("    %5.5f,%5.5f  n=%3d  кадры %d-%d  %s%s"
                  % (c["lat"], c["lon"], c["n"], min(fr), max(fr),
                     ", ".join(sorted(d for d in c["days"] if d)),
                     ("  → " + (c.get("place") or c.get("address", ""))[:70]) if args.geocode else ""))
        for sh in sheets:
            print("    лист %s  кадры %d-%d" % (os.path.basename(sh["file"]), sh["from"], sh["to"]))

        survey["groups"].append({
            "key": key, "folder": path, "files": rows,
            "clusters": [{k: (sorted(v) if isinstance(v, set) else v) for k, v in c.items()} for c in cl],
            "sheets": sheets,
        })

    with open(os.path.join(args.out, "survey.json"), "w") as fh:
        json.dump(survey, fh, ensure_ascii=False, indent=1)
    print("\nsurvey.json → %s" % os.path.join(args.out, "survey.json"))
    print("Дальше: просмотри ВСЕ листы из %s/sheets Read'ом, выпиши номера кадров,"
          % args.out)
    print("а исходные файлы по номерам достанешь из survey.json (groups[].files[].file).")


if __name__ == "__main__":
    main()
