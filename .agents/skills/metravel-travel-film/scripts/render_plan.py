#!/usr/bin/env python3
"""Рендер фильма по плану (тот же план, из которого make_wfp строит проект Filmora).

render_plan.py <plan.json> <out.mp4> [--workdir DIR] [--only i,j,...] [--size 3840x2160] [--hw [60M]] [--crf N]
  без --size — черновик 640x360 для рецензента; --size 3840x2160 --hw — финал аппаратным кодером Mac.
Каждый отрезок главной дорожки рендерится отдельно (перебивки и титры поверх по времени), куски кешируются
по содержимому отрезка; потом склейка с переходами, музыка и озвучка, дорожки для проверки на слух.
Покраска: ключ "grade" у отрезка или перебивки (его пишет grade.py) — цепочка фильтров после масштабирования,
до полей «contain», чтобы поля оставались чёрными. Без ключа картинка идёт как есть.
Заглушённые планом отрезки (gain_db <= -40) идут без звука. Таймкод склейки = таймкод проекта Filmora.
Рядом с фильмом: <out>.segments.json (таймкоды отрезков), <out>_без_музыки.mov, _музыка.wav, _голос.wav."""
import json, os, subprocess, sys

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
parts, hand, cores = [], [], []
for i, s in enumerate(SEG):
    import hashlib
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
    h = hashlib.md5(json.dumps({k: v for k, v in s.items() if k != "note"}, sort_keys=True).encode() + src.encode() + f"{nfL}|{nfR}|edges2{'+3' if hL - hLa > 0.001 and hR - hRa > 0.001 else ''}|{LOOKSUM if (s.get('grade') or any(o.get('grade') for o in s.get('broll', []))) else ''}".encode()).hexdigest()[:8]
    f = os.path.join(wd, f"{i:03d}_{h}.mov")   # PCM: у AAC в каждом куске ~20 мс разгона, на 179 кусках звук уезжал на 4 с
    if not os.path.exists(f):   # кусок с тем же содержимым под другим номером (сцены переставлены) — взять его, а не рендерить заново
        _old = [x for x in os.listdir(wd) if x.endswith(f"_{h}.mov") and not x.startswith("._")] if os.path.isdir(wd) else []
        if _old: os.rename(os.path.join(wd, _old[0]), f)
    parts.append(f)
    if only is not None and i not in only and os.path.exists(f):
        continue
    if os.path.exists(f) and only is None:
        continue
    a0 = s["in"] - hL; full = (nfL + nf + nfR) / FPS          # a0 — начало куска на шкале исходника (может уйти за начало файла)
    dL, dR = max(0.0, hL - hLa), max(0.0, hR - hRa)              # нехватка исходника слева/справа
    inputs = ["-ss", f"{s['in'] - hLa:.3f}", "-t", f"{full - dL - dR + 0.1:.3f}", "-i", src]
    fc = [f"[0:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease{G(s)},pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1{TP(dL, dR)}[base0]"]
    cur = "base0"; k = 1
    OV = s.get("broll", []) + s.get("cards", [])
    vids = [o for o in OV if not o["file"].lower().endswith((".png", ".jpg", ".jpeg"))]
    def neighbour(o, x):     # другое видео-перекрытие того же слоя (окошко/полный кадр) начинается или кончается в точке x
        return any(q is not o and bool(q.get("pip")) == bool(o.get("pip")) and
                   (abs(q["at"] - x) < 0.1 or abs(q["at"] + q["dur"] - x) < 0.1) for q in vids)
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
    NF = nfL + nf + nfR                           # ровно NF кадров и NF*1600 сэмплов — звук и картинка куска одной длины
    fc.append(f"[{cur}]format=yuv420p,trim=end_frame={NF},setpts=PTS-STARTPTS[vout]")
    mute = (s.get("gain_db", 0) or 0) <= -40 or not has_audio(src)
    cmd = ["ffmpeg", "-v", "error", "-y"] + inputs
    if mute:
        cmd += ["-f", "lavfi", "-t", f"{full:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        fc.append(f"[{k}:a]apad,atrim=end_sample={NF * 1600}[aout]")
    else:
        fades = ""
        if s.get("fade_in") and not hL: fades += f",afade=t=in:d={float(s['fade_in']):.3f}"
        if s.get("fade_out") and not hR: fades += f",afade=t=out:st={max(0.0, full - float(s['fade_out'])):.3f}:d={float(s['fade_out']):.3f}"
        if s.get("audio_cut_out"):   # речь продолжается за склейкой: звук гаснет на склейке (не уезжает в запас растворения)
            _d = float(s["audio_cut_out"]); fades += f",afade=t=out:st={max(0.0, (nfL + nf) / FPS - _d):.3f}:d={_d:.3f}"
        dly = f",adelay={int(round(dL * 1000))}:all=1" if dL > 0.001 else ""
        fc.append(f"[0:a:0]volume={float(s.get('loud_gain', 1.0)):.3f},alimiter=limit=0.89,aresample=48000,aformat=channel_layouts=stereo{dly}{fades},apad,atrim=end_sample={NF * 1600}[aout]")
    cmd += ["-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
            ] + VENC + ["-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", f + ".part.mov"]   # прерванный рендер не оставляет битый кусок под готовым именем
    r = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if r.returncode != 0:
        print("ОШИБКА", i, s.get("note"), r.stderr[-500:]); sys.exit(1)
    os.replace(f + ".part.mov", f)
    print(i, s.get("note", "")[:50], flush=True)

# склейка: цепочка xfade/acrossfade (стык без перехода — concat); рендер блоками по 20 кусков, потом блоки встык
base = os.path.splitext(out)[0] + "_без_музыки.mov"
def chain(idx, outp):
    ins, fc = [], []
    for j, i in enumerate(idx):
        ins += ["-i", os.path.abspath(parts[i])]
        # метки bt709 на кадрах: флаги -color_* кодера не перекрывают «unknown» кадров из исходников без меток (дрон)
        fc.append(f"[{j}:v]settb=AVTB,fps={FPS},format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v{j}];"
                  f"[{j}:a]aformat=sample_rates=48000:channel_layouts=stereo[a{j}]")
    vcur, acur = "v0", "a0"; L = hand[idx[0]][0] + cores[idx[0]] + hand[idx[0]][1]
    for j in range(1, len(idx)):
        i = idx[j]; d = hand[i - 1][1] + hand[i][0]
        if d >= 2 / FPS:
            off = L - d
            fc.append(f"[{vcur}][v{j}]xfade=transition=fade:duration={d:.4f}:offset={off:.4f}[x{j}]")
            fc.append(f"[{acur}][a{j}]acrossfade=d={d:.4f}:c1=log:c2={'nofade' if SEG[i].get('audio_in_hard') else 'log'}[y{j}]")   # audio_in_hard: речь входящего отрезка с первого слова на полной громкости
        else:
            fc.append(f"[{vcur}][{acur}][v{j}][a{j}]concat=n=2:v=1:a=1[c{j}][y{j}];[c{j}]settb=AVTB,fps={FPS}[x{j}]"); d = 0.0
        vcur, acur = f"x{j}", f"y{j}"
        L = L - d + hand[i][0] + cores[i] + hand[i][1]
    r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(fc), "-map", f"[{vcur}]", "-map", f"[{acur}]",
                        ] + VENC + ["-c:a", "pcm_s16le", outp],
                       stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if r.returncode: print("ОШИБКА склейки", ";".join(fc)[-1500:], r.stderr[-1500:]); sys.exit(1)
