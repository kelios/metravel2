#!/usr/bin/env python3
"""Проверка цвета готового фильма: экспозиция, оттенок, насыщенность и согласованность соседних планов.

uv run --with opencv-python-headless --with numpy python audit_color.py <фильм.mp4> --segments <фильм.segments.json>
    [--out audit_color.md] [--skip-dirs память,титры,карты]

План = отрезок главной дорожки, а перебивка внутри него — отдельный план. По 2 кадрам каждого плана:
  ПЕРЕСВЕТ  > 5% кадра выбито в белое (все каналы ≥ 98%) — небо, окна; поправить уровни или взять другой план
  ТЕНИ      > 8% кадра провалено в чёрное (яркость < 1%)
  ТЕМНО     медиана яркости < 0.18 (не ночь по замыслу?)        СВЕТЛО   медиана > 0.72
  ОТТЕНОК   почти серые пиксели заметно окрашены (> 8%): синий/жёлтый/зелёный/пурпурный
  БЛЕКЛО    насыщенность < 0.5 медианы фильма                    КИСЛОТНО > 1.8 медианы
  СКАЧОК    соседние планы одной сцены (тот же номер в начале заметки) сняты разными камерами
            (Pocket, ZV-E1, iPhone, дрон) и различаются по яркости > 0.2 или по оттенку > 0.08 —
            разнобой камер, который снимает покраска. Перепад света между разными местами одной
            камерой — содержание, не находка. Тизер и интро (быстрый монтаж по замыслу) не сравниваются.
Рядом с отчётом:
  _лента.jpg — по кадру на каждый план подряд, с таймкодом: согласованность цвета видна глазом за один взгляд;
  _скопы.jpg — для каждого плана с находкой: кадр | осциллограф яркости | вектороскоп (где пересвет, куда уходит оттенок).
Обработанные файлы со своим стилем («память», титры, карты) пропускаются (--skip-dirs).
"""
import json, os, re, subprocess, sys
import numpy as np, cv2

a = sys.argv[1:]
film = a[0]
opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
segs = json.load(open(opt("--segments")))
out = opt("--out")
SKIP = [x.strip() for x in opt("--skip-dirs", "память,титры,карты,2 карты").split(",") if x.strip()]
W, H = 320, 180
skip = lambda p: any(f"/{d}/" in p for d in SKIP) or not p.lower().endswith((".mp4", ".mov", ".m4v", ".mts"))
tc = lambda x: f"{int(x // 60)}:{x % 60:04.1f}"

# планы: отрезок главной дорожки, разрезанный перебивками
shots = []
for s in segs:
    br = sorted([(b["at_film"], b["at_film"] + b["dur"], b["file"]) for b in s.get("broll", []) if b["dur"] > 0.6])
    t = s["start"]
    for b0, b1, f in br:
        b0, b1 = max(b0, s["start"]), min(b1, s["end"])
        if b0 - t > 0.8: shots.append((t, b0, s["src"], s["note"]))
        if b1 - b0 > 0.8: shots.append((b0, b1, f, s["note"]))
        t = max(t, b1)
    if s["end"] - t > 0.8: shots.append((t, s["end"], s["src"], s["note"]))


def frame(t, w=W, h=H):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", film, "-frames:v", "1", "-vf", f"scale={w}:{h}:flags=area",
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    return None if len(r.stdout) < w * h * 3 else np.frombuffer(r.stdout[:w * h * 3], np.uint8).reshape(h, w, 3)


def measure(px):
    px = px.reshape(-1, 3).astype(np.float32) / 255
    y = px @ np.array([0.2126, 0.7152, 0.0722])
    mx, mn = px.max(1), px.min(1); sat = (mx - mn) / np.maximum(mx, 1e-3)
    neut = (sat < 0.12) & (y > 0.2) & (y < 0.85)   # строже, чем в grade.py: трава и освещённый мел не должны сойти за серое
    cast = None
    if neut.sum() > 300:
        r, g, b = px[neut].mean(0); cast = ((r - g) / g, (b - g) / g)
    mid = (y > 0.1) & (y < 0.95)
    return {"p50": float(np.median(y)), "hi": float((mn >= 0.98).mean()), "lo": float((y < 0.01).mean()),
            "sat": float(sat[mid].mean()) if mid.any() else 0.0, "cast": cast}


