#!/usr/bin/env python3
"""Рендер фильма по плану (тот же план, из которого make_wfp строит проект Filmora).

render_plan.py <plan.json> <out.mp4> [--workdir DIR] [--only i,j,...] [--size 3840x2160] [--hw [60M]] [--crf N] [--prune]
               [--words-root DIR] [--alias alias.json]   — для "music": {"auto_level": true}: речь по словам расшифровки
  без --size — черновик 640x360 для рецензента; --size 3840x2160 --hw — финал аппаратным кодером Mac.
Каждый отрезок главной дорожки рендерится отдельно (перебивки и титры поверх по времени): картинка и звук —
отдельные куски с отдельными ключами, поэтому правка громкости или музыки не перекодирует картинку. Кеш общий на
серию и размер (<папка фильма>/sN_<H>p_parts, серия — из имени плана); блоки склейки тоже кешируются. Неиспользованные
файлы кеша старше 14 дней удаляются, --prune — все неиспользованные. Потом музыка и озвучка, дорожки для проверки на слух.
Покраска: ключ "grade" у отрезка или перебивки (его пишет grade.py) — цепочка фильтров после масштабирования,
до полей «contain», чтобы поля оставались чёрными. Без ключа картинка идёт как есть.
Заглушённые планом отрезки (gain_db <= -40) идут без звука. Таймкод склейки = таймкод проекта Filmora.
Чужие смонтированные ролики (FOREIGN: /Собраны/, /НАШИ ФОТКИ/, metravel-film-work; копии — через --alias или alias*.json
рядом с планом) по умолчанию без звука: там чужая озвучка и музыка. Свой звук — только ключом отрезка "own_audio": true.
Рядом с фильмом: <out>.segments.json (таймкоды отрезков), <out>_без_музыки.mov, _музыка.wav, _голос.wav."""
import glob as _glob_mod, json, os, re, subprocess, sys

plan = json.load(open(sys.argv[1])); out = sys.argv[2]
a = sys.argv[3:]
wd = a[a.index("--workdir") + 1] if "--workdir" in a else os.path.splitext(out)[0] + "_parts"
only = set(int(x) for x in a[a.index("--only") + 1].split(",")) if "--only" in a else None
W, H, FPS = 640, 360, 30
if "--size" in a:                      # полное качество: --size 1920x1080 (кадры перерендерятся в своей папке)
    W, H = (int(x) for x in a[a.index("--size") + 1].split("x"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_gate                       # больше 640x360 — только по допуску рецензента, 4K — по слову владельца
film_gate.require(sys.argv[1], W, H)
import fcntl                           # один рендер на машину: параллельные сессии ждут, а не делят CPU и диск
_lockp = os.path.expanduser("~/.cache/metravel-film-render.lock"); os.makedirs(os.path.dirname(_lockp), exist_ok=True)
_lock = open(_lockp, "w")
try:
    fcntl.flock(_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    print("жду: идёт другой рендер (render_plan.py), один рендер на машину", flush=True)
    fcntl.flock(_lock, fcntl.LOCK_EX)
SERIES = film_gate.plan_series(sys.argv[1])
if "--workdir" not in a and SERIES:    # общий кеш серии и размера: версии плана берут готовые куски друг друга
    wd = os.path.join(os.path.dirname(os.path.abspath(out)), f"{SERIES}_{H}p_parts")
os.makedirs(wd, exist_ok=True)
CRF = a[a.index("--crf") + 1] if "--crf" in a else ("28" if W <= 640 else "18")
PRESET = "veryfast" if W <= 640 else "fast"
# --hw: аппаратный кодер Mac (4K за часы, а не сутки); 60 Мбит/с для 4K — с запасом для YouTube
_hwb = a[a.index("--hw") + 1] if "--hw" in a and a.index("--hw") + 1 < len(a) and a[a.index("--hw") + 1].endswith("M") else "60M"
VENC = (["-c:v", "h264_videotoolbox", "-b:v", _hwb, "-pix_fmt", "yuv420p", "-tag:v", "avc1"]
        if "--hw" in a else ["-c:v", "libx264", "-preset", PRESET, "-crf", CRF, "-pix_fmt", "yuv420p"])
# Куски и склейка кодируются одним VENC (два поколения сжатия). Сознательно: ProRes-куски 4K на 40 мин — ~200 ГБ на T7,
# а второе поколение h264 60 Мбит/с на глаз не видно. Без потерь — только если хватит места: --crf 0 без --hw.
VENC += ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"]   # YouTube читает метки цвета
G = lambda o: ("," + o["grade"]) if o.get("grade") else ""
# перекрытие, продлённое в запас перехода: нехватку исходника в начале/конце закрывает повтор крайнего кадра
# один tpad на оба края: два tpad подряд теряют начальный повтор (ffmpeg 8), кусок короче на запас — растворение обрывается
TP = lambda pre, post: "" if pre <= 0.001 and post <= 0.001 else (",setpts=PTS-STARTPTS,tpad=" + ":".join(
    ([f"start_duration={pre:.3f}:start_mode=clone"] if pre > 0.001 else []) + ([f"stop_duration={post + 0.1:.3f}:stop_mode=clone"] if post > 0.001 else [])))
# растворение перекрытия по альфе (время — от начала самого перекрытия)
AF = lambda fi, fo, d: ("" if not (fi or fo) else ",format=yuva420p" + (f",fade=t=in:st=0:d={fi:.3f}:alpha=1" if fi else "")
                        + (f",fade=t=out:st={max(0.0, d - fo):.3f}:d={fo:.3f}:alpha=1" if fo else ""))
import hashlib as _h   # лук .cube меняется без смены пути — его содержимое входит в ключ кеша кусков
LOOKSUM = _h.md5(open(plan["grade"]["look"], "rb").read()).hexdigest()[:8] if (plan.get("grade") or {}).get("look") and os.path.exists(plan["grade"]["look"]) else ""


def has_audio(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", p],
                       capture_output=True, text=True)
    return bool(r.stdout.strip())


def fit(label_in, label_out, mode):
    if mode == "contain":
        return (f"[{label_in}]scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1[{label_out}]")
    return f"[{label_in}]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[{label_out}]"


# переходы как в проекте Filmora: на стыке с xd_out > 0 — растворение картинки и логарифмическое затухание звука 1 с,
# по 0,5 с запаса исходника с каждой стороны (длина фильма не меняется: центр перехода = склейка)
HND = 0.5
_sd = {}
def src_dur(p):
    if p not in _sd:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True)
        _sd[p] = float(r.stdout.strip() or 0)
    return _sd[p]
SEG = plan["segments"]
def joined(i):   # стык после отрезка i с переходом
    return i + 1 < len(SEG) and float(SEG[i].get("xd_out") or 0) > 0
# все входные файлы на месте — до рендера, а не на 55-м куске через полчаса (v16: не дорендерены копии «памяти»)
_miss = sorted({p_ for s_ in SEG for p_ in [plan["sources"][s_["src"]]] + [o["file"] for o in s_.get("broll", []) + s_.get("cards", [])]
                if not os.path.exists(p_)})
if _miss:
    print("ОШИБКА: нет входных файлов (" + str(len(_miss)) + "):"); [print("  " + x) for x in _miss[:20]]
    print("  копии «памяти», вертикальные и размытые дорендерить: memory_grade.py / vertical_render.py / faces.py"); sys.exit(1)
# чужой звук: дикторская озвучка «Тропы ведьм» звучала в s7 v2 («наши пути») — глушим по умолчанию, свой звук — "own_audio": true
FOREIGN = re.compile(r"/Собраны/|/НАШИ ФОТКИ/|metravel-film-work", re.I)
_fal = {}
for _f in ([sys.argv[sys.argv.index("--alias") + 1]] if "--alias" in sys.argv else
           sorted(_glob_mod.glob(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), "alias*.json")))):
    _fal.update(json.load(open(_f)))
