#!/usr/bin/env python3
"""Номера машин: копия куска с размытыми номерами (людей не задевает) и подстановка копий через карту размытия серии.
Обобщено из GR21 v20/номера.py, номер_рамка.py, номера_s3.py сборщика серии 3 (22.11) — с их граблями.

uv run --with "opencv-python-headless<5" --with numpy python plates.py copy <файл> <от> <до> <копия.mp4> [--yolox M.onnx]
                                                                    [--box x0,y0,x1,y1,с,по …]
uv run … plates.py jobs <задания.json> --dir <папка filmora> --series sN [--only ключ,…]

copy  — <файл>: то, что сейчас стоит в плане (исходник или копия с размытыми лицами); <от>/<до> — секунды в нём.
        Кадр 1920×1080: YOLOX-S → машины (шире 4 %) и люди. Номер — строка ≥ 4 знаков одной высоты в ряд (MSER, тёмные на светлом
        и наоборот) внутри машины, рамка строки расширяется до таблички. По дорожке машины (IoU ≥ 0,3, пропуск до 5 кадров) номер
        переносится на кадры, где знаки не нашлись; крупная машина (шире 7 %) или машина у края кадра без номера на всей дорожке — полоса 30–97 % высоты
        (не полоса бампера: на высоких машинах номер на двери багажника — Tucson, s3). Минус люди (рамка ужата на 8 %), рамки ±3 кадра.
        --box — ручная полоса в долях кадра на отрезке секунд копии (детектор не видит машину).
        Сборка: maskedmerge с сильно размытой копией, 10 бит, HEVC 100 Мбит/с, звук AAC 320k. Окно — trim по меткам времени
        (при -ss копия уезжала на 2 кадра); кадры копии и маски — setpts=N на обоих входах (framesync по меткам дублировал и терял
        кадры); число кадров копии сверяется с детекцией (±1), иначе ошибка.
jobs  — список копий серии: {"ключ": {"orig": исходник (ключ карты), "base": файл-основа или null (= orig), "a": от, "b": до | null
        (= конец файла), "shift": сдвиг основы относительно исходника, "boxes": ["x0,y0,x1,y1,с,по", …], "note": "что за машины"}}.
        Окно копии покрывает кусок плана целиком (подстановка меняет только кусок внутри окна). Пишет размытие/номера/<sN>_<ключ>_номера.mp4,
        размытие/карта_ручная_<sN>.json (поверх render2: прежние окна того же исходника вне нашего сохраняются) и alias_<sN>.json.
Подстановку в план делает gr21_serial.blur_substitute(): ручные записи «/размытие/номера/» идут мимо исключений лиц, якоря музыки
куска переносятся на копию. Тяжёлое задание: берёт общий замок heavy_lock."""
import json, os, subprocess, sys, unicodedata
import cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import heavy_lock

VEH = {2, 3, 5, 7}
_mser = cv2.MSER_create(delta=3, min_area=8, max_area=4000)


# ---------------------------------------------------------------- номер внутри рамки машины (без отдельной модели)
def _lines(g):
    regs, boxes = _mser.detectRegions(g)
    ch = []
    for x, y, w, h in boxes:
        if h < 5 or h > 0.25 * g.shape[0] or not (1.1 <= h / max(w, 1) <= 5.5): continue
        ch.append((x, y, w, h))
    ch = sorted(set(ch), key=lambda b: b[0])
    groups = []
    for b in ch:                                        # жадно: знак к строке с той же высотой и линией и малым шагом
        for gr in groups:
            x, y, w, h = gr[-1]
            if abs(b[3] - h) <= 0.25 * h and abs((b[1] + b[3] / 2) - (y + h / 2)) <= 0.3 * h and 0 <= b[0] - (x + w) <= 1.2 * h \
                    and b[0] > x + 0.5 * w:
                gr.append(b); break
        else:
            groups.append([b])
    out = []
    for gr in groups:
        if len(gr) < 3: continue
        x0 = min(b[0] for b in gr); y0 = min(b[1] for b in gr); x1 = max(b[0] + b[2] for b in gr); y1 = max(b[1] + b[3] for b in gr)
        if (x1 - x0) / max(1, y1 - y0) < 2.0: continue
        out.append((len(gr), (x0, y0, x1 - x0, y1 - y0)))
    return out


