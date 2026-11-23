#!/usr/bin/env python3
"""Машины в кадре — кандидаты на читаемый номер, до размытия. Обобщено из GR21 v20/машины.py (s3, по готовому фильму) и
машины_по_плану.py (s5, s7, по исходникам плана).

uv run --with "opencv-python-headless<5" --with numpy --with pillow python vehicles.py plan <plan.json> <папка> [--yolox M.onnx] [--skip 0.,T. концовка]
uv run … vehicles.py film <фильм.mp4> <segments.json> <папка> [--yolox M.onnx]

plan — до рендера: каждый кусок плана (главный план и перебивки) из того файла, что стоит в плане (исходник, размытая, вертикальная,
       память-копия), 1 к/с; время в отчёте — по фильму и по файлу (для размытия номера ±2 кадра по файлу).
film — по готовому фильму 1 к/с; кусок — по <фильм>.segments.json рендера.
Детектор — YOLOX-S (COCO) через cv2.dnn: машина, мотоцикл, автобус, грузовик; кандидат — шире 7 % кадра. Модель по умолчанию —
модели/object_detection_yolox_2022nov.onnx рядом с планом (или папкой выше). В папку: машины.md и листы «машины NN.jpg» — вырез машины
из полного кадра файла (по нему видно, читается ли номер). Тяжёлое задание: берёт общий замок heavy_lock (рендер идёт первым)."""
import io, json, os, subprocess, sys
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import heavy_lock

a = sys.argv[1:]
if len(a) < 3 or a[0] not in ("plan", "film"): print(__doc__); sys.exit(2)
mode = a[0]
opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
base = os.path.dirname(os.path.abspath(a[1]))
yp = opt("--yolox") or next((p for p in (os.path.join(base, "модели", "object_detection_yolox_2022nov.onnx"),
                                         os.path.join(os.path.dirname(base), "модели", "object_detection_yolox_2022nov.onnx"),
                                         os.path.join(base, "filmora", "модели", "object_detection_yolox_2022nov.onnx")) if os.path.exists(p)), None)
if not yp: raise SystemExit("нет модели YOLOX: --yolox <object_detection_yolox_2022nov.onnx>")
out = a[2] if mode == "plan" else a[3]
os.makedirs(out, exist_ok=True)
heavy_lock.acquire(f"vehicles {mode} {os.path.basename(a[1])}", wait="--no-wait" not in a)

VEH = {2: "машина", 3: "мотоцикл", 5: "автобус", 7: "грузовик"}
net = cv2.dnn.readNet(yp); W, H = 960, 540
gs, ss = [], []
for st in (8, 16, 32):
    n = 640 // st; yy, xx = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
    gs.append(np.stack([xx, yy], -1).reshape(-1, 2)); ss.append(np.full((n * n, 1), st))
G, SS = np.concatenate(gs), np.concatenate(ss)


def detect(img, conf=0.4):
    r = min(640 / W, 640 / H); pad = np.full((640, 640, 3), 114, np.uint8)
    rs = cv2.resize(img, (int(W * r), int(H * r))); pad[:rs.shape[0], :rs.shape[1]] = rs
    net.setInput(cv2.dnn.blobFromImage(pad, 1.0, (640, 640), swapRB=False)); o = net.forward()[0]
    xy = (o[:, :2] + G) * SS; wh = np.exp(o[:, 2:4]) * SS
    cls = np.argmax(o[:, 5:], 1); sc = o[:, 4] * o[np.arange(len(o)), 5 + cls]
    k = [i for i in np.where(sc >= conf)[0] if cls[i] in VEH]
    if not k: return []
    bx = [[float((xy[i, 0] - wh[i, 0] / 2) / r), float((xy[i, 1] - wh[i, 1] / 2) / r), float(wh[i, 0] / r), float(wh[i, 1] / r)] for i in k]
    keep = cv2.dnn.NMSBoxes(bx, [float(sc[i]) for i in k], conf, 0.45)
    return [(VEH[cls[k[j]]], bx[j]) for j in np.ravel(keep)]