def foreign(p):
    return bool(FOREIGN.search(p) or FOREIGN.search((_fal.get(p) or [p])[0]))
for s_ in SEG:
    if foreign(plan["sources"][s_["src"]]) and not s_.get("own_audio") and (s_.get("gain_db", 0) or 0) > -40:
        s_["gain_db"] = -60; print("чужой звук заглушён:", s_.get("note", "")[:60])
# Кеш кусков: картинка и звук отрезка — отдельные файлы с отдельными ключами. Правка громкости, затуханий
# или музыки не перекодирует картинку; блоки склейки тоже кешируются по ключам своих кусков и стыков.
import hashlib, glob as _glob, time as _time
AUDIO_KEYS = {"note", "loud_gain", "gain_db", "fade_in", "fade_out", "audio_cut_out", "audio_in_hard", "afilter", "audio_src", "own_audio"}
VSIG = f"{W}x{H}@{FPS}|{' '.join(VENC)}"
KEY = lambda obj: hashlib.md5(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
USED, FRESH_V, FRESH_A = set(), set(), set()   # FRESH_*: куски, записанные этой сборкой, — их блоки собираются заново
def _legacy_split(h, vf, af):
    """Кусок прежнего формата (картинка+звук в одном .mov, ключ по всему отрезку) с тем же содержимым и размером —
    разложить копированием потоков, без перекодирования: первая сборка после обновления не идёт с нуля."""
    dirs = [wd] + sorted(_glob.glob(os.path.join(os.path.dirname(os.path.abspath(out)), f"{SERIES or '__нет__'}_*parts")))
    for d_ in dirs:
        for c in _glob.glob(os.path.join(d_, f"*_{h}.mov")):
            if os.path.basename(c).startswith("._"): continue
            r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height:stream_tags=encoder",
                                "-of", "csv=p=0", c], capture_output=True, text=True)
            # тот же размер и тот же кодер: в старом ключе не было ни --crf, ни --hw, а VSIG нового ключа их обещает
            if not r.stdout.strip().startswith(f"{W},{H},") or not r.stdout.strip().endswith(VENC[1]): continue
            if VENC[1] == "libx264":
                with open(c, "rb") as fh:
                    if f"crf={float(CRF):.1f} ".encode() not in fh.read(1 << 20): continue
            ok = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", c, "-map", "0:v", "-c", "copy", vf + ".part.mov"]).returncode == 0 \
                and subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", c, "-map", "0:a", "-c", "copy", af + ".part.wav"]).returncode == 0
            if ok:
                os.replace(vf + ".part.mov", vf); os.replace(af + ".part.wav", af); return True
    return False