# блоки режем только на стыках без перехода — тогда блоки встают встык без потерь
cuts = [0] + [i + 1 for i in range(len(SEG) - 1) if not joined(i)] + [len(SEG)]
blocks, cur_ = [], []
for a_, b_ in zip(cuts, cuts[1:]):
    cur_ += list(range(a_, b_))
    if len(cur_) >= 20 or b_ == len(SEG): blocks.append(cur_); cur_ = []
if cur_: blocks.append(cur_)
bfiles = []
for n_, idx in enumerate(blocks):
    bf = os.path.join(wd, f"block_{n_:02d}.mov"); chain(idx, bf); bfiles.append(bf); print("блок", n_, len(idx), flush=True)
lst = os.path.join(wd, "list.txt")
open(lst, "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in bfiles))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", base], check=True, stdin=subprocess.DEVNULL)
# музыка и озвучка по plan["music"]["cues"] — те же уровни, что в проекте: трек к -36 LUFS + level_db
import re as _re
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
if cues:
    ins = ["-i", base]; fc = []; labs = []
    for j, c in enumerate(cues, 1):
        a_, b_ = (c["_a"], c["_b"]) if "_a" in c else (film(*c["a"]), film(*c["b"])); d = b_ - a_
        g = (-36.0 + c.get("level_db", 0)) - lufs(c["file"])
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
    stem(lambda c: not c["file"].lower().endswith(".wav") or "пи" in c.get("name", "")[:3], "_музыка.wav")
    stem(lambda c: c["file"].lower().endswith(".wav") and not c.get("name", "").startswith("пи"), "_голос.wav")
# сведённый звук — сначала без потерь: пики ограничиваются до AAC, а не перекодированием AAC → AAC
mixp = os.path.splitext(out)[0] + "_микс.wav"
if cues:
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(fc), "-map", "[a]", "-t", f"{t:.3f}",
                    "-c:a", "pcm_s24le", mixp], check=True, stdin=subprocess.DEVNULL)
else:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", base, "-map", "0:a", "-c:a", "pcm_s24le", mixp], check=True, stdin=subprocess.DEVNULL)
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
TP_TARGET = -1.0
ceil = -2.0
for attempt in range(4):
    tp = encode_master(ceil)
    print(f"звук: потолок {ceil:.1f} dBFS → истинный пик готового файла {tp} dBTP", flush=True)
    if tp is not None and tp <= TP_TARGET:
        break
    ceil -= (tp - TP_TARGET if tp is not None else 1.0) + 0.3
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