def frames(path, a0=None, d=None):
    """Кадры 1 к/с (середина секунды): (смещение от a0, картинка 960×540 — кадр вписан с полями, вертикальный не растянут)."""
    cmd = ["ffmpeg", "-v", "error"] + (["-ss", f"{a0 + 0.5:.3f}", "-t", f"{max(0.5, d - 0.5):.3f}"] if a0 is not None else ["-ss", "0.5"]) + [
        "-i", path, "-vf", f"fps=1,scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stdin=subprocess.DEVNULL); k = 0
    while True:
        buf = p.stdout.read(W * H * 3)
        if len(buf) < W * H * 3: break
        yield k + 0.5, np.frombuffer(buf, np.uint8).reshape(H, W, 3); k += 1
    p.wait()


hits = []                      # (время фильма, заметка, файл, секунда файла, вид, x, y, w, h — доли кадра 960×540)
tc = lambda s: f"{int(s // 60)}:{s % 60:04.1f}"
if mode == "plan":
    P = json.load(open(a[1])); SRC = P["sources"]; skip = tuple(x for x in (opt("--skip", "") or "").split(",") if x)
    jobs, t0 = [], 0.0
    for x in P["segments"]:
        d = x["out"] - x["in"]
        if not (skip and x["note"].startswith(skip)):
            jobs.append((t0, x["note"], SRC[x["src"]], x["in"], d))
            for o in x.get("broll", []):
                jobs.append((t0 + o["at"] - x["in"], x["note"] + " / перебивка", o["file"], o.get("in", 0.0), o["dur"]))
        t0 += d
    for k, (ft, note, f, a0, d) in enumerate(jobs):
        if f.lower().endswith((".png", ".jpg", ".jpeg")): continue
        if not os.path.exists(f): print("нет файла", f); continue
        for off, img in frames(f, a0, d):
            for kind, (x0, y0, w, h) in detect(img):
                if w / W >= 0.07: hits.append((ft + off, note, f, a0 + off, kind, x0 / W, y0 / H, w / W, h / H))
        if k % 25 == 0: print(f"  {k}/{len(jobs)} кусков, кандидатов {len(hits)}", flush=True)
    title = f"по плану {os.path.basename(a[1])} (до рендера, кусков {len(jobs)})"
else:
    S = json.load(open(a[2])); S = S if isinstance(S, list) else S["segments"]
    def note(t):
        for s in S:
            if s["start"] <= t < s["start"] + (s["out"] - s["in"]) + 0.01: return s["note"]
        return "?"
    for t, img in frames(a[1]):
        for kind, (x0, y0, w, h) in detect(img):
            if w / W >= 0.07: hits.append((t, note(t), a[1], t, kind, x0 / W, y0 / H, w / W, h / H))
    title = f"в фильме {os.path.basename(a[1])}"

L = [f"# Машины {title} — кандидатов {len(hits)} (ширина ≥ 7 % кадра, 1 к/с)", ""]
for i, (ft, note_, f, st, kind, x0, y0, w, h) in enumerate(hits):
    L.append(f"- [{i + 1}] {tc(ft)} «{note_}»: {kind}, ширина {w:.0%} — `{os.path.basename(f)}` @ {st:.1f} с")
open(os.path.join(out, "машины.md"), "w").write("\n".join(L) + "\n")
fnt = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18); tiles = []
for i, (ft, note_, f, st, kind, x0, y0, w, h) in enumerate(hits):
    fr = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{st:.2f}", "-i", f, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                        capture_output=True, stdin=subprocess.DEVNULL).stdout
    if not fr: continue
    im = Image.open(io.BytesIO(fr)).convert("RGB"); FW, FH = im.size
    sc_ = min(W / FW, H / FH); ox, oy = (W - FW * sc_) / 2, (H - FH * sc_) / 2      # из 960×540 с полями — в кадр файла
    X, Y, Wd, Hd = (x0 * W - ox) / sc_, (y0 * H - oy) / sc_, w * W / sc_, h * H / sc_
    cr = im.crop((int(max(0, X - Wd * .15)), int(max(0, Y - Hd * .15)), int(min(FW, X + Wd * 1.15)), int(min(FH, Y + Hd * 1.15))))
    cr.thumbnail((400, 260))
    tile = Image.new("RGB", (400, 284), "black"); tile.paste(cr, (0, 24))
    ImageDraw.Draw(tile).text((4, 2), f"[{i + 1}] {tc(ft)} {os.path.basename(f)[-14:]} {st:.0f}s", font=fnt, fill="white"); tiles.append(tile)
for n in range(0, len(tiles), 20):
    part = tiles[n:n + 20]; sheet = Image.new("RGB", (4 * 404, ((len(part) + 3) // 4) * 288), "black")
    for i, tl in enumerate(part): sheet.paste(tl, ((i % 4) * 404, (i // 4) * 288))
    sheet.save(os.path.join(out, f"машины {n // 20 + 1:02d}.jpg"), quality=85)
print(f"кандидатов {len(hits)} → {out}")