parts, aparts, vkeys, akeys, hand, cores = [], [], [], [], [], []
n_v = n_a = n_legacy = 0
for i, s in enumerate(SEG):
    src = plan["sources"][s["src"]]
    dur = s["out"] - s["in"]
    # запас перехода всегда полный (0,5 с): если исходник кончается на склейке, недостающее доигрывает повтор крайнего кадра —
    # иначе растворение сжимается до пары кадров и выглядит как рывок (v12, 3:05.8: завтрак → шаттл)
    hLa = min(HND, s["in"]) if i > 0 and joined(i - 1) else 0.0
    hRa = min(HND, max(0.0, src_dur(src) - s["out"] - 0.05)) if joined(i) else 0.0
    hL = HND if i > 0 and joined(i - 1) else 0.0
    hR = HND if joined(i) else 0.0
    nfL, nf, nfR = int(round(hL * FPS)), max(1, int(round(dur * FPS))), int(round(hR * FPS))
    hL, hR = nfL / FPS, nfR / FPS
    hand.append((hL, hR)); cores.append(nf / FPS)
    edges = f"{nfL}|{nfR}|edges2{'+3' if hL - hLa > 0.001 and hR - hRa > 0.001 else ''}"
    graded = s.get("grade") or any(o.get("grade") for o in s.get("broll", []))
    vk = KEY([{k: v for k, v in s.items() if k not in AUDIO_KEYS}, src, edges, LOOKSUM if graded else "", VSIG])
    ak = KEY([{k: v for k, v in s.items() if k in AUDIO_KEYS - {"note", "audio_in_hard"} or k in ("src", "in", "out")}, src,
              edges, round(hLa, 3), round(hRa, 3), FPS])
    vf, af = os.path.join(wd, f"v_{vk}.mov"), os.path.join(wd, f"a_{ak}.wav")
    vkeys.append(vk); akeys.append(ak); parts.append(vf); aparts.append(af); USED.update({vf, af})
    force = only is not None and i in only
    if not force and not (os.path.exists(vf) and os.path.exists(af)):
        h_old = hashlib.md5(json.dumps({k: v for k, v in s.items() if k != "note"}, sort_keys=True).encode() + src.encode()
                            + f"{edges}|{LOOKSUM if graded else ''}".encode()).hexdigest()[:8]
        if _legacy_split(h_old, vf, af): n_legacy += 1; FRESH_V.add(i); FRESH_A.add(i)
    a0 = s["in"] - hL; full = (nfL + nf + nfR) / FPS          # a0 — начало куска на шкале исходника (может уйти за начало файла)
    dL, dR = max(0.0, hL - hLa), max(0.0, hR - hRa)              # нехватка исходника слева/справа
    NF = nfL + nf + nfR                           # ровно NF кадров и NF*1600 сэмплов — звук и картинка куска одной длины
    src_in = ["-ss", f"{s['in'] - hLa:.3f}", "-t", f"{full - dL - dR + 0.1:.3f}", "-i", src]
    if force or not os.path.exists(vf):
        inputs = list(src_in)
        fc = [f"[0:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease{G(s)},pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1{TP(dL, dR)}[base0]"]
        cur = "base0"; k = 1
        OV = s.get("broll", []) + s.get("cards", [])
        vids = [o for o in OV if not o["file"].lower().endswith((".png", ".jpg", ".jpeg"))]
        for o in OV:
            t0 = o["at"] - a0; d = min(o["dur"], s["out"] - o["at"])
            if d <= 0 or t0 + d <= hL or t0 >= hL + dur:
                continue
            is_img = o["file"].lower().endswith((".png", ".jpg", ".jpeg"))
            # перекрытие у края отрезка с переходом продлевается в запас перехода: иначе на 0,5 с до растворения
            # мелькает кадр под перебивкой (рассказчик целиком) — «вспышка перед переходом» (владелец 15.11, 24:21)
            eL = hL if o["at"] - s["in"] < 0.1 else 0.0
            eR = hR if s["out"] - (o["at"] + d) < 0.1 else 0.0
            t0 -= eL; d += eL + eR
            # внутри отрезка видео-перекрытие входит и уходит растворением 0,3 с (не обрывом), если встык нет соседнего
            XF = 0.3 if not is_img else 0.0
            # перебивки встык (рецензия v12, «впечатления» 29:59): предыдущая продлевается на XF, следующая проявляется поверх —
            # растворение между ними, без жёсткой склейки и без мелькания кадра под ними
            same = [q for q in vids if q is not o and bool(q.get("pip")) == bool(o.get("pip"))]
            next_adj = any(abs(q["at"] - (o["at"] + o["dur"])) < 0.1 for q in same)
            fin = XF if XF and not eL and o["at"] - s["in"] >= 0.1 else 0.0
            fout = XF if XF and not eR and s["out"] - (o["at"] + min(o["dur"], s["out"] - o["at"])) >= 0.1 and not next_adj else 0.0
            tail = XF if XF and not eR and next_adj and o["at"] + o["dur"] + XF < s["out"] else 0.0
            d += tail; eRp = eR + tail
            if is_img:
                inputs += ["-loop", "1", "-t", f"{d:.3f}", "-i", o["file"]]
            else:
                ss = float(o.get("in", 0)) - eL; pre = max(0.0, -ss)
                inputs += ["-ss", f"{max(0.0, ss):.3f}", "-t", f"{d:.3f}", "-i", o["file"]]
            lab = f"o{k}"
            pos = "0:0"
            if o.get("pip"):
                pw = int(W * float(o["pip"].get("scale", 0.3))) // 2 * 2
                fc.append(f"[{k}:v]fps={FPS},scale={pw}:-2{G(o)},setsar=1,pad=iw+4:ih+4:2:2:white{TP(pre, eRp)}{AF(fin, fout, d)},setpts=PTS-STARTPTS+{max(t0,0):.3f}/TB[{lab}]")
                pos = f"{float(o['pip'].get('x', 0.5)) * W:.0f}-w/2:{float(o['pip'].get('y', 0.5)) * H:.0f}-h/2"
            elif is_img:
                fc.append(f"[{k}:v]scale={W}:{H},format=rgba,setpts=PTS-STARTPTS+{max(t0,0):.3f}/TB[{lab}]")
            else:
                fc.append(f"[{k}:v]fps={FPS},{'scale=%d:%d:force_original_aspect_ratio=decrease%s,pad=%d:%d:(ow-iw)/2:(oh-ih)/2' % (W, H, G(o), W, H) if o.get('fit') == 'contain' else 'scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d%s' % (W, H, W, H, G(o))},setsar=1{TP(pre, eRp)}{AF(fin, fout, d)},setpts=PTS-STARTPTS+{max(t0,0):.3f}/TB[{lab}]")
            fc.append(f"[{cur}][{lab}]overlay={pos}:enable='between(t,{max(t0,0):.3f},{t0 + d:.3f})':eof_action=pass[v{k}]")
            cur = f"v{k}"; k += 1
        fc.append(f"[{cur}]format=yuv420p,trim=end_frame={NF},setpts=PTS-STARTPTS[vout]")
        r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex", ";".join(fc), "-map", "[vout]"] + VENC
                           + [vf + ".part.mov"], stdin=subprocess.DEVNULL, capture_output=True, text=True)   # прерванный рендер не оставляет битый кусок
        if r.returncode != 0:
            print("ОШИБКА картинки", i, s.get("note"), r.stderr[-500:]); sys.exit(1)
        os.replace(vf + ".part.mov", vf); n_v += 1; FRESH_V.add(i)
        print(i, s.get("note", "")[:50], flush=True)
    if force or not os.path.exists(af):
        # PCM: у AAC в каждом куске ~20 мс разгона, на 179 кусках звук уезжал на 4 с
        mute = (s.get("gain_db", 0) or 0) <= -40 or not has_audio(src)
        if mute:
            cmd = ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-t", f"{full + 0.1:.3f}", "-i", "anullsrc=r=48000:cl=stereo",
                   "-af", f"apad,atrim=end_sample={NF * 1600}"]
        else:
            fades = ""
            if s.get("fade_in") and not hL: fades += f",afade=t=in:d={float(s['fade_in']):.3f}"
            if s.get("fade_out") and not hR: fades += f",afade=t=out:st={max(0.0, full - float(s['fade_out'])):.3f}:d={float(s['fade_out']):.3f}"
            if s.get("audio_cut_out"):   # речь продолжается за склейкой: звук гаснет на склейке (не уезжает в запас растворения)
                _d = float(s["audio_cut_out"]); fades += f",afade=t=out:st={max(0.0, (nfL + nf) / FPS - _d):.3f}:d={_d:.3f}"
            dly = f",adelay={int(round(dL * 1000))}:all=1" if dL > 0.001 else ""
            cmd = ["ffmpeg", "-v", "error", "-y"] + src_in + ["-map", "0:a:0", "-af",
                   f"volume={float(s.get('loud_gain', 1.0)):.3f},alimiter=limit=0.89,aresample=48000,aformat=channel_layouts=stereo{dly}{fades},apad,atrim=end_sample={NF * 1600}"]
        r = subprocess.run(cmd + ["-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", "-f", "wav", af + ".part.wav"],
                           stdin=subprocess.DEVNULL, capture_output=True, text=True)
        if r.returncode != 0:
            print("ОШИБКА звука", i, s.get("note"), r.stderr[-500:]); sys.exit(1)
        os.replace(af + ".part.wav", af); n_a += 1; FRESH_A.add(i)
