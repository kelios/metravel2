#!/usr/bin/env python3
"""Проверка «глазами» по готовому видео: то, что на листах кадров с шагом 5 с не видно.

uv run --with opencv-python-headless --with numpy python audit_frames.py <фильм.mp4> --segments <segments.json>
    [--faces DIR] [--out audit_frames.md]

--faces — папка с yunet.onnx, sface.onnx и эталонами лиц авторов лица_эталоны.json ({имя: [вектор SFace, ...]}).
Соглашение заметок отрезков: «тизер» — намеренно короткие планы.

Находки:
  ВСПЫШКА  резкий скачок яркости (белая вспышка) на 1–6 кадров
  МЕЛЬК    план между двумя склейками короче 1 с (вне тизера)
  ВОЗВРАТ  статичная камера, лицо растёт к камере ≥ 2 раза за 1–6 с — человек идёт к камере (вернулся за штативом?)
  ЛИЦО     чужое резкое лицо крупнее 5% высоты кадра (не автор, не размыто)
  РАЗМЫТ   размытое пятно на месте лица автора (резкость лица автора ниже порога) — проверить глазами
"""
import json, os, re, subprocess, sys
import numpy as np, cv2

a = sys.argv[1:]
film = a[0]
opt = lambda k: a[a.index(k) + 1] if k in a else None
segs = json.load(open(opt("--segments"))); fdir = opt("--faces"); out = opt("--out")
teaser = [(s["start"], s["end"]) for s in segs if "тизер" in s["note"]]
note_at = lambda t: next((s["note"] for s in segs if s["start"] <= t < s["end"]), "")
in_teaser = lambda t: any(x - 0.5 <= t <= y + 0.5 for x, y in teaser)
F = []

# яркость каждого кадра и склейки
W, H = 320, 180
pr = subprocess.Popen(["ffmpeg", "-v", "error", "-i", film, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
fps = 30.0; ys = []; prev = None; diffs = []
while True:
    b = pr.stdout.read(W * H)
    if len(b) < W * H: break
    g = np.frombuffer(b, np.uint8).astype(np.float32)
    ys.append(float(g.mean())); diffs.append(0.0 if prev is None else float(np.abs(g - prev).mean())); prev = g
pr.wait()
r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", film], capture_output=True, text=True)
n_, d_ = r.stdout.strip().split("/"); fps = float(n_) / float(d_)
ys = np.array(ys)
for i in range(3, len(ys) - 7):
    base = min(ys[i - 3:i].mean(), ys[i + 7] if i + 7 < len(ys) else ys[i - 1])
    if ys[i] - base > 45 and ys[i] > 185 and (ys[i - 1] - base) < 25:
        F.append((i / fps, "ВСПЫШКА", note_at(i / fps), f"яркость {base:.0f} → {ys[i]:.0f}"))
cuts = [i / fps for i in range(1, len(diffs)) if diffs[i] > 38 and diffs[i] > 3 * (np.mean(diffs[max(0, i - 5):i]) + 1)]
for c0, c1 in zip(cuts, cuts[1:]):
    if 0.08 < c1 - c0 < 1.0 and not in_teaser(c0):
        F.append((c0, "МЕЛЬК", note_at(c0), f"план {c1 - c0:.2f} с между склейками"))

# лица: 3 к/с
if fdir:
    det = cv2.FaceDetectorYN.create(os.path.join(fdir, "yunet.onnx"), "", (640, 360), 0.8, 0.3, 5000)
    rec = cv2.FaceRecognizerSF.create(os.path.join(fdir, "sface.onnx"), "")
    E = json.load(open(os.path.join(fdir, "лица_эталоны.json")))
    R = [np.array(v) / np.linalg.norm(v) for vs in E.values() for v in vs]
    w, h = 640, 360
    pr = subprocess.Popen(["ffmpeg", "-v", "error", "-i", film, "-vf", f"fps=3,scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    det.setInputSize((w, h)); k = 0; tracks = []; live = []
    while True:
        b = pr.stdout.read(w * h * 3)
        if len(b) < w * h * 3: break
        img = np.frombuffer(b, np.uint8).reshape(h, w, 3); t = k / 3.0; k += 1
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, ff = det.detect(img); nl = []
        for row in ([] if ff is None else ff):
            x, y, bw, bh = [float(v) for v in row[:4]]
            if bh / h < 0.05: continue
            crop = g[max(0, int(y)):int(y + bh), max(0, int(x)):int(x + bw)]
            sharp = float(cv2.Laplacian(crop, cv2.CV_64F).var()) if crop.size else 0
            e = rec.feature(rec.alignCrop(img, row)).flatten(); e = e / np.linalg.norm(e); sim = max(float(np.dot(e, q)) for q in R)
            box = (x, y, bw, bh)
            tr = next((q for q in live if abs(q["box"][0] + q["box"][2] / 2 - x - bw / 2) < 0.15 * w and abs(q["box"][1] + q["box"][3] / 2 - y - bh / 2) < 0.2 * h), None)
            if tr is None: tr = {"pts": []}; tracks.append(tr)
            tr["box"] = box; tr["pts"].append((t, bh / h, sim, sharp, float(row[14]))); nl.append(tr)
        live = nl
    pr.wait()
    for tr in tracks:
        p = tr["pts"]
        if len(p) < 2: continue
        sims = sorted(s for _, _, s, _, _ in p); med = sims[len(sims) // 2]
        t0 = p[0][0]; hmax = max(x[1] for x in p); shp = sorted(x[3] for x in p)[len(p) // 2]
        if med < 0.25 and hmax >= 0.06 and shp > 60:
            F.append((t0, "ЛИЦО", note_at(t0), f"чужое резкое лицо {hmax:.0%} высоты, {p[-1][0] - t0:.1f} с (сходство с авторами {med:.2f})"))
        if med >= 0.36 and shp < 15:
            F.append((t0, "РАЗМЫТ", note_at(t0), f"лицо автора нерезкое (резкость {shp:.0f}) — не размыто ли"))
        h0 = min(x[1] for x in p[:3]); h1 = max(x[1] for x in p[-3:])
        if h1 >= 2 * h0 and 1.0 <= p[-1][0] - p[0][0] <= 6:
            i0, i1 = int(p[0][0] * fps), int(p[-1][0] * fps)
            motion = float(np.mean(diffs[i0:i1])) if i1 > i0 else 99
            if motion < 6:
                F.append((t0, "ВОЗВРАТ", note_at(t0), f"лицо растёт {h0:.0%} → {h1:.0%} за {p[-1][0] - p[0][0]:.1f} с при статичной камере"))

F.sort()
tc = lambda x: f"{int(x // 60)}:{x % 60:04.1f}"
lines = [f"# Проверка глазами: {os.path.basename(film)}, находок {len(F)}", ""]
for kk in ["ВСПЫШКА", "МЕЛЬК", "ВОЗВРАТ", "ЛИЦО", "РАЗМЫТ"]:
    rows = [f for f in F if f[1] == kk]
    lines += [f"## {kk} — {len(rows)}"] + ([f"- {tc(t)} «{n[:44]}»: {x}" for t, _, n, x in rows] or ["- нет"]) + [""]
txt = "\n".join(lines)
if out: open(out, "w").write(txt)
print(txt)