R = []
for t0, t1, src, note in shots:
    fr = [frame(t0 + (t1 - t0) * k) for k in (0.3, 0.7)]
    fr = [f for f in fr if f is not None]
    if not fr: continue
    m = measure(np.concatenate(fr)); m.update(t0=t0, t1=t1, src=src, note=note, thumb=fr[0], cam=not skip(src))
    R.append(m)
cam = [r for r in R if r["cam"]]
med_sat = float(np.median([r["sat"] for r in cam])) if cam else 0.3
F = []
def castname(c):
    rg, bg = c
    if abs(bg) >= abs(rg): return "синий" if bg > 0 else "жёлтый"
    if rg > 0: return "пурпурный" if bg > 0 else "красный/оранжевый"
    return "зелёный" if bg <= 0 else "голубой"
for r in cam:
    t, n = r["t0"], r["note"]
    if r["hi"] > 0.05: F.append((t, "ПЕРЕСВЕТ", n, f"выбито {r['hi']:.0%} кадра"))
    if r["lo"] > 0.08: F.append((t, "ТЕНИ", n, f"провалено в чёрное {r['lo']:.0%} кадра"))
    if r["p50"] < 0.18: F.append((t, "ТЕМНО", n, f"медиана яркости {r['p50']:.2f}"))
    if r["p50"] > 0.72: F.append((t, "СВЕТЛО", n, f"медиана яркости {r['p50']:.2f}"))
    if r["cast"] and max(abs(r["cast"][0]), abs(r["cast"][1])) > 0.08:
        F.append((t, "ОТТЕНОК", n, f"серое уходит в {castname(r['cast'])} (R−G {r['cast'][0]:+.2f}, B−G {r['cast'][1]:+.2f})"))
    if r["sat"] < 0.5 * med_sat: F.append((t, "БЛЕКЛО", n, f"насыщенность {r['sat']:.2f} при медиане фильма {med_sat:.2f}"))
    if r["sat"] > 1.8 * med_sat: F.append((t, "КИСЛОТНО", n, f"насыщенность {r['sat']:.2f} при медиане фильма {med_sat:.2f}"))
scene = lambda n: n.split(".")[0].strip() if "." in n[:4] else n[:12]
def camera(p):
    """Семейство камеры по имени исходника; перебивки из производных папок (размытие, вертикальные) — неизвестно."""
    b = os.path.basename(p)
    if re.match(r"DJI_\d{14}_\d+_D", b): return "pocket"
    if re.match(r"C\d{4}\.MP4", b, re.I): return "zv-e1"
    if b.startswith("Медиатека") or re.match(r"IMG_\d+", b): return "iphone"
    if re.match(r"DJI_\d{4}\.MP4", b, re.I): return "drone"
    return None
for p, q in zip(R, R[1:]):
    if not (p["cam"] and q["cam"]) or scene(p["note"]) != scene(q["note"]) or q["t0"] - p["t1"] > 0.5: continue
    if any(w in p["note"] + q["note"] for w in ("тизер", "интро")): continue
    cp, cq = camera(p["src"]), camera(q["src"])
    if not cp or not cq or cp == cq: continue
    dy = abs(p["p50"] - q["p50"])
    dc = max(abs(p["cast"][0] - q["cast"][0]), abs(p["cast"][1] - q["cast"][1])) if p["cast"] and q["cast"] else 0
    if dy > 0.2 or dc > 0.08:
        F.append((q["t0"], "СКАЧОК", q["note"], f"{cp} → {cq}: яркость {p['p50']:.2f} → {q['p50']:.2f}" + (f", оттенок сдвинулся на {dc:.2f}" if dc > 0.08 else "")))