print(f"куски: картинка заново {n_v}, звук заново {n_a}, из прежнего кеша {n_legacy}, всего {len(SEG)}", flush=True)

# склейка: цепочка xfade (картинка) и acrossfade (звук) отдельно; стык без перехода — concat.
# Блоки по ~20 кусков режутся на стыках без перехода и кешируются по ключам кусков и стыков.
base = os.path.splitext(out)[0] + "_без_музыки.mov"
def _joint(i):       # длина перехода перед куском i (0 — встык)
    d = hand[i - 1][1] + hand[i][0]
    return round(d, 4) if d >= 2 / FPS else 0.0
def vchain(idx, outp):
    ins, fc = [], []
    for j, i in enumerate(idx):
        ins += ["-i", os.path.abspath(parts[i])]
        # метки bt709 на кадрах: флаги -color_* кодера не перекрывают «unknown» кадров из исходников без меток (дрон)
        fc.append(f"[{j}:v]settb=AVTB,fps={FPS},format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v{j}]")
    cur = "v0"; L = hand[idx[0]][0] + cores[idx[0]] + hand[idx[0]][1]
    for j in range(1, len(idx)):
        i = idx[j]; d = _joint(i)
        if d:
            fc.append(f"[{cur}][v{j}]xfade=transition=fade:duration={d:.4f}:offset={L - d:.4f}[x{j}]")
        else:
            fc.append(f"[{cur}][v{j}]concat=n=2:v=1:a=0[c{j}];[c{j}]settb=AVTB,fps={FPS}[x{j}]")
        cur = f"x{j}"; L = L - d + hand[i][0] + cores[i] + hand[i][1]
    r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(fc), "-map", f"[{cur}]"] + VENC + [outp + ".part.mov"],
                       stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if r.returncode: print("ОШИБКА склейки картинки", ";".join(fc)[-1500:], r.stderr[-1500:]); sys.exit(1)
    os.replace(outp + ".part.mov", outp)