def _blobs(roi):
    """Табличка целиком: светлый малонасыщенный прямоугольник 2,2–7 к 1 с вертикальными перепадами знаков (мелкий номер, где
    MSER сливает знаки в одно пятно: Peugeot 208 у шато, s3 v20). → [(вес, (x, y, w, h))] в пикселях roi."""
    g = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY); hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV); k = max(3, roi.shape[1] // 40) | 1
    bh = cv2.morphologyEx(g, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (k * 3, k)))
    sx = np.abs(cv2.Sobel(bh, cv2.CV_32F, 1, 0, ksize=3)); sx = (255 * sx / (sx.max() + 1e-6)).astype(np.uint8)
    cl = cv2.morphologyEx(cv2.GaussianBlur(sx, (5, 5), 0), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k * 3, max(3, k // 2))))
    _, th = cv2.threshold(cl, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    th = cv2.dilate(cv2.erode(th, None, iterations=1), None, iterations=2)
    out = []
    for c in cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]:
        a, b, cw, ch = cv2.boundingRect(c)
        if cw < 10 or ch < 4 or not (2.2 <= cw / ch <= 7.0 and 0.07 * roi.shape[1] <= cw <= 0.5 * roi.shape[1]): continue
        if float(hsv[b:b + ch, a:a + cw, 2].mean()) < 80 or float(hsv[b:b + ch, a:a + cw, 1].mean()) > 120: continue
        d = float((sx[b:b + ch, a:a + cw] > 60).mean())
        if d >= 0.15: out.append((d * cw * ch, (a, b, cw, ch)))
    return out


def plate_boxes(img, car):
    """Где номер внутри машины: [(x, y, w, h)] в пикселях кадра. Рамка машины растягивается до ширины ≥ 480 px (мелкие знаки — 3–5 px);
    строка знаков (центр на 35–97 % высоты машины) расширяется до таблички (≥ 7 высот знака и ×2,6 строки, ×2,8 по высоте);
    строка шире 60 % машины — надпись/решётка."""
    H, W = img.shape[:2]; x, y, w, h = [int(round(v)) for v in car]
    x0, y0 = max(0, x), max(0, y + int(0.15 * h)); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 - x0 < 24 or y1 - y0 < 12: return []
    roi = img[y0:y1, x0:x1]; s = max(1.0, 480 / (x1 - x0))
    g = cv2.cvtColor(cv2.resize(roi, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC), cv2.COLOR_BGR2GRAY)
    g = cv2.createCLAHE(2.0, (8, 8)).apply(g)
    res = []
    for n, (a, b, cw, chh) in sorted(_lines(g) + _lines(255 - g), reverse=True)[:4]:
        if cw > 0.6 * g.shape[1]: continue
        cx, cy = a + cw / 2, b + chh / 2
        ry = (y0 + cy / s - y) / max(1, h); rx = (x0 + cx / s - x) / max(1, w)
        if not (0.35 <= ry <= 0.97 and 0.04 <= rx <= 0.96): continue   # строка на стекле/крыше/решётке выше — не номер (s3 v20: Peugeot 3008, 208)
        # найдена часть номера (4 из 7 знаков — T-Roc «…34-ZZ» открыт): табличка ≥ 7 высот знака и ×2,6 строки, не шире 60 % машины
        pw = min(max(cw * 2.6, chh * 7.0), 0.6 * g.shape[1]); ph = chh * 2.8
        res.append((int(x0 + (cx - pw / 2) / s), int(y0 + (cy - ph / 2) / s), int(pw / s), int(ph / s)))
    if not res:                                              # знаки не нашлись — табличка целиком (тот же фильтр положения)
        for _, (a, b, cw, chh) in sorted(_blobs(cv2.resize(roi, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)), reverse=True)[:2]:
            cx, cy = a + cw / 2, b + chh / 2
            ry = (y0 + cy / s - y) / max(1, h); rx = (x0 + cx / s - x) / max(1, w)
            if not (0.35 <= ry <= 0.97 and 0.04 <= rx <= 0.96): continue
            pw, ph = cw * 1.4, chh * 1.8
            res.append((int(x0 + (cx - pw / 2) / s), int(y0 + (cy - ph / 2) / s), int(pw / s), int(ph / s)))
    return res[:2]


# ---------------------------------------------------------------- YOLOX-S: машины и люди
class Det:
    def __init__(self, yp, W=960, H=540):
        self.net = cv2.dnn.readNet(yp); self.W, self.H = W, H
        gs, ss = [], []
        for st in (8, 16, 32):
            n = 640 // st; yy, xx = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
            gs.append(np.stack([xx, yy], -1).reshape(-1, 2)); ss.append(np.full((n * n, 1), st))
        self.G, self.SS = np.concatenate(gs), np.concatenate(ss)

    def __call__(self, img, conf=0.35):
        H_, W_ = img.shape[:2]; r = min(640 / W_, 640 / H_); pad = np.full((640, 640, 3), 114, np.uint8)
        rs = cv2.resize(img, (int(W_ * r), int(H_ * r))); pad[:rs.shape[0], :rs.shape[1]] = rs
        self.net.setInput(cv2.dnn.blobFromImage(pad, 1.0, (640, 640), swapRB=False)); o = self.net.forward()[0]
        xy = (o[:, :2] + self.G) * self.SS; wh = np.exp(o[:, 2:4]) * self.SS
        cls = np.argmax(o[:, 5:], 1); sc = o[:, 4] * o[np.arange(len(o)), 5 + cls]
        k = [i for i in np.where(sc >= conf)[0] if cls[i] in VEH or cls[i] == 0]
        if not k: return [], []
        bx = [[float((xy[i, 0] - wh[i, 0] / 2) / r), float((xy[i, 1] - wh[i, 1] / 2) / r), float(wh[i, 0] / r), float(wh[i, 1] / r)] for i in k]
        keep = np.ravel(cv2.dnn.NMSBoxes(bx, [float(sc[i]) for i in k], conf, 0.45))
        cars = [bx[j] for j in keep if cls[k[j]] in VEH and bx[j][2] / W_ >= 0.04]
        ppl = [bx[j] for j in keep if cls[k[j]] == 0]
        return cars, ppl


def yolox_path(start):
    d = os.path.abspath(start)
    for _ in range(5):                                       # модели/ в папке или выше (размытие/номера → filmora/модели)
        for c in (os.path.join(d, "модели"), os.path.join(d, "filmora", "модели")):
            p = os.path.join(c, "object_detection_yolox_2022nov.onnx")
            if os.path.exists(p): return p
        d = os.path.dirname(d)
    raise SystemExit("нет модели YOLOX: --yolox <object_detection_yolox_2022nov.onnx>")


# ---------------------------------------------------------------- копия с размытыми номерами
def copy(src, a, b, out, yp, boxes=()):
    MAN = [[float(t) for t in s.split(",")] for s in boxes]
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                    "stream=codec_name,width,height,r_frame_rate,pix_fmt,color_primaries,color_transfer,color_space",
                                    "-of", "json", src], capture_output=True, text=True).stdout)["streams"][0]
    num, den = (int(x) for x in pr["r_frame_rate"].split("/")); fps = num / den
    hw = "422" not in pr["pix_fmt"] and pr["codec_name"] in ("hevc", "h264")   # 4:2:2 (ZV-E1) аппаратный декодер портит — программно
    HW = ["-hwaccel", "videotoolbox"] if hw else []
    det = Det(yp); DW, DH = 1920, 1080; W, H = 960, 540; SX = W / DW
    TRIM = f"trim=start={a:.4f}:end={b:.4f},setpts=PTS-STARTPTS"      # по меткам времени, не -ss: при -ss копия ушла на 2 кадра (s3, 0167)
    p = subprocess.Popen(["ffmpeg", "-v", "error"] + HW + ["-i", src, "-vf", f"{TRIM},scale={DW}:{DH}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                         stdout=subprocess.PIPE, stdin=subprocess.DEVNULL)
    CARS, PPL, PL = [], [], []
    while True:
        buf = p.stdout.read(DW * DH * 3)
        if len(buf) < DW * DH * 3: break
        img = np.frombuffer(buf, np.uint8).reshape(DH, DW, 3)
        c, pp = det(img); CARS.append(c); PPL.append(pp)
        k_ = len(CARS) - 1                                   # знаки — на каждом 3-м кадре и у машин шире 5 % (дорожка переносит рамку)
        PL.append([plate_boxes(img, x) if (k_ % 3 == 0 and x[2] >= 0.05 * DW) else [] for x in c])
    p.wait()
    N = len(CARS); exp = round((b - a) * fps)

    def iou(p_, q):
        x0, y0 = max(p_[0], q[0]), max(p_[1], q[1]); x1, y1 = min(p_[0] + p_[2], q[0] + q[2]), min(p_[1] + p_[3], q[1] + q[3])
        i_ = max(0, x1 - x0) * max(0, y1 - y0); return i_ / (p_[2] * p_[3] + q[2] * q[3] - i_ + 1e-6)
    tracks = []                                              # дорожки машин: номер с любого кадра дорожки — на все её кадры
    for i in range(N):
        for j, c in enumerate(CARS[i]):
            best = max((t_ for t_ in tracks if 0 < i - t_[-1][0] <= 5), key=lambda t_: iou(CARS[t_[-1][0]][t_[-1][1]], c), default=None)
            if best is not None and iou(CARS[best[-1][0]][best[-1][1]], c) >= 0.3: best.append((i, j))
            else: tracks.append([(i, j)])
    RECT = [[] for _ in range(N)]; found = fall = 0
    for t_ in tracks:
        rel = []
        for i, j in t_:
            x, y, w, h = CARS[i][j]
            for px, py, pw, ph in PL[i][j]: rel.append(((px - x) / w, (py - y) / h, pw / w, ph / h))
        wmax = max(CARS[i][j][2] for i, j in t_)
        for i, j in t_:
            x, y, w, h = CARS[i][j]
            if PL[i][j]:
                RECT[i] += [(px - 0.15 * pw, py - 0.2 * ph, pw * 1.3, ph * 1.4) for px, py, pw, ph in PL[i][j]]; found += 1
            elif rel:
                r_ = np.median(np.array(rel), 0); RECT[i].append((x + (r_[0] - 0.1 * r_[2]) * w, y + (r_[1] - 0.15 * r_[3]) * h, r_[2] * 1.2 * w, r_[3] * 1.3 * h)); found += 1
            elif wmax >= 0.07 * DW or ((x <= 2 or x + w >= DW - 2) and w >= 0.04 * DW):   # 7 %: передний номер под углом (Peugeot 3008, Ford — s3 v20) знаками не ловится
                # крупная машина, номер ни разу не найден — запасная полоса 30–97 %; машина у края кадра — тоже
                # (обрезанный номер «CP 511…» — меньше 4 знаков в строке, s3 v20 парковка 18:37)
                RECT[i].append((x + 0.03 * w, y + 0.30 * h, 0.94 * w, 0.67 * h)); fall += 1
    print(f"кадров {N} (ожидалось ≈{exp}), с машинами {sum(1 for c in CARS if c)}, дорожек {len(tracks)}, "
          f"номер по знакам/дорожке {found}, запасная полоса {fall}", flush=True)
    D = 3; m_path = os.path.splitext(out)[0] + "_маска.mkv"   # маска: рамки ±3 кадра, минус люди (рамка ужата на 8 %)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", pr["r_frame_rate"],
                            "-i", "-", "-c:v", "ffv1", m_path], stdin=subprocess.PIPE)
    covered = 0
    for i in range(N):
        m = np.zeros((H, W), np.uint8)
        for j in range(max(0, i - D), min(N, i + D + 1)):
            for x, y, w, h in RECT[j]:
                m[max(0, int(y * SX)):max(0, int((y + h) * SX)), max(0, int(x * SX)):max(0, int((x + w) * SX))] = 255
        t = i / fps
        for x0, y0, x1, y1, ta, tb in MAN:
            if ta <= t <= tb: m[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 255
        for x, y, w, h in PPL[i]:
            x, y, w, h = x * SX, y * SX, w * SX, h * SX
            m[int(y + 0.08 * h):int(y + 0.92 * h), int(x + 0.08 * w):int(x + 0.92 * w)] = 0
        covered += bool(m.any())
        enc.stdin.write(m.tobytes())
    enc.stdin.close(); enc.wait()
    FW, FH = pr["width"], pr["height"]
    TB = f"settb={den}/{num},setpts=N"                       # кадр копии i ↔ кадр маски i (framesync по меткам дублировал и терял кадры)
    fc = (f"[0:v]{TRIM},{TB},format=yuv420p10le,split[a][b];[0:a:0]atrim=start={a:.4f}:end={b:.4f},asetpts=PTS-STARTPTS[au];"
          f"[b]scale={FW // 6}:-2,gblur=sigma=9,scale={FW}:{FH}[bl];"
          f"[1:v]{TB},scale={FW}:{FH},format=gray10le,gblur=sigma=8,split=3[m0][m1][m2];[m1]scale={FW // 2}:{FH // 2}[m1s];"
          f"[m2]scale={FW // 2}:{FH // 2}[m2s];[m0][m1s][m2s]mergeplanes=0x001020:yuv420p10le[mk];[a][bl][mk]maskedmerge[v]")
    col = []
    for k, f in (("color_primaries", "-color_primaries"), ("color_transfer", "-color_trc"), ("color_space", "-colorspace")):
        if pr.get(k) and pr[k] != "unknown": col += [f, pr[k]]
    has_a = bool(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", src],
                                capture_output=True, text=True).stdout.strip())
    if not has_a: fc = fc.replace(f";[0:a:0]atrim=start={a:.4f}:end={b:.4f},asetpts=PTS-STARTPTS[au]", "")   # фото-копии без звука
    cmd = (["ffmpeg", "-v", "error", "-y"] + HW + ["-i", src, "-i", m_path, "-filter_complex", fc, "-map", "[v]"]
           + (["-map", "[au]"] if has_a else []) + ["-c:v", "hevc_videotoolbox", "-profile:v", "main10", "-b:v", "100M", "-tag:v", "hvc1",
                                                     "-r", pr["r_frame_rate"]] + col + (["-c:a", "aac", "-b:a", "320k"] if has_a else []) + [out + ".part.mp4"])
    subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL)
    nf = int(subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets",
                             "-of", "csv=p=0", out + ".part.mp4"], capture_output=True, text=True).stdout.strip() or 0)
    os.remove(m_path)
    print(f"копия {os.path.basename(out)}: кадров {nf} (детекция {N}), размыто кадров {covered}; декодер {'аппаратный' if hw else 'программный'}")
    if abs(nf - N) > 1:
        raise SystemExit(f"число кадров копии ({nf}) не сходится с детекцией ({N}) — копия не записана")
    os.replace(out + ".part.mp4", out)


