#!/usr/bin/env python3
"""Проверка «глазами» по готовому видео: то, что на листах кадров с шагом 5 с не видно.

uv run --with "opencv-python-headless<5" --with numpy python audit_frames.py <фильм.mp4> --segments <segments.json>
    [--faces DIR] [--yolox object_detection_yolox_2022nov.onnx] [--words-root DIR] [--alias alias.json] [--out audit_frames.md]
(OpenCV 5 убрал детектор людей HOG — без него ПУСТО/ПРОХОДКА/УХОДИТ/ВРАЗНОБОЙ не проверяются, отчёт это пишет.
 HOG теряет мелкие фигуры и людей спиной в тёплой «памяти»: эти четыре находки — кандидаты для глаза, а не приговор.)

--faces — папка с yunet.onnx, sface.onnx и эталонами лиц авторов лица_эталоны.json ({имя: [вектор SFace, ...]}).
Соглашение заметок отрезков: «тизер» — намеренно короткие планы.

Находки:
  ВСПЫШКА  резкий скачок яркости (белая вспышка) на 1–6 кадров
  МЕЛЬК    план между двумя склейками короче 1 с (вне тизера)
  СТЫК     жёсткая склейка в окне растворения (−0,6…+0,9 с от границы отрезка с переходом): перебивка или окошко обрывается раньше растворения,
           и на миг виден кадр под ними (владелец 15.11, 24:21) — перекрытие должно входить в переход
  ВОЗВРАТ  статичная камера, лицо растёт к камере ≥ 2 раза за 1–6 с — человек идёт к камере (вернулся за штативом?)
  ЛИЦО     чужое резкое лицо крупнее 5% высоты кадра (не автор, не размыто)
  РАЗМЫТ   размытое пятно на месте лица автора (резкость лица автора ниже порога) — проверить глазами
  ПУСТО    ≥ 2 с камера смотрит в землю/асфальт: людей и лиц нет, неба < половины верха, серого ≥ 30 % кадра;
           на отрезке-разговоре — «речь на пустом кадре» (s3 v18 11:42, 0178: Сергей говорит, в кадре развязка)
  ПРОХОДКА статичная камера, а взятое окно [in, out] беднее людьми, чем лучшее окно той же длины в том же клипе —
           подсказка «лучшее окно a–b с» (s3 v18 11:18, 0175: взят пустой асфальт до нас, мы — на 5–9 и 15–19 с)
  УХОДИТ   статичный план ≥ 4 с с одной фигурой, которая уменьшается (уходит от камеры) — «кадр больше 4 секунд»
  ВРАЗНОБОЙ на статичной камере (и в перебивках) одна фигура растёт, другая уменьшается, или уход и возврат в одном плане —
           в проходке мы идём в одну сторону (владелец 22.11)
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
for b in [x["end"] for x in segs[:-1] if x.get("xfade", 1) > 0]:      # стык с растворением: жёсткой склейки рядом быть не должно
    near = [c for c in cuts if -0.6 < b - c < 0.9]
    if near and not in_teaser(b):
        F.append((near[0], "СТЫК", note_at(near[0]), f"жёсткая склейка ({near[0] - b:+.2f} с) в растворении в {int(b // 60)}:{b % 60:04.1f}"))

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

# ---------------------------------------------------------------- люди в кадре: ПУСТО, ПРОХОДКА, УХОДИТ (владелец 22.11, s3 v18)
NOTE = []
# детектор людей: YOLOX-S (opencv_zoo, cv2.dnn) — --yolox PATH или object_detection_yolox_2022nov.onnx рядом с --faces / в «модели»;
# без него — HOG (теряет мелкие фигуры и людей спиной: s2 22:05 видел людей 3 с из 19)
YP = opt("--yolox") or next((p_ for d_ in ([fdir, os.path.join(os.path.dirname(os.path.abspath(fdir)), "модели")] if fdir else [])
                             for p_ in [os.path.join(d_, "object_detection_yolox_2022nov.onnx")] if os.path.exists(p_)), None)
YOLO = cv2.dnn.readNet(YP) if YP else None
HOG = None
if YOLO is None and hasattr(cv2, "HOGDescriptor"):
    HOG = cv2.HOGDescriptor(); HOG.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    NOTE.append("люди — HOG (нет модели YOLOX): мелкие фигуры и люди спиной теряются, ПУСТО/ПРОХОДКА/УХОДИТ/ВРАЗНОБОЙ — кандидаты")
elif YOLO is None:
    NOTE.append("ПУСТО, ПРОХОДКА, УХОДИТ, ВРАЗНОБОЙ не проверялись: нет модели YOLOX и нет HOG (OpenCV 5)")
_grids = {}
def yolox_people(img, conf=0.35):
    """Высоты людей (доля кадра) по YOLOX-S: letterbox 640, сырые 0–255, декод по сетке шагов 8/16/32, класс 0, NMS."""
    H_, W_ = img.shape[:2]; r_ = min(640 / W_, 640 / H_)
    pad = np.full((640, 640, 3), 114, np.uint8); rs = cv2.resize(img, (int(W_ * r_), int(H_ * r_))); pad[:rs.shape[0], :rs.shape[1]] = rs
    YOLO.setInput(cv2.dnn.blobFromImage(pad, 1.0, (640, 640), swapRB=False)); out = YOLO.forward()[0]
    if "g" not in _grids:
        gs, ss = [], []
        for st in (8, 16, 32):
            n_ = 640 // st; yy, xx = np.meshgrid(np.arange(n_), np.arange(n_), indexing="ij")
            gs.append(np.stack([xx, yy], -1).reshape(-1, 2)); ss.append(np.full((n_ * n_, 1), st))
        _grids["g"], _grids["s"] = np.concatenate(gs), np.concatenate(ss)
    xy = (out[:, :2] + _grids["g"]) * _grids["s"]; wh = np.exp(out[:, 2:4]) * _grids["s"]
    sc = out[:, 4] * out[:, 5]                                   # объект × «человек»
    k = np.where(sc >= conf)[0]
    if not len(k): return []
    boxes = [[float((xy[i, 0] - wh[i, 0] / 2) / r_), float((xy[i, 1] - wh[i, 1] / 2) / r_), float(wh[i, 0] / r_), float(wh[i, 1] / r_)] for i in k]
    keep = cv2.dnn.NMSBoxes(boxes, [float(sc[i]) for i in k], conf, 0.45)
    return [(min(1.0, boxes[i][3] / H_), (boxes[i][0] + boxes[i][2] / 2) / W_, (boxes[i][1] + boxes[i][3] / 2) / H_) for i in np.ravel(keep)]
FD = cv2.FaceDetectorYN.create(os.path.join(fdir, "yunet.onnx"), "", (640, 360), 0.8, 0.3, 5000) if fdir else None
PW, PH = 480, 270                  # 1 к/с, 480×270: HOG на 640×360 по 40 мин фильма — 50 мин; так ~8
def people(img, ref_w=None):
    """Высоты фигур (доля кадра): YOLOX (или HOG) по силуэтам + лица YuNet (лицо ×5 — рост), чтобы говорящий крупно тоже считался."""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); H_, W_ = g.shape
    if YOLO is not None:
        hs = yolox_people(img)
    else:
        rects, wts = HOG.detectMultiScale(g, winStride=(8, 8), padding=(8, 8), scale=1.08)
        hs = [(r[3] / H_, (r[0] + r[2] / 2) / W_, (r[1] + r[3] / 2) / H_) for r, w_ in zip(rects, np.ravel(wts) if len(rects) else []) if w_ > 0.5]
    if FD is not None and not (YOLO is not None and hs):    # лицо — запасной признак человека, когда силуэтов нет
        FD.setInputSize((W_, H_)); _, ff = FD.detect(img)
        hs += [(min(1.0, float(r[3]) / H_ * 5), (float(r[0]) + float(r[2]) / 2) / W_, (float(r[1]) + float(r[3]) / 2) / H_) for r in ([] if ff is None else ff)]
    return [list(map(float, x)) for x in hs]
def ground(img):
    """Доля серого (асфальт, земля) и неба в верхней трети."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); s_, v_ = hsv[..., 1], hsv[..., 2]
    grey = float(((s_ < 40) & (v_ > 40) & (v_ < 225)).mean())
    top = hsv[: PH // 3]; sky = float(((top[..., 2] > 150) & ((top[..., 1] < 50) | ((top[..., 0] > 90) & (top[..., 0] < 130)))).mean())
    return grey, sky
def frames(path, a=None, b=None, rate=1, size=None):
    w_, h_ = size or (PW, PH)
    cmd = ["ffmpeg", "-v", "error"] + (["-ss", f"{a:.3f}", "-t", f"{b - a:.3f}"] if a is not None else []) + ["-i", path, "-vf", f"fps={rate},scale={w_}:{h_}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    p_ = subprocess.Popen(cmd, stdout=subprocess.PIPE, stdin=subprocess.DEVNULL); k_ = 0
    while True:
        buf = p_.stdout.read(w_ * h_ * 3)
        if len(buf) < w_ * h_ * 3: break
        yield (a or 0.0) + k_ / rate, np.frombuffer(buf, np.uint8).reshape(h_, w_, 3); k_ += 1
    p_.wait()
if YOLO is not None or HOG is not None:
    # речь на отрезке — по словам исходника (как audit_mix), если дан --words-root
    talk_rows = set()
    wr, alias = opt("--words-root"), (json.load(open(opt("--alias"))) if opt("--alias") else {})
    if wr:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import unicodedata, auto_level as AL
        widx = {}
        for dp, _, fs in os.walk(wr):
            for f_ in fs:
                if f_.endswith(".words.json") and not f_.startswith("._"): widx[unicodedata.normalize("NFC", f_[:-11])] = os.path.join(dp, f_)
        for j, s in enumerate(segs):
            p_, off = s["src"], 0.0
            if p_ in alias: p_, off = alias[p_][0], float(alias[p_][1])
            wf = widx.get(unicodedata.normalize("NFC", os.path.splitext(os.path.basename(p_))[0]))
            if not wf: continue
            nw = sum(1 for x in AL.real_words(wf) if s["in"] + off <= x["start"] < s["out"] + off and len(re.sub(r"[^\w]", "", x["word"])) > 1)
            if AL.is_talk(nw, s["end"] - s["start"]): talk_rows.add(j)
    # проход по фильму 2 к/с: люди, земля, сдвиг камеры
    fc_p = os.path.splitext(film)[0] + f"_кадры_люди2_{'yolox' if YOLO is not None else 'hog'}_{os.path.getsize(film)}.json"   # кеш прохода по фильму (тот же файл — тот же размер)
    if os.path.exists(fc_p): S_ = [tuple(x) for x in json.load(open(fc_p))]
    else:
        S_ = []; prev = None
        for t, img in frames(film):
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
            sh = 0.0 if prev is None else sum(abs(x) for x in cv2.phaseCorrelate(prev, g)[0])
            S_.append((t, people(img), *ground(img), sh)); prev = g
        json.dump(S_, open(fc_p, "w"))
    row_at = lambda t: next((j for j, s in enumerate(segs) if s["start"] <= t < s["end"]), None)
    # окошко рассказчика (pip слева внизу, x 0,03–0,30, y 0,67–0,94) на рассказах — не «человек в кадре» (s2 22:05: 17–20 % всё время)
    # окошко узнаём по месту и неподвижности: фигура в зоне окошка, которая ±0,02 стоит на месте 3+ кадра подряд
    pipz = lambda p_: p_[1] < 0.32 and p_[2] > 0.62
    still = set()
    for i_ in range(len(S_)):
        for p_ in S_[i_][1]:
            if pipz(p_) and all(any(pipz(q) and abs(q[1] - p_[1]) < 0.02 and abs(q[2] - p_[2]) < 0.02 for q in S_[k_][1])
                                for k_ in range(max(0, i_ - 1), min(len(S_), i_ + 2))):
                still.add(i_)
    S_ = [(x[0], [p_ for p_ in x[1] if not (i_ in still and pipz(p_))]) + tuple(x[2:]) for i_, x in enumerate(S_)]
    H = lambda hs: [p_[0] for p_ in hs]                 # высоты фигур
    VIEW = re.compile(r"дрон|вид|море|солнц|рассвет|закат|карта|утёс|утес|поле|поля|ветряк|панорам|сверху|интро|ранее", re.I)
    DRONE = lambda f_: bool(re.fullmatch(r"DJI_\d{4}\.MP4", os.path.basename((alias.get(f_) or [f_])[0]), re.I))
    covered = lambda j, t: any(o["at_film"] <= t < o["at_film"] + o["dur"] for o in segs[j].get("broll", []))
    # ПУСТО
    run = []
    for t, hs, grey, sky, sh in S_ + [(1e9, [1], 0, 1, 0)]:
        j = row_at(t)
        empty = (j is not None and not hs and sky < 0.5 and grey >= 0.3 and not in_teaser(t) and not covered(j, t)   # перебивка — выбор
                 and not VIEW.search(segs[j]["note"]))                                                        # виды — не «в землю»
        if empty and run and row_at(run[0]) == j: run.append(t); continue
        if len(run) >= 2:
            j0 = row_at(run[0]); sp = j0 in talk_rows
            F.append((run[0], "ПУСТО", segs[j0]["note"], f"{run[-1] - run[0] + 1.0:.1f} с людей нет, камера в землю/асфальт" + (" — речь на пустом кадре" if sp else "")))
        run = [t] if empty else []
    # ВРАЗНОБОЙ — на каждом видимом плане (главный план между перебивками и каждая перебивка, «память» тоже): в проходке
    # мы идём в одну сторону (владелец 22.11). Находка: одна фигура растёт, другая уменьшается; или в одном плане уход и возврат
    # (наибольшая фигура уменьшается, потом растёт) — s2 v12a 22:05, память ← 0150 5–24 с: Юля уходит, Сергей идёт обратно
    vis = []
    for j, s in enumerate(segs):
        br = sorted(s.get("broll", []), key=lambda o: o["at_film"]); cur = s["start"]
        for o in br:
            if o["at_film"] - cur >= 4: vis.append((cur, o["at_film"], j, s["note"]))
            vis.append((o["at_film"], o["at_film"] + o["dur"], j, s["note"] + " / перебивка")); cur = max(cur, o["at_film"] + o["dur"])
        if s["end"] - cur >= 4: vis.append((cur, s["end"], j, s["note"]))
    for v0, v1, j, n_ in vis:
        if v1 - v0 < 4 or in_teaser(v0): continue
        smp = [x for x in S_ if v0 + 0.3 <= x[0] < v1 - 0.3]
        if len(smp) < 4 or np.median([x[4] for x in smp[1:]]) > 10: continue
        hmax = [max(H(x[1])) if x[1] else 0.0 for x in smp]
        q = max(1, len(smp) // 3)
        two0 = [sorted(H(x[1])) for x in smp[:q] if len(x[1]) >= 2]; two1 = [sorted(H(x[1])) for x in smp[-q:] if len(x[1]) >= 2]
        why = None
        if two0 and two1:
            big0, big1 = np.mean([t[-1] for t in two0]), np.mean([t[-1] for t in two1])
            sm0, sm1 = np.mean([t[0] for t in two0]), np.mean([t[0] for t in two1])
            if (big1 >= 1.3 * big0 and sm1 <= 0.7 * sm0) or (big1 <= 0.7 * big0 and sm1 >= 1.3 * sm0):
                why = f"одна фигура растёт, другая уменьшается ({sm0:.0%}→{sm1:.0%}, {big0:.0%}→{big1:.0%})"
        if why is None:                                    # по фигурам: ведём по положению (x) между кадрами
            trs = []
            for x in smp:
                used = set()
                for p_ in x[1]:
                    best = min((tr for tr in trs if id(tr) not in used and x[0] - tr[-1][0] <= 2.5 and abs(tr[-1][2] - p_[1]) < 0.12),
                               key=lambda tr: abs(tr[-1][2] - p_[1]), default=None)
                    if best is None: best = []; trs.append(best)
                    best.append((x[0], p_[0], p_[1])); used.add(id(best))
            trs = [tr for tr in trs if len(tr) >= 4 and max(h for _, h, _ in tr) >= 0.08]
            def turn(tr):                                 # минимум не в конце, потом рост ≥ 1,25 за ≥ 2 кадра
                hs_ = [h for _, h, _ in tr]; k_ = int(np.argmin(hs_))
                return k_ <= len(hs_) - 3 and hs_[-1] >= 1.25 * hs_[k_] and hs_[0] >= 1.25 * hs_[k_]
            shrink = lambda tr: tr[-1][1] <= 0.8 * tr[0][1] and tr[-1][1] <= min(h for _, h, _ in tr) * 1.1
            back = [tr for tr in trs if turn(tr)]; away = [tr for tr in trs if shrink(tr)]
            if back and away and any(a_[-1][0] >= b_[-3][0] for a_ in away for b_ in back):
                b_ = back[0]; hs_ = [h for _, h, _ in b_]
                why = f"одна фигура разворачивается к камере ({hs_[0]:.0%} → {min(hs_):.0%} → {hs_[-1]:.0%}), другая уходит дальше"
            if why is None:                               # расхождение в окне 3 кадров: одна монотонно растёт, другая уменьшается
                at_t = [{round(t_, 1): h for t_, h, _ in tr} for tr in trs if max(h for _, h, _ in tr) >= 0.15]   # мельче — шум детектора
                for t0 in sorted({round(x[0], 1) for x in smp}):
                    ts_ = [round(t0 + d_, 1) for d_ in (0, 1, 2)]
                    grow = [m for m in at_t if all(t_ in m for t_ in ts_) and m[ts_[0]] < m[ts_[1]] < m[ts_[2]] and m[ts_[2]] >= 1.12 * m[ts_[0]]]
                    fall = [m for m in at_t if all(t_ in m for t_ in ts_) and m[ts_[0]] > m[ts_[1]] > m[ts_[2]] and m[ts_[2]] <= 0.9 * m[ts_[0]]]
                    if grow and fall:
                        g_, f_ = grow[0], fall[0]
                        why = (f"с {t0 - v0:.0f}-й с одна фигура идёт к камере ({g_[ts_[0]]:.0%} → {g_[ts_[2]]:.0%}), "
                               f"другая от неё ({f_[ts_[0]]:.0%} → {f_[ts_[2]]:.0%})"); break
        if why is None and max(hmax) > 0 and not DRONE(segs[j]["src"]) and "дрон" not in n_:
            for k in range(2, len(hmax) - 3):                 # провал: ≥ 2 кадра подряд мельче, до и после — ≥ 2 кадров с крупной фигурой
                pre, post = hmax[:k], hmax[k + 2:]; low = max(hmax[k], hmax[k + 1])
                big_pre = [h for h in pre if h >= max(0.15, 1.6 * max(low, 0.05))]; big_post = [h for h in post if h >= max(0.15, 1.6 * max(low, 0.05))]
                if len(big_pre) >= 2 and len(big_post) >= 2 and low > 0:   # 0 — детектор потерял фигуру, а не она ушла
                    why = f"уход и возврат в одном плане ({max(big_pre):.0%} → {low:.0%} → {max(big_post):.0%} высоты)"; break
        if why:
            F.append((v0, "ВРАЗНОБОЙ", n_, f"{v1 - v0:.1f} с: {why} — в проходке идём в одну сторону; взять окно одного направления"))
    # ПРОХОДКА и УХОДИТ — по отрезкам со статичной камерой (без перебивок поверх главного плана)
    cache_p = (os.path.splitext(out)[0] if out else os.path.splitext(film)[0]) + f"_люди2_640_{'yolox' if YOLO is not None else 'hog'}.json"
    cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
    score = lambda hs: float(sum(p_[0] for p_ in hs))
    for j, s in enumerate(segs):
        dur = s["end"] - s["start"]
        smp = [x for x in S_ if s["start"] + 0.3 <= x[0] < s["end"] - 0.3 and not covered(j, x[0])]
        if dur < 2 or len(smp) < 3 or in_teaser(s["start"]) or "карта" in s["note"]: continue
        if np.median([x[4] for x in smp[1:]]) > 10: continue            # камера идёт (ходьба — 60–140 пикс. за 1 с при 480; с рук стоя — до ~8)
        # УХОДИТ: одна фигура уменьшается или уходит из кадра (C3936/C3937: Юля одна уходит, план 7–8 с)
        two = sum(1 for x in smp if len(x[1]) >= 2)
        if dur >= 4 and j not in talk_rows and any(x[1] for x in smp[:max(1, len(smp) // 3)]) and two <= 0.2 * len(smp):   # говорящий в кадре движется — не «уходит»
            q = max(1, len(smp) // 3)
            h0 = np.mean([max(H(x[1])) for x in smp[:q] if x[1]] or [0]); h1 = np.mean([max(H(x[1])) if x[1] else 0 for x in smp[-q:]])
            if h0 > 0 and h1 <= 0.7 * h0:
                F.append((s["start"], "УХОДИТ", s["note"], f"статичный план {dur:.1f} с: фигура уходит ({h0:.0%} → {h1:.0%} высоты)"))
        # ПРОХОДКА: лучшее окно той же длины в клипе (не дрон и не рассказ: там кадр — перебивки и окошко)
        src = s["src"]
        if not os.path.exists(src) or DRONE(src) or "рассказ" in s["note"]: continue
        key = os.path.abspath(src)
        if key not in cache:
            cache[key] = [(round(t, 2), round(score(people(img, 640)), 3)) for t, img in frames(src, rate=2, size=(640, 360))]
            json.dump(cache, open(cache_p, "w"))
        cs = cache[key]; L = s["out"] - s["in"]
        if not cs or cs[-1][0] - L < 1.0: continue                      # клип не длиннее взятого куска — выбирать не из чего
        mean_in = lambda a0: float(np.mean([v for t, v in cs if a0 <= t < a0 + L] or [0]))
        taken = mean_in(s["in"])
        best_a = max((t for t, _ in cs if t + L <= cs[-1][0] + 0.5), key=mean_in, default=None)
        if best_a is None: continue
        best = mean_in(best_a)
        if best >= 0.25 and taken <= 0.5 * best and abs(best_a - s["in"]) >= 1.0:
            F.append((s["start"], "ПРОХОДКА", s["note"], f"людей в кадре {taken:.2f} против {best:.2f} — лучшее окно {best_a:.1f}–{best_a + L:.1f} с исходника {os.path.basename(src)}"))

F.sort()
tc = lambda x: f"{int(x // 60)}:{x % 60:04.1f}"
# распознавание лиц на черновике 360p путает авторов с чужими — к ЛИЦО/ВОЗВРАТ/ВСПЫШКА лист кадров для проверки глазами
pick = [f for f in F if f[1] in ("ЛИЦО", "ВОЗВРАТ", "ВСПЫШКА", "СТЫК", "ПУСТО", "ПРОХОДКА", "УХОДИТ", "ВРАЗНОБОЙ")]
if out and pick:
    tiles = []
    for t0, k, n, _ in pick:
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0 + 0.3:.2f}", "-i", film, "-frames:v", "1", "-vf", "scale=480:270", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
        if len(r.stdout) < 480 * 270 * 3: continue
        im = np.frombuffer(r.stdout[:480 * 270 * 3], np.uint8).reshape(270, 480, 3).copy()
        cv2.putText(im, f"{tc(t0)} {k}", (6, 22), 0, 0.6, (0, 255, 255), 2); tiles.append(im)
    rows = [np.hstack(tiles[i:i + 4] + [np.zeros((270, 480, 3), np.uint8)] * (4 - len(tiles[i:i + 4]))) for i in range(0, len(tiles), 4)]
    cv2.imwrite(os.path.splitext(out)[0] + "_кадры.jpg", np.vstack(rows))
lines = [f"# Проверка глазами: {os.path.basename(film)}, находок {len(F)}", ""] + [f"> {x}" for x in NOTE] + ([""] if NOTE else [])
for kk in ["ВСПЫШКА", "МЕЛЬК", "СТЫК", "ВОЗВРАТ", "ЛИЦО", "РАЗМЫТ", "ПУСТО", "ПРОХОДКА", "УХОДИТ", "ВРАЗНОБОЙ"]:
    rows = [f for f in F if f[1] == kk]
    lines += [f"## {kk} — {len(rows)}"] + ([f"- {tc(t)} «{n[:44]}»: {x}" for t, _, n, x in rows] or ["- нет"]) + [""]
txt = "\n".join(lines)
if out: open(out, "w").write(txt)
print(txt)