def achain(idx, outp):
    ins, fc = [], []
    for j, i in enumerate(idx):
        ins += ["-i", os.path.abspath(aparts[i])]
        fc.append(f"[{j}:a]aformat=sample_rates=48000:channel_layouts=stereo[a{j}]")
    cur = "a0"
    for j in range(1, len(idx)):
        i = idx[j]; d = _joint(i)
        if d:   # audio_in_hard: речь входящего отрезка с первого слова на полной громкости
            fc.append(f"[{cur}][a{j}]acrossfade=d={d:.4f}:c1=log:c2={'nofade' if SEG[i].get('audio_in_hard') else 'log'}[y{j}]")
        else:
            fc.append(f"[{cur}][a{j}]concat=n=2:v=0:a=1[y{j}]")
        cur = f"y{j}"
    r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(fc), "-map", f"[{cur}]", "-c:a", "pcm_s16le",
                        "-f", "wav", outp + ".part.wav"], stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if r.returncode: print("ОШИБКА склейки звука", ";".join(fc)[-1500:], r.stderr[-1500:]); sys.exit(1)
    os.replace(outp + ".part.wav", outp)
# блоки режем только на стыках без перехода — тогда блоки встают встык без потерь
cuts = [0] + [i + 1 for i in range(len(SEG) - 1) if not joined(i)] + [len(SEG)]
blocks, cur_ = [], []
for a_, b_ in zip(cuts, cuts[1:]):
    cur_ += list(range(a_, b_))
    if len(cur_) >= 20 or b_ == len(SEG): blocks.append(cur_); cur_ = []
if cur_: blocks.append(cur_)
vb, ab, n_vb = [], [], 0
for n_, idx in enumerate(blocks):
    joints = [_joint(i) for i in idx[1:]]
    vbf = os.path.join(wd, f"vb_{KEY([[vkeys[i] for i in idx], joints, VSIG])}.mov")
    abf = os.path.join(wd, f"ab_{KEY([[akeys[i] for i in idx], joints, [bool(SEG[i].get('audio_in_hard')) for i in idx]])}.wav")
    # кусок переписан этой сборкой (--only, удалённый вручную, из прежнего кеша) — блок с тем же ключом устарел
    if not os.path.exists(vbf) or FRESH_V.intersection(idx): vchain(idx, vbf); n_vb += 1; print("блок", n_, len(idx), flush=True)
    if not os.path.exists(abf) or FRESH_A.intersection(idx): achain(idx, abf)
    vb.append(vbf); ab.append(abf); USED.update({vbf, abf})
print(f"блоки: картинка заново {n_vb} из {len(blocks)}", flush=True)
vlst, alst = os.path.join(wd, "list_v.txt"), os.path.join(wd, "list_a.txt")
open(vlst, "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in vb))
open(alst, "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in ab))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", vlst, "-f", "concat", "-safe", "0", "-i", alst,
                "-map", "0:v", "-map", "1:a", "-c", "copy", base], check=True, stdin=subprocess.DEVNULL)