# ---------------------------------------------------------------- список копий серии → карта и alias
def jobs(path, film_dir, series, only=None, yp=None):
    NF = lambda x: unicodedata.normalize("NFC", x)
    J = json.load(open(path)); R = os.path.join(film_dir, "размытие"); os.makedirs(os.path.join(R, "номера"), exist_ok=True)
    manp = os.path.join(R, f"карта_ручная_{series}.json"); MAN = json.load(open(manp)) if os.path.exists(manp) else {}
    autop = os.path.join(R, f"карта_{series}.json"); AUTO = json.load(open(autop)) if os.path.exists(autop) else {}
    # авто-копии render2 исходника из исключений лиц (автор размыт) в ручную карту не переносим: ручные идут мимо исключений,
    # и снятая копия вернулась бы в фильм (s2 v23: 0172 «силуэт автора» 269–342 с попал в план через окно номеров 346–410 с)
    exf = os.path.join(R, f"исключения_{series}.json"); EX = json.load(open(exf)) if os.path.exists(exf) else {}
    EX = [NF(k) for k, v in EX.items() if not isinstance(v, dict)]
    AUTO = {k: v for k, v in AUTO.items() if not any(e in NF(os.path.basename(k)) for e in EX)}
    alp = os.path.join(film_dir, f"alias_{series}.json"); AL = json.load(open(alp)) if os.path.exists(alp) else {}
    yp = yp or yolox_path(film_dir)
    for k, j in J.items():
        orig = j["orig"]; base = j.get("base") or orig; a = float(j.get("a", 0.0)); sh = float(j.get("shift", 0.0))
        if not os.path.exists(base): raise SystemExit(f"{k}: нет файла {base}")
        orig = next((x for x in list(MAN) + list(AUTO) if NF(x) == NF(orig)), orig)   # «Вёль» на диске — NFD, в коде — NFC
        for old in [x for x in MAN if NF(x) == NF(orig) and x != orig]: MAN.pop(old)
        b = j.get("b")
        if b is None:
            b = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", base],
                                     capture_output=True, text=True).stdout.strip())
        tag = f"{series}_{k}_номера"; out = os.path.join(R, "номера", tag + ".mp4")
        if (only is None or k in only) and not os.path.exists(out):
            print(f"{k}: {os.path.basename(base)} {a:.2f}–{b:.2f} — {j.get('note', '')}", flush=True)
            copy(base, a, float(b), out, yp, j.get("boxes", ()))
        if not os.path.exists(out): continue
        lo, hi = a + sh, float(b) + sh                       # окно в секундах исходника
        prev = MAN.get(orig, AUTO.get(orig, []))
        keep = [e for e in prev if (e[1] <= lo or e[0] >= hi) and not os.path.basename(e[2]).startswith(tag)]
        MAN[orig] = sorted(keep + [[round(lo, 3), round(hi, 3), out]])
        AL[out] = [orig, round(lo, 3)]
    json.dump(MAN, open(manp, "w"), ensure_ascii=False, indent=1)
    json.dump(AL, open(alp, "w"), ensure_ascii=False, indent=1)
    print("карта номеров:", manp, "—", len(MAN), "исходников")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2 or a[0] not in ("copy", "jobs"): print(__doc__); sys.exit(2)
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    heavy_lock.acquire(f"plates {a[0]} {os.path.basename(a[1])}", wait="--no-wait" not in a)
    if a[0] == "copy":
        boxes = a[a.index("--box") + 1:] if "--box" in a else []
        boxes = [x for x in boxes if not x.startswith("--")]
        copy(a[1], float(a[2]), float(a[3]), a[4], opt("--yolox") or yolox_path(os.path.dirname(os.path.abspath(a[4]))), boxes)
    else:
        only = set(opt("--only").split(",")) if "--only" in a else None
        jobs(a[1], opt("--dir"), opt("--series"), only, opt("--yolox"))