F.sort()
LAT = {"ПЕРЕСВЕТ": "CLIP", "ТЕНИ": "CRUSH", "ТЕМНО": "DARK", "СВЕТЛО": "BRIGHT", "ОТТЕНОК": "CAST",
       "БЛЕКЛО": "FLAT", "КИСЛОТНО": "OVERSAT", "СКАЧОК": "JUMP"}   # подписи на картинках: шрифт cv2 без кириллицы

if out:
    base = os.path.splitext(out)[0]
    # лента: все планы подряд
    tiles = []
    for r in R:
        im = cv2.cvtColor(r["thumb"], cv2.COLOR_RGB2BGR).copy()
        cv2.putText(im, tc(r["t0"]), (4, 16), 0, 0.45, (0, 255, 255), 1)
        if not r["cam"]: cv2.rectangle(im, (0, 0), (W - 1, H - 1), (128, 128, 128), 2)
        tiles.append(im)
    rows = [np.hstack(tiles[i:i + 8] + [np.zeros((H, W, 3), np.uint8)] * (8 - len(tiles[i:i + 8]))) for i in range(0, len(tiles), 8)]
    if rows: cv2.imwrite(base + "_лента.jpg", np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 82])
    # скопы планов с находками: кадр | осциллограф | вектороскоп
    seen, sc = set(), []
    for t, k, n, _ in F:
        if t in seen: continue
        seen.add(t)
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t + 0.5:.3f}", "-i", film, "-frames:v", "1", "-filter_complex",
                            "[0:v]scale=480:270,format=yuv444p,split=3[f][w][v];[w]waveform=intensity=0.08:mode=column:display=overlay:graticule=green:flags=numbers,scale=480:270[W];"
                            "[v]vectorscope=mode=color3:graticule=green:flags=name,scale=270:270[V];[f][W][V]hstack=3,format=bgr24",
                            "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
        ww = 480 + 480 + 270
        if len(r.stdout) < ww * 270 * 3: continue
        im = np.frombuffer(r.stdout[:ww * 270 * 3], np.uint8).reshape(270, ww, 3).copy()
        lab = ", ".join(sorted({LAT[kk] for tt, kk, _, _ in F if tt == t}))
        cv2.putText(im, f"{tc(t)} {lab}", (6, 22), 0, 0.6, (0, 255, 255), 2); sc.append(im)
    if sc: cv2.imwrite(base + "_скопы.jpg", np.vstack(sc[:40]), [cv2.IMWRITE_JPEG_QUALITY, 85])
    json.dump([{"start": t, "kind": k, "note": n, "detail": x} for t, k, n, x in F], open(base + ".json", "w"), ensure_ascii=False, indent=1)

ys = [r["p50"] for r in cam]
lines = [f"# Проверка цвета: {os.path.basename(film)}, планов {len(R)} (камерных {len(cam)}), находок {len(F)}", "",
         f"Медиана яркости по фильму {np.median(ys):.2f} (разброс p10–p90 {np.percentile(ys, 10):.2f}–{np.percentile(ys, 90):.2f}), "
         f"насыщенность {med_sat:.2f}." if ys else "", ""]
for kk in ["ПЕРЕСВЕТ", "ТЕНИ", "ТЕМНО", "СВЕТЛО", "ОТТЕНОК", "БЛЕКЛО", "КИСЛОТНО", "СКАЧОК"]:
    rows_ = [f for f in F if f[1] == kk]
    lines += [f"## {kk} — {len(rows_)}"] + ([f"- {tc(t)} «{n[:44]}»: {x}" for t, _, n, x in rows_] or ["- нет"]) + [""]
txt = "\n".join(lines)
if out: open(out, "w").write(txt)
print(txt)