# чистка кеша: неиспользованные этой сборкой файлы, к которым 14 дней не обращалась ни одна сборка (используемые
# получают свежий mtime — куски соседней версии плана не стареют от возраста), с --prune — все неиспользованные.
# Удаляются только файлы кеша по имени: --workdir может указывать на папку с чужими файлами.
import re as _re
for p_ in USED: os.utime(p_)
_now = _time.time()
_CACHE = _re.compile(r"^(?:(?:v|vb)_[0-9a-f]{12}\.mov|(?:a|ab)_[0-9a-f]{12}\.wav|\d{3}_[0-9a-f]{8}\.mov|block_\d+\.mov)(?:\.part\.(?:mov|wav))?$|^list\.txt$")
for p_ in _glob.glob(os.path.join(wd, "*")):
    if p_ in USED or not _CACHE.match(os.path.basename(p_)) or not os.path.isfile(p_): continue
    if "--prune" in a or _now - os.path.getmtime(p_) > 14 * 86400:
        os.remove(p_)
# музыка и озвучка по plan["music"]["cues"] — те же уровни, что в проекте: трек к -36 LUFS + level_db
pos = []; t = 0.0
# фактическая длина отрезка — cores (округление до кадров копится ~1 с на фильм): музыку ставим по ней
for s, d_ in zip(plan["segments"], cores):
    k_ = d_ / (s["out"] - s["in"])
    pos.append((s["src"], s["in"], s["out"], t, k_)); t += d_
def film(src, tt):
    for sr, a_, b_, p0, k_ in pos:
        if sr == src and a_ - 0.01 <= tt <= b_ + 0.01:
            return p0 + (tt - a_) * k_
    raise SystemExit(f"точка музыки вне плана: {src} {tt}")
import functools
@functools.lru_cache(maxsize=None)   # один трек стоит в нескольких cues — меряем один раз
def lufs(pth):
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", pth, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    m = _re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr); return float(m[-1]) if m else -23.0
cues = (plan.get("music") or {}).get("cues", []) + (plan.get("music") or {}).get("sfx", [])
# стыки треков подложки — как в проекте: «Логарифмическое исчезновение» 2 с по центру стыка (а не затухание в тишину)
isvoice = lambda c: c["file"].lower().endswith(".wav")          # голос за кадром — записи .wav; музыка — mp3 (поднятые куски подложки бывают > 20 дБ)
seq = sorted([dict(c, _a=film(*c["a"]), _b=film(*c["b"])) for c in (plan.get("music") or {}).get("cues", []) if not isvoice(c)], key=lambda c: c["_a"])
for cur, nxt in zip(seq, seq[1:]):
    if -0.2 < nxt["_a"] - cur["_b"] < 0.6:
        cur["_b"] += 1.0; cur["fade_out"] = 2.0
        sh = min(1.0, nxt.get("src_in", 0)); nxt["_a"] -= sh; nxt["src_in"] = nxt.get("src_in", 0) - sh; nxt["fade_in"] = max(sh * 2, 0.2)
cues = seq + [c for c in (plan.get("music") or {}).get("cues", []) if isvoice(c)] + (plan.get("music") or {}).get("sfx", [])
AUTO = bool((plan.get("music") or {}).get("auto_level")) and bool(seq)
_tmp_auto = []
if cues:
    ins = ["-i", base]; fc = []; labs = []
    for j, c in enumerate(cues, 1):
        a_, b_ = (c["_a"], c["_b"]) if "_a" in c else (film(*c["a"]), film(*c["b"])); d = b_ - a_
        g = (-36.0 + c.get("level_db", 0)) - lufs(c["file"])
        if AUTO and any(c is x for x in seq): g = -23.0 - lufs(c["file"])   # автоуровни: трек к −23 LUFS, дальше огибающая
        fo = c.get("fade_out", 3.0)
        ins += ["-ss", str(c.get("src_in", 0)), "-t", f"{d:.3f}", "-i", c["file"]]
        fc.append(f"[{j}:a]aresample=48000,aformat=channel_layouts=stereo,volume={g:.2f}dB,afade=t=in:d={max(c.get('fade_in', 1.5), 0.01)},afade=t=out:st={max(d - fo, 0):.3f}:d={max(fo, 0.01)},adelay={int(a_ * 1000)}|{int(a_ * 1000)}[m{j}]")
        labs.append(f"[m{j}]")
    fc.append(f"[0:a]{''.join(labs)}amix=inputs={len(labs) + 1}:normalize=0:duration=first[a]")   # пики ограничивает encode_master() ниже
    # дорожки для проверки «на слух» (audit_mix.py): музыка и звуки отдельно, голос за кадром отдельно — 24 кГц моно
    def stem(sel, name):
        idx = [j for j, c in enumerate(cues, 1) if sel(c)]
        if not idx: return
        sfc = [fc[j - 1].replace(f"[m{j}]", f"[s{j}]") for j in idx] + ["".join(f"[s{j}]" for j in idx) + f"amix=inputs={len(idx)}:normalize=0,aresample=24000,pan=mono|c0=0.5*c0+0.5*c1[o]"]
        subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(sfc), "-map", "[o]", "-t", f"{t:.3f}", "-c:a", "pcm_s16le",
                        os.path.splitext(out)[0] + name], stdin=subprocess.DEVNULL)
    is_mus = lambda c: not c["file"].lower().endswith(".wav") or "пи" in c.get("name", "")[:3]   # музыка, звуки и «пи»
    voicep = os.path.splitext(out)[0] + "_голос.wav"
    if AUTO and os.path.exists(voicep): os.remove(voicep)   # голос прежней сборки не должен приглушать музыку
    stem(lambda c: c["file"].lower().endswith(".wav") and not c.get("name", "").startswith("пи"), "_голос.wav")
    if not AUTO:
        stem(is_mus, "_музыка.wav")
    else:
        # автоуровни (auto_level.py): музыка под речью на 13 дБ ниже речи, на видах — к уровню речи фильма; поправка трека — auto_adj_db
        import math, auto_level as AL
        WR = a[a.index("--words-root") + 1] if "--words-root" in a else None
        if WR and not os.path.isdir(WR): raise SystemExit(f"ОШИБКА: нет папки расшифровок --words-root {WR}")   # иначе музыка в полную силу под всей речью
        ALIAS = json.load(open(a[a.index("--alias") + 1])) if "--alias" in a else {}
        mus_j = [j for j, c in enumerate(cues, 1) if any(c is x for x in seq)]
        rest_j = [j for j in range(1, len(cues) + 1) if j not in mus_j]
        rawp, ctrlp = os.path.splitext(out)[0] + "_музыка_сырая.wav", os.path.splitext(out)[0] + "_огибающая.wav"
        _tmp_auto += [rawp, ctrlp]
        rfc = [fc[j - 1] for j in mus_j] + ["".join(f"[m{j}]" for j in mus_j) + f"amix=inputs={len(mus_j)}:normalize=0[r]"]
        subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(rfc), "-map", "[r]", "-t", f"{t:.3f}",
                        "-c:a", "pcm_f32le", rawp], check=True, stdin=subprocess.DEVNULL)   # float: поднятые пики не режутся до огибающей
        n_w = int(math.ceil(t / AL.WIN))
        R_m, R_b, R_v = AL.rms_windows(rawp, half_sum=True), AL.rms_windows(base), AL.rms_windows(voicep)
        segi = [(plan["sources"][s_["src"]], s_["in"], s_["out"], p_[3], p_[4], (s_.get("gain_db", 0) or 0) <= -40) for s_, p_ in zip(SEG, pos)]
        if WR:
            speech = AL.live_speech(segi, WR, ALIAS)
            if not speech: print("автоуровни: в расшифровках --words-root не нашлось слов отрезков — живая речь не приглушает музыку", flush=True)
        else:                                # без расшифровок — по энергии живого звука в незаглушённых отрезках (грубее)
            print("автоуровни: нет --words-root — речь по энергии, виды с громким ветром приглушат музыку", flush=True)
            loud = [(i * AL.WIN, (i + 1) * AL.WIN) for i in range(n_w) if i < len(R_b) and R_b[i] > -32
                    and not any(m_ and t0_ <= i * AL.WIN < t0_ + (b_ - a_) * k_ for _, a_, b_, t0_, k_, m_ in segi)]
            speech = AL.merge(loud)
        adj = [(c["_a"], c["_b"], float(c["auto_adj_db"])) for c in seq if c.get("auto_adj_db")]
        gains, ref = AL.envelope(n_w, R_m, R_b, R_v, speech, adj)
        AL.write_ctrl(gains, ctrlp)
        K = len(cues) + 1
        mus_chain = [f"[{K}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[mr]",
                     f"[{K + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,pan=stereo|c0=c0|c1=c0[cg]",
                     "[mr][cg]amultiply[mus]"]
        ins = ins + ["-i", rawp, "-i", ctrlp]
        extra_j = [j for j in rest_j if is_mus(cues[j - 1])]   # звуки и «пи» — в стем музыки, как без автоуровней
        sfc = mus_chain + [fc[j - 1] for j in extra_j] + ["[mus]" + "".join(f"[m{j}]" for j in extra_j)
               + f"amix=inputs={len(extra_j) + 1}:normalize=0,aresample=24000,pan=mono|c0=0.5*c0+0.5*c1[o]"]
        subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(sfc), "-map", "[o]", "-t", f"{t:.3f}", "-c:a", "pcm_s16le",
                        os.path.splitext(out)[0] + "_музыка.wav"], check=True, stdin=subprocess.DEVNULL)
        fc = [fc[j - 1] for j in rest_j] + mus_chain + [f"[0:a]{''.join(f'[m{j}]' for j in rest_j)}[mus]amix=inputs={len(rest_j) + 2}:normalize=0:duration=first[a]"]
        _tm = [False] * n_w
        for s0, s1 in speech:
            for i_ in range(max(0, int(math.ceil(s0 / AL.WIN - 1e-9))), min(n_w, int(math.ceil(s1 / AL.WIN - 1e-9)))): _tm[i_] = True
        talk_g = sorted(g_ for g_, m_ in zip(gains, _tm) if m_)
        print(f"автоуровни: речь фильма {ref:.1f} дБ, фраз {len(speech)}, музыка под речью в среднем "
              f"{(talk_g[len(talk_g) // 2] if talk_g else 0):+.1f} дБ к −23 LUFS", flush=True)
# сведённый звук — сначала без потерь: пики ограничиваются до AAC, а не перекодированием AAC → AAC
mixp = os.path.splitext(out)[0] + "_микс.wav"
if cues:
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(fc), "-map", "[a]", "-t", f"{t:.3f}",
                    "-c:a", "pcm_f32le", mixp], check=True, stdin=subprocess.DEVNULL)   # float: сумма выше 0 dBFS не срезается до ограничителя
else:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", base, "-map", "0:a", "-c:a", "pcm_f32le", mixp], check=True, stdin=subprocess.DEVNULL)
for p_ in _tmp_auto:                          # сырая музыка (float) и огибающая — временные (≈0,9 ГБ на 40 мин)
    if os.path.exists(p_): os.remove(p_)
def true_peak(pth):
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", pth, "-vn", "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    m = _re.findall(r"Peak:\s+(-?inf|-?[\d.]+) dBFS", r.stderr); return float(m[-1]) if m else None   # тишина → -inf
# истинный пик ≤ −1 dBTP в ГОТОВОМ файле: ограничитель с 4-кратной передискретизацией видит межсэмпловые пики,
# AAC добавляет свой выброс — поэтому мерим итоговый файл и при промахе кодируем из того же WAV с потолком ниже.
# Громкость остальной речи не трогаем: режутся только пики (общий volume вниз топил весь фильм до −16 LUFS).
def encode_master(ceil_db):
    lim = max(0.0625, 10 ** (ceil_db / 20))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", base, "-i", mixp, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", f"aresample=192000,alimiter=limit={lim:.4f}:level=false:latency=1,aresample=48000",
                    "-c:a", "aac", "-b:a", "160k" if W <= 640 else "320k", "-map_chapters", "-1", "-movflags", "+faststart", out],
                   check=True, stdin=subprocess.DEVNULL)
    return true_peak(out)
TP_TARGET, TP_SLACK = -1.0, 0.8              # пик готового файла −1.8…−1.0 dBTP: ниже — зря тише (s3 v16: −3.8 после шага −2.7 дБ)
ceil, ok, bad = -2.0, None, None              # ok — потолок, давший пик в пределах; bad — давший выше цели
for attempt in range(6):
    tp = encode_master(ceil); enc = ceil
    print(f"звук: потолок {ceil:.1f} dBFS → истинный пик готового файла {tp} dBTP", flush=True)
    if tp is not None and tp <= TP_TARGET:
        ok = (ceil, tp)
        if tp >= TP_TARGET - TP_SLACK or bad is None or bad - ceil < 0.3: break
        ceil = round((ceil + bad) / 2, 2)      # перестраховались: вверх, к последнему промаху
    else:
        bad = ceil
        ceil = round((ceil + ok[0]) / 2, 2) if ok else ceil - ((tp - TP_TARGET if tp is not None else 1.0) + 0.3)
if ok and ok[0] != enc:                        # последняя попытка — промах: вернуть лучшую годную
    tp = encode_master(ok[0]); print(f"звук: потолок {ok[0]:.1f} dBFS → истинный пик {tp} dBTP (лучший годный)", flush=True)
TP_FAIL = tp is None or tp > TP_TARGET
os.remove(mixp)
# таблица таймкодов отрезков — по фактическим (до кадра) длинам кусков, как собран фильм: аудиты берут кадры по ней
t = 0.0; rows = []
for i, s in enumerate(plan["segments"]):
    d = cores[i]; k_ = d / max(s["out"] - s["in"], 1e-6)
    rows.append({"i": i, "start": round(t, 3), "end": round(t + d, 3), "note": s.get("note", ""), "xfade": round(hand[i][1] + (hand[i + 1][0] if i + 1 < len(hand) else 0), 3), "src": plan["sources"][s["src"]],
                 "in": s["in"], "out": s["out"], "broll": [{"at_film": round(t + (o["at"] - s["in"]) * k_, 3), "dur": o["dur"], "file": o["file"], "in": o.get("in", 0)} for o in s.get("broll", [])]})
    t += d
json.dump(rows, open(os.path.splitext(out)[0] + ".segments.json", "w"), ensure_ascii=False, indent=1)
print("готово", out, f"{t/60:.1f} мин")
if TP_FAIL:                            # успех не объявляется по промаху: файл есть, но код возврата ненулевой
    raise SystemExit(f"ОШИБКА: истинный пик {tp} dBTP выше {TP_TARGET} после 4 попыток — смотри выброс в плане")
