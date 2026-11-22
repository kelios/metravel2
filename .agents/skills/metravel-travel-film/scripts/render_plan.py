#!/usr/bin/env python3
"""Рендер фильма по плану (тот же план, из которого make_wfp строит проект Filmora).

render_plan.py <plan.json> <out.mp4> [--workdir DIR] [--only i,j,...] [--size 3840x2160] [--hw [60M]] [--crf N] [--prune]
               [--words-root DIR] [--alias alias.json]   — для "music": {"auto_level": true}: речь по словам расшифровки
               [--jobs N] [--sw] [--no-wait]
  Один рендер на машину (замок ~/.cache/metravel-film-render.lock): второй ждёт и печатает, чей рендер идёт; --no-wait — выход с кодом 75.
  без --size — черновик 640x360 для рецензента; --size 3840x2160 --hw — финал аппаратным кодером Mac.
Каждый отрезок главной дорожки рендерится отдельно (перебивки и титры поверх по времени): картинка и звук —
отдельные куски с отдельными ключами, поэтому правка громкости или музыки не перекодирует картинку. Кеш общий на
серию и размер (<папка фильма>/sN_<H>p_parts, серия — из имени плана). Неиспользованные
файлы кеша старше 14 дней удаляются, --prune — все неиспользованные. Потом музыка и озвучка, дорожки для проверки на слух.
Скорость (замеры 22.11, M1): исходники 4K декодируются аппаратно (--sw — программно, в 5–7 раз медленнее); куски
рендерятся по --jobs штук разом (по умолчанию 3, для кадра больше 1080p — 2); фильм склеивается копированием потока —
кодируются только секундные растворения, поэтому правка одного куска не перекодирует соседние. В конце лог печатает
«время:» по этапам — по нему видно, куда ушла сборка.
Покраска: ключ "grade" у отрезка или перебивки (его пишет grade.py) — цепочка фильтров после масштабирования,
до полей «contain», чтобы поля оставались чёрными. Без ключа картинка идёт как есть.
Заглушённые планом отрезки (gain_db <= -40) идут без звука. Таймкод склейки = таймкод проекта Filmora.
Чужие смонтированные ролики (FOREIGN: /Собраны/, /НАШИ ФОТКИ/, metravel-film-work; копии — через --alias или alias*.json
рядом с планом) по умолчанию без звука: там чужая озвучка и музыка. Свой звук — только ключом отрезка "own_audio": true.
Рядом с фильмом: <out>.segments.json (таймкоды отрезков), <out>_без_музыки.mov, _музыка.wav, _голос.wav."""
import glob as _glob_mod, json, os, re, subprocess, sys, time as _time
_T0 = _time.time(); _TM = []            # замеры этапов сборки: печатаются в конце строкой «время:»
def _mark(name):
    global _T0
    _now = _time.time(); _TM.append((name, _now - _T0)); _T0 = _now

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
# (замер 22.11: два рендера разных серий разом шли в 3–5 раз медленнее каждый). В файле замка — кто рендерит:
# ждущий печатает это; --no-wait — не ждать, а выйти с кодом 75 и тем же сообщением.
_lockp = os.path.expanduser("~/.cache/metravel-film-render.lock"); os.makedirs(os.path.dirname(_lockp), exist_ok=True)
_lock = open(_lockp, "a+")             # не "w": ждущий не должен стирать запись о том, кто рендерит
try:
    fcntl.flock(_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    _lock.seek(0); _who = _lock.read().strip() or "запись пуста"
    print(f"очередь рендеров: уже идёт рендер — {_who}", flush=True)
    if "--no-wait" in a:
        print("--no-wait: выхожу; повторите после него (замок ~/.cache/metravel-film-render.lock)", flush=True); sys.exit(75)
    print("жду его окончания (один рендер на машину; --no-wait — не ждать)", flush=True)
    fcntl.flock(_lock, fcntl.LOCK_EX)
_lock.seek(0); _lock.truncate()
_lock.write(f"{os.path.basename(sys.argv[1])} → {os.path.basename(out)}, {W}x{H}, pid {os.getpid()}, с {_time.strftime('%d.%m %H:%M')}\n"); _lock.flush()
_mark("очередь")
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
# Исходники декодирует аппаратный декодер Mac: 4K HEVC 10 бит программно идёт в 0,5× реального времени и занимал почти
# всё время куска (15 с исходника: 38 с программно, 5,6 с аппаратно), кадры при этом совпадают бит в бит (SSIM 1.0 на всех
# проверенных типах, 22.11). Аппаратно идёт только то, что VideoToolbox декодирует надёжно: HEVC 4:2:0 (8 и 10 бит) и
# H.264 4:2:0 8 бит. H.264 4:2:2 10 бит (ZV-E1) он берёт, но портит и теряет кадры без кода ошибки (C3937, s3: 248 кадров
# из 255) — такие исходники идут программно; если ошибка декодера всё же всплыла, кусок сам пересобирается программно.
HWDEC = ([] if "--sw" in a or "videotoolbox" not in subprocess.run(["ffmpeg", "-hide_banner", "-hwaccels"], capture_output=True, text=True).stdout
         else ["-hwaccel", "videotoolbox"])
_hwk = {}
def hwdec(p):
    if not HWDEC: return []
    if p not in _hwk:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,pix_fmt", "-of", "csv=p=0", p],
                           capture_output=True, text=True)
        c = (r.stdout.strip().split("\n") or [""])[0].strip(",").split(",")
        _hwk[p] = len(c) >= 2 and ((c[0] == "hevc" and c[1] in ("yuv420p", "yuvj420p", "yuv420p10le")) or (c[0] == "h264" and c[1] in ("yuv420p", "yuvj420p")))
    return HWDEC if _hwk[p] else []
HWERR = re.compile(r"hardware accelerator failed|hwaccel init|needs reconfig|videotoolbox_vld|Failed setup for format|vt decoder", re.I)
N_SWRETRY = [0]
JOBS = max(1, int(a[a.index("--jobs") + 1])) if "--jobs" in a else (3 if H <= 1080 else 2)
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
EDGE = 0.04          # жёсткий стык (слова в запасе): переход ±40 мс на самой склейке, запас звука за in/out не звучит
ASIG = "edge2"       # версия сборки звука кусков: смена правила стыка — звук кусков и блоков пересобирается (картинка — нет)
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
# стыки с растворением (edge2, рецензент 22.11): звук из запаса за in/out приносил хвост чужого слова, а короткий переход
# на каждом стыке (edge1) давал скачок фона (прибой → ветер). Поэтому по расшифровкам: в запасе [in−0,5, in] входящего
# или [out, out+0,5] уходящего есть слова — оба куска звучат строго внутри [in, out], переход ±EDGE на склейке («жёсткий»);
# слов нет или расшифровки нет (клип без речи) — прежний log-acrossfade на всё растворение. Без --words-root — жёстко везде.
HARD = {}
_WR = a[a.index("--words-root") + 1] if "--words-root" in a else None
if _WR:
    import unicodedata as _ud, auto_level as _AL
    _widx, _wc = {}, {}
    for _dp, _, _fs in os.walk(_WR):
        for _f in _fs:
            if _f.endswith(".words.json") and not _f.startswith("._"): _widx[_ud.normalize("NFC", _f[:-11])] = os.path.join(_dp, _f)
    def _words_in(p, t0, t1):
        off = 0.0
        if p in _fal: p, off = _fal[p][0], float(_fal[p][1])
        wf = _widx.get(_ud.normalize("NFC", os.path.splitext(os.path.basename(p))[0]))
        if not wf: return False
        if wf not in _wc: _wc[wf] = [x["start"] for x in _AL.real_words(wf)]
        return any(t0 + off <= ws < t1 + off for ws in _wc[wf])
    _live = lambda s_: (s_.get("gain_db", 0) or 0) > -40
    for i_ in range(1, len(SEG)):
        if not joined(i_ - 1): continue
        A_, B_ = SEG[i_ - 1], SEG[i_]
        HARD[i_] = bool((_live(B_) and _words_in(plan["sources"][B_["src"]], B_["in"] - HND, B_["in"]))
                        or (_live(A_) and _words_in(plan["sources"][A_["src"]], A_["out"], A_["out"] + HND)))
    print(f"стыки с растворением: жёстких (слова в запасе) {sum(HARD.values())} из {len(HARD)}", flush=True)
else:
    HARD = {i_: True for i_ in range(1, len(SEG)) if joined(i_ - 1)}
    if HARD: print("стыки: нет --words-root — звук на всех стыках с растворением жёстко (±40 мс), фон может скакнуть", flush=True)
# Кеш кусков: картинка и звук отрезка — отдельные файлы с отдельными ключами. Правка громкости, затуханий
# или музыки не перекодирует картинку. Картинка куска — до трёх файлов (PFMT p3): «начало» и «конец» длиной в переход
# (идут только в растворение) и «середина», которая встаёт в фильм копированием потока, без второго сжатия.
import hashlib, glob as _glob
from concurrent.futures import ThreadPoolExecutor, as_completed
AUDIO_KEYS = {"note", "loud_gain", "gain_db", "fade_in", "fade_out", "audio_cut_out", "audio_in_hard", "afilter", "audio_src", "own_audio"}
VSIG = f"{W}x{H}@{FPS}|{' '.join(VENC)}"
PFMT = "p3"
# метки bt709 на кадрах до кодера: флаги -color_* кодера не перекрывают «unknown» кадров из исходников без меток (дрон)
SETP = "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
KEY = lambda obj: hashlib.md5(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
USED = set()
def stale(target, inputs):
    """Переход, блок звука и кеш звука собираются из кусков. Кусок с тем же ключом могли переписать (--only, новая плашка,
    удалён вручную), в том числе сборкой, упавшей до склейки: зависимый файл старше своего куска — собрать заново.
    Успешная сборка в конце ставит всем файлам кеша одно время, поэтому после неё устаревших нет."""
    if not os.path.exists(target): return True
    mt = os.path.getmtime(target)
    return any(os.path.getmtime(p_) > mt + 2 for p_ in inputs)
EXH = {}                                       # отпечаток параметров потока (SPS/PPS) кусков этой сборки → пример файла
def vprobe(p):
    """(число кадров, отпечаток параметров потока). Склейка копированием требует одинаковых параметров у всех кусков."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames,extradata_hash",
                        "-show_data_hash", "md5", "-of", "json", p], capture_output=True, text=True)
    try:
        st = json.loads(r.stdout)["streams"][0]; return int(st["nb_frames"]), st.get("extradata_hash", "")
    except (ValueError, KeyError, IndexError): return -1, ""
nb_frames = lambda p: vprobe(p)[0]
def run_job(job):
    """Одна команда ffmpeg с выходами во временные файлы; готовые встают на место разом, число кадров сверяется."""
    def attempt(cmd):
        r = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True)
        if r.returncode != 0: return r.stderr[-800:] or "ffmpeg завершился с ошибкой"
        if "-hwaccel" in cmd and HWERR.search(r.stderr): return "сбой аппаратного декодера: " + r.stderr[-300:]
        for tmp, dst, n in job["outs"]:
            if n is None: continue
            fr, xh = vprobe(tmp)
            if fr != n: return f"кадров {fr} вместо {n}: {os.path.basename(dst)}"
            EXH[xh] = dst
        return None
    err = attempt(job["cmd"])
    if err and "-hwaccel" in job["cmd"]:           # аппаратный декодер ошибся или молча потерял кадры — тот же кусок программно
        sw, skip = [], False
        for x in job["cmd"]:
            if skip: skip = False
            elif x == "-hwaccel": skip = True
            else: sw.append(x)
        N_SWRETRY[0] += 1
        err = attempt(sw)
    if err: return job, err
    for tmp, dst, n in job["outs"]: os.replace(tmp, dst)
    return job, None
def run_pool(jobs, what):
    """Задания параллельно (JOBS): декодирование аппаратное, кодер 360p лёгкий — один ffmpeg машину не занимает."""
    if not jobs: return
    with ThreadPoolExecutor(max_workers=JOBS) as ex:
        for fu in as_completed([ex.submit(run_job, j) for j in jobs]):
            job, err = fu.result()
            if err:
                print(f"ОШИБКА {what}", job["label"], err, flush=True)
                ex.shutdown(wait=True, cancel_futures=True); sys.exit(1)   # идущие ffmpeg доработают, новые не стартуют
            if job.get("after"): job["after"]()
            if job.get("say"): print(job["label"], flush=True)

aparts, vkeys, akeys, hand, cores, PV = [], [], [], [], [], []
vjobs, ajobs = [], []
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
    vk = KEY([{k: v for k, v in s.items() if k not in AUDIO_KEYS}, src, edges, LOOKSUM if graded else "", VSIG, PFMT])
    ak = KEY([{k: v for k, v in s.items() if k in AUDIO_KEYS - {"note", "audio_in_hard"} or k in ("src", "in", "out")}, src,
              edges, round(hLa, 3), round(hRa, 3), FPS, ASIG, HARD.get(i, False), HARD.get(i + 1, False)])
    af = os.path.join(wd, f"a_{ak}.wav")
    a0 = s["in"] - hL; full = (nfL + nf + nfR) / FPS          # a0 — начало куска на шкале исходника (может уйти за начало файла)
    dL, dR = max(0.0, hL - hLa), max(0.0, hR - hRa)              # нехватка исходника слева/справа
    NF = nfL + nf + nfR                           # ровно NF кадров и NF*1600 сэмплов — звук и картинка куска одной длины
    # переход — запас уходящего + запас входящего: первые jL и последние jR кадров куска идут в растворение с соседом
    jL, jR = 2 * nfL, 2 * nfR
    if NF - jL - jR >= 1:
        vfs = ([("h", 0, jL)] if jL else []) + [("m", jL, NF - jR)] + ([("t", NF - jR, NF)] if jR else [])
    else:                                         # короткий кусок: переходы перекрываются — целиком уходит в цепочку переходов
        vfs = [("f", 0, NF)]
    vfs = {k_: (os.path.join(wd, f"v{k_}_{vk}.mov"), f0, f1) for k_, f0, f1 in vfs}
    PV.append({"files": {k_: v_[0] for k_, v_ in vfs.items()}, "NF": NF, "jL": jL, "jR": jR, "key": vk})
    vkeys.append(vk); akeys.append(ak); aparts.append(af); USED.update({af} | {v_[0] for v_ in vfs.values()})
    force = only is not None and i in only
    have_v = all(os.path.exists(v_[0]) for v_ in vfs.values())
    src_in = ["-ss", f"{s['in'] - hLa:.3f}", "-t", f"{full - dL - dR + 0.1:.3f}", "-i", src]
    # плашки и картинки по тому же пути, но с новым содержимым (текст справки поправили, имя то же — s6 v2, 22.11):
    # отпечаток содержимого лежит рядом с куском; не совпал — кусок перерисовывается. Ключ кеша не меняется,
    # поэтому старые куски не сбрасываются разом; кусок без отпечатка получает текущий.
    imgs = sorted({o["file"] for o in s.get("broll", []) + s.get("cards", []) if o["file"].lower().endswith((".png", ".jpg", ".jpeg"))})
    isig = KEY([hashlib.md5(open(f_, "rb").read()).hexdigest() if os.path.exists(f_) else "" for f_ in imgs]) if imgs else ""
    sigf = os.path.join(wd, f"v_{vk}.img")
    if isig: USED.add(sigf)
    if isig and have_v and not force:
        try: old_sig = open(sigf).read().strip()
        except OSError: old_sig = None
        if old_sig is None: open(sigf, "w").write(isig)
        elif old_sig != isig:
            print(f"плашка изменилась — кусок {i} заново: {s.get('note', '')[:50]}", flush=True); force = True
    if force or not have_v:
        inputs = hwdec(src) + src_in
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
                inputs += hwdec(o["file"]) + ["-ss", f"{max(0.0, ss):.3f}", "-t", f"{d:.3f}", "-i", o["file"]]
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
        tailf = f"[{cur}]format=yuv420p,trim=end_frame={NF},setpts=PTS-STARTPTS,{SETP}"
        if len(vfs) == 1:
            fc.append(tailf + "[vout0]")
        else:
            fc.append(tailf + f",split={len(vfs)}" + "".join(f"[sp{n_}]" for n_ in range(len(vfs))))
            for n_, (_, f0, f1) in enumerate(vfs.values()):
                fc.append(f"[sp{n_}]trim=start_frame={f0}:end_frame={f1},setpts=PTS-STARTPTS[vout{n_}]")
        cmd = ["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex", ";".join(fc)]
        for n_, (p_, f0, f1) in enumerate(vfs.values()):
            cmd += ["-map", f"[vout{n_}]"] + VENC + [p_ + ".part.mov"]
        vjobs.append({"cmd": cmd, "outs": [(p_ + ".part.mov", p_, f1 - f0) for p_, f0, f1 in vfs.values()], "say": True,
                      "label": f"{i} {s.get('note', '')[:50]}", "after": (lambda sigf=sigf, isig=isig: open(sigf, "w").write(isig)) if isig else None})
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
            # стык с растворением: звук куска — строго внутри [in, out], переход ±EDGE на самой склейке. Картинка растворяется
            # на 1 с, а звук из запаса за in/out приносил хвост чужого слова («…смысл» s5, «…тракали» s6, «…менького» s7, 22.11)
            if hL and HARD.get(i): fades += f",afade=t=in:st={max(0.0, nfL / FPS - EDGE):.4f}:d={2 * EDGE:.4f}"
            if hR and HARD.get(i + 1) and not s.get("audio_cut_out"): fades += f",afade=t=out:st={(nfL + nf) / FPS - EDGE:.4f}:d={2 * EDGE:.4f}"
            if hR and HARD.get(i + 1) and s.get("audio_cut_out"): fades += f",afade=t=out:st={(nfL + nf) / FPS:.4f}:d=0.001"
            dly = f",adelay={int(round(dL * 1000))}:all=1" if dL > 0.001 else ""
            cmd = ["ffmpeg", "-v", "error", "-y"] + src_in + ["-map", "0:a:0", "-af",
                   f"volume={float(s.get('loud_gain', 1.0)):.3f},alimiter=limit=0.89,aresample=48000,aformat=channel_layouts=stereo{dly}{fades},apad,atrim=end_sample={NF * 1600}"]
        ajobs.append({"cmd": cmd + ["-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", "-f", "wav", af + ".part.wav"],
                      "outs": [(af + ".part.wav", af, None)], "label": f"{i} {s.get('note', '')}"})
_mark("подготовка")
run_pool(vjobs, "картинки"); _mark("куски: картинка")
run_pool(ajobs, "звука"); _mark("куски: звук")
print(f"куски: картинка заново {len(vjobs)}, звук заново {len(ajobs)}, всего {len(SEG)}"
      + (f"; сбой аппаратного декодера — программно пересобрано {N_SWRETRY[0]}" if N_SWRETRY[0] else ""), flush=True)

# Склейка картинки без перекодирования фильма: середины кусков встают в фильм копированием потока, кодируется только
# растворение на стыке — «конец» уходящего + «начало» входящего, 1 с. Раньше блок из 20–49 кусков перекодировался целиком
# цепочкой xfade при правке любого его куска (1080p: 25 мин на блок, s3 v18, 22.11) и весь фильм сжимался дважды.
# Короткий кусок, у которого переходы перекрываются, идёт в цепочку переходов целиком.
base = os.path.splitext(out)[0] + "_без_музыки.mov"
def _joint(i):       # длина перехода перед куском i (0 — встык)
    d = hand[i - 1][1] + hand[i][0]
    return round(d, 4) if d >= 2 / FPS else 0.0
seq, gjobs, _grp = [], [], None                    # seq: (файл, кадров) в порядке фильма
def _close(g):
    L = sum(n_ for _, n_ in g["items"]) - sum(g["joints"])
    gf = os.path.join(wd, f"vx_{KEY([g['keys'], g['joints'], VSIG, 'g1'])}.mov")
    USED.add(gf); seq.append((gf, L))
    if not stale(gf, [p_ for p_, _ in g["items"]]): return
    ins, fc = [], []
    for j, (p_, _) in enumerate(g["items"]):
        ins += ["-i", os.path.abspath(p_)]
        fc.append(f"[{j}:v]settb=AVTB,fps={FPS},format=yuv420p,{SETP}[v{j}]")
    cur = "v0"; Lc = g["items"][0][1]
    for j in range(1, len(g["items"])):
        d = g["joints"][j - 1]
        fc.append(f"[{cur}][v{j}]xfade=transition=fade:duration={d / FPS:.4f}:offset={(Lc - d) / FPS:.4f}[x{j}]")
        cur = f"x{j}"; Lc = Lc - d + g["items"][j][1]
    fc.append(f"[{cur}]trim=end_frame={L},setpts=PTS-STARTPTS[vout]")
    gjobs.append({"cmd": ["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(fc), "-map", "[vout]"] + VENC + [gf + ".part.mov"],
                  "outs": [(gf + ".part.mov", gf, L)], "label": "переход " + ",".join(str(x) for x in sorted(g["idx"]))})
for i, P in enumerate(PV):
    F = P["files"]
    if "m" in F:
        if P["jL"]:
            _grp["items"].append((F["h"], P["jL"])); _grp["joints"].append(P["jL"]); _grp["keys"].append(P["key"] + "h"); _grp["idx"].add(i)
            _close(_grp); _grp = None
        seq.append((F["m"], P["NF"] - P["jL"] - P["jR"]))
        if P["jR"]: _grp = {"items": [(F["t"], P["jR"])], "joints": [], "keys": [P["key"] + "t"], "idx": {i}}
    else:
        if P["jL"]:
            _grp["items"].append((F["f"], P["NF"])); _grp["joints"].append(P["jL"]); _grp["keys"].append(P["key"] + "f"); _grp["idx"].add(i)
        else:
            _grp = {"items": [(F["f"], P["NF"])], "joints": [], "keys": [P["key"] + "f"], "idx": {i}}
        if not P["jR"]: _close(_grp); _grp = None
assert _grp is None, "переход без входящего куска"
run_pool(gjobs, "перехода"); _mark("переходы")
print(f"переходы: заново {len(gjobs)} из {sum(1 for p_, _ in seq if os.path.basename(p_).startswith('vx_'))}", flush=True)
def achain(idx, outp):
    ins, fc = [], []
    for j, i in enumerate(idx):
        ins += ["-i", os.path.abspath(aparts[i])]
        fc.append(f"[{j}:a]aformat=sample_rates=48000:channel_layouts=stereo[a{j}]")
    cur = "a0"
    for j in range(1, len(idx)):
        i = idx[j]; d = _joint(i)
        if d:   # жёсткий стык — сумма кусков, сведённых на склейке; мягкий — acrossfade (audio_in_hard: входящий без нарастания)
            if HARD.get(i): fc.append(f"[{cur}][a{j}]acrossfade=d={d:.4f}:c1=nofade:c2=nofade[y{j}]")   # жёсткий: куски сведены на склейке (EDGE)
            else: fc.append(f"[{cur}][a{j}]acrossfade=d={d:.4f}:c1=log:c2={'nofade' if SEG[i].get('audio_in_hard') else 'log'}[y{j}]")   # фон перетекает
        else:
            fc.append(f"[{cur}][a{j}]concat=n=2:v=0:a=1[y{j}]")
        cur = f"y{j}"
    r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(fc), "-map", f"[{cur}]", "-c:a", "pcm_s16le",
                        "-f", "wav", outp + ".part.wav"], stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if r.returncode: print("ОШИБКА склейки звука", ";".join(fc)[-1500:], r.stderr[-1500:]); sys.exit(1)
    os.replace(outp + ".part.wav", outp)
# блоки звука режем только на стыках без перехода — тогда блоки встают встык без потерь; кешируются по ключам кусков
cuts = [0] + [i + 1 for i in range(len(SEG) - 1) if not joined(i)] + [len(SEG)]
blocks, cur_ = [], []
for a_, b_ in zip(cuts, cuts[1:]):
    cur_ += list(range(a_, b_))
    if len(cur_) >= 20 or b_ == len(SEG): blocks.append(cur_); cur_ = []
if cur_: blocks.append(cur_)
ab, n_ab = [], 0
for n_, idx in enumerate(blocks):
    joints = [_joint(i) for i in idx[1:]]
    abf = os.path.join(wd, f"ab_{KEY([[akeys[i] for i in idx], joints, ASIG, [HARD.get(i, False) for i in idx], [bool(SEG[i].get('audio_in_hard')) for i in idx]])}.wav")
    if stale(abf, [aparts[i] for i in idx]): achain(idx, abf); n_ab += 1
    ab.append(abf); USED.add(abf)
print(f"блоки звука: заново {n_ab} из {len(blocks)}", flush=True)
if EXH:                                        # новые куски против первого куска фильма: разные параметры потока копированием не склеить
    _ref = vprobe(seq[0][0])[1]
    _dif = [os.path.basename(f_) for h_, f_ in EXH.items() if h_ != _ref]
    if _dif: raise SystemExit(f"ОШИБКА склейки: параметры потока кусков расходятся ({', '.join(_dif[:5])} против {os.path.basename(seq[0][0])}) — "
                              "кодер дал разные SPS/PPS, фильм из таких кусков копированием не собрать")
_q = lambda p_: os.path.abspath(p_).replace("'", "'\\''")
vlst, alst = os.path.join(wd, "list_v.txt"), os.path.join(wd, "list_a.txt")
open(vlst, "w").write("".join(f"file '{_q(p_)}'\nduration {n_ / FPS:.6f}\n" for p_, n_ in seq))
open(alst, "w").write("".join(f"file '{_q(p_)}'\n" for p_ in ab))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", vlst, "-f", "concat", "-safe", "0", "-i", alst,
                "-map", "0:v", "-map", "1:a", "-c", "copy", base], check=True, stdin=subprocess.DEVNULL)
_nf_all = sum(n_ for _, n_ in seq)
if nb_frames(base) != _nf_all:                 # склейка копированием: потерянный или лишний кадр уводит звук от картинки
    raise SystemExit(f"ОШИБКА склейки: кадров {nb_frames(base)} вместо {_nf_all} — {base}")
_mark("склейка")
import re as _re
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
# Кеш звука: сведение, дорожки для проверок и подбор потолка пика — 4–6 мин на серию при каждой сборке, хотя при правке
# одной картинки звук не меняется. Ключ — всё, из чего он собирается: блоки звука кусков, раскладка по времени, музыка
# плана, файлы треков, фразы речи для автоуровней и сам код. Совпал — готовый AAC и дорожки берутся из кеша (последний).
import shutil
_noext = os.path.splitext(out)[0]
_SPEECH = None
if AUTO and "--words-root" in a and os.path.isdir(a[a.index("--words-root") + 1]):
    import auto_level as _ALk
    _SPEECH = _ALk.live_speech([(plan["sources"][s_["src"]], s_["in"], s_["out"], p_[3], p_[4], (s_.get("gain_db", 0) or 0) <= -40) for s_, p_ in zip(SEG, pos)],
                               a[a.index("--words-root") + 1], json.load(open(a[a.index("--alias") + 1])) if "--alias" in a else {})
_here = os.path.dirname(os.path.abspath(__file__))
_fst = lambda p_: [p_, os.path.getsize(p_), int(os.path.getmtime(p_))] if os.path.exists(p_) else [p_, None]
TKEY = KEY([[os.path.basename(p_) for p_ in ab], pos, round(t, 3), plan.get("music"), [_fst(f_) for f_ in sorted({c["file"] for c in cues})],
            AUTO, _SPEECH, "--words-root" in a, W <= 640,
            [hashlib.md5(open(os.path.join(_here, f_), "rb").read()).hexdigest() for f_ in ("render_plan.py", "auto_level.py")]])
_tc = os.path.join(wd, f"t_{TKEY}")
_STEMS = ("_голос.wav", "_музыка.wav")
_prev_ceil = None                             # потолок пика прошлой сборки серии: звук версий почти одинаков — хватает одной попытки
for f_ in _glob.glob(os.path.join(wd, "t_*.json")):
    try: _prev_ceil = float(json.load(open(f_))["ceil"])
    except (OSError, ValueError, KeyError, TypeError): pass
_meta = None
if os.path.exists(_tc + ".m4a") and not stale(_tc + ".json", ab):
    try: _meta = json.load(open(_tc + ".json"))
    except (OSError, ValueError): _meta = None   # сборка упала на записи — считаем заново
TAIL_HIT = isinstance(_meta, dict) and {"tp", "fail", "log"} <= set(_meta)
_tlog = []
def say(m):
    _tlog.append(m); print(m, flush=True)
aacp = _noext + "_звук.m4a"
if TAIL_HIT:
    tp = _meta["tp"]; TP_FAIL = _meta["fail"]
    for suf in _STEMS:                         # дорожки для проверок — те же, что у сборки, давшей этот звук
        if os.path.exists(_tc + suf): shutil.copyfile(_tc + suf, _noext + suf)
        elif os.path.exists(_noext + suf): os.remove(_noext + suf)
    shutil.copyfile(_tc + ".m4a", aacp)
    print("звук и музыка без изменений — из кеша:", flush=True)
    for m_ in _meta["log"]: print("  " + m_, flush=True)
    _mark("звук из кеша")
else:
    for suf in _STEMS:                         # дорожки прежней сборки с тем же именем: без cues их никто не перезапишет
        if os.path.exists(_noext + suf): os.remove(_noext + suf)
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
        _mark("громкость треков")
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
        _mark("дорожка голоса")
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
            _mark("сырая музыка")
            R_m, R_b, R_v = (AL.rms_windows(x, power=True) for x in (rawp, base, voicep))   # как слышно в стерео-миксе (s6 v2)
            R_m, R_b, R_v = list(R_m), list(R_b), list(R_v); _mark("замер уровней")
            segi = [(plan["sources"][s_["src"]], s_["in"], s_["out"], p_[3], p_[4], (s_.get("gain_db", 0) or 0) <= -40) for s_, p_ in zip(SEG, pos)]
            if WR:
                speech = AL.live_speech(segi, WR, ALIAS)
                if not speech: say("автоуровни: в расшифровках --words-root не нашлось слов отрезков — живая речь не приглушает музыку")
            else:                                # без расшифровок — по энергии живого звука в незаглушённых отрезках (грубее)
                say("автоуровни: нет --words-root — речь по энергии, виды с громким ветром приглушат музыку")
                loud = [(i * AL.WIN, (i + 1) * AL.WIN) for i in range(n_w) if i < len(R_b) and R_b[i] > -29
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
            say(f"автоуровни: речь фильма {ref:.1f} дБ, фраз {len(speech)}, музыка под речью в среднем "
                f"{(talk_g[len(talk_g) // 2] if talk_g else 0):+.1f} дБ к −23 LUFS")
    # сведённый звук — сначала без потерь: пики ограничиваются до AAC, а не перекодированием AAC → AAC
    _mark("дорожка музыки")
    mixp = os.path.splitext(out)[0] + "_микс.wav"
    if cues:
        subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", ";".join(fc), "-map", "[a]", "-t", f"{t:.3f}",
                        "-c:a", "pcm_f32le", mixp], check=True, stdin=subprocess.DEVNULL)   # float: сумма выше 0 dBFS не срезается до ограничителя
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", base, "-map", "0:a", "-c:a", "pcm_f32le", mixp], check=True, stdin=subprocess.DEVNULL)
    _mark("микс")
    for p_ in _tmp_auto:                          # сырая музыка (float) и огибающая — временные (≈0,9 ГБ на 40 мин)
        if os.path.exists(p_): os.remove(p_)
    def true_peak(pth):
        r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", pth, "-vn", "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
        m = _re.findall(r"Peak:\s+(-?inf|-?[\d.]+) dBFS", r.stderr); return float(m[-1]) if m else None   # тишина → -inf
    # истинный пик ≤ −1 dBTP в ГОТОВОМ файле: ограничитель с 4-кратной передискретизацией видит межсэмпловые пики,
    # AAC добавляет свой выброс — поэтому мерим итоговый файл и при промахе кодируем из того же WAV с потолком ниже.
    # Громкость остальной речи не трогаем: режутся только пики (общий volume вниз топил весь фильм до −16 LUFS).
    # Потолок подбирается по одной звуковой дорожке (.m4a, секунды): раньше каждая попытка заново писала весь фильм
    # (1080p — 6 ГБ и ещё раз под faststart, 4K — 17 ГБ). Готовый AAC кладётся в фильм копированием — пик тот же.
    def encode_master(ceil_db):
        lim = max(0.0625, 10 ** (ceil_db / 20))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mixp, "-map", "0:a",
                        "-af", f"aresample=192000,alimiter=limit={lim:.4f}:level=false:latency=1,aresample=48000",
                        "-c:a", "aac", "-b:a", "160k" if W <= 640 else "320k", aacp],
                       check=True, stdin=subprocess.DEVNULL)
        return true_peak(aacp)
    TP_TARGET, TP_SLACK = -1.0, 0.8              # пик готового файла −1.8…−1.0 dBTP: ниже — зря тише (s3 v16: −3.8 после шага −2.7 дБ)
    ceil, ok, bad = (_prev_ceil if _prev_ceil is not None else -2.0), None, None   # ok — потолок, давший пик в пределах; bad — выше цели
    _up = _prev_ceil is not None                 # старт с прошлого потолка: если он теперь с лишним запасом — шаг вверх, а не «зря тише»
    _tp_up = None
    for attempt in range(6):
        tp = encode_master(ceil); enc = ceil
        say(f"звук: потолок {ceil:.1f} dBFS → истинный пик готового файла {tp} dBTP")
        if tp is not None and tp <= TP_TARGET:
            ok = (ceil, tp)
            if tp >= TP_TARGET - TP_SLACK or (bad is None and not _up) or (bad is not None and bad - ceil < 0.3): break
            # перестраховались: вверх — к последнему промаху, а без промаха (старт с прошлого потолка) — к середине допуска
            if bad is not None: ceil = round((ceil + bad) / 2, 2)
            else:
                nxt = round(min(-0.5, ceil + (TP_TARGET - TP_SLACK / 2 - tp)), 2)
                # пик не вырос после шага или выше некуда: ограничитель не работает, микс сам тише потолка — дальше то же самое
                if nxt <= ceil + 0.05 or (_tp_up is not None and abs(tp - _tp_up) < 0.05): break
                _tp_up = tp; ceil = nxt
        else:
            bad = ceil
            ceil = round((ceil + ok[0]) / 2, 2) if ok else ceil - ((tp - TP_TARGET if tp is not None else 1.0) + 0.3)
    if ok and ok[0] != enc:                        # последняя попытка — промах: вернуть лучшую годную
        tp = encode_master(ok[0]); say(f"звук: потолок {ok[0]:.1f} dBFS → истинный пик {tp} dBTP (лучший годный)")
    TP_FAIL = tp is None or tp > TP_TARGET
    _mark("потолок пика")
    # звук этой сборки — в кеш (один, последний): следующая сборка с тем же звуком возьмёт его готовым
    for f_ in _glob.glob(os.path.join(wd, "t_*")):   # только свои файлы по имени: --workdir может быть папкой с чужими
        if os.path.isfile(f_) and _re.match(r"^t_[0-9a-f]{12}(?:\.json(?:\.part)?|\.m4a|_голос\.wav|_музыка\.wav)$", os.path.basename(f_)): os.remove(f_)
    for suf in _STEMS:
        if os.path.exists(_noext + suf): shutil.copyfile(_noext + suf, _tc + suf)
    shutil.copyfile(aacp, _tc + ".m4a")
    with open(_tc + ".json.part", "w") as fh_: json.dump({"ceil": ok[0] if ok else enc, "tp": tp, "fail": TP_FAIL, "log": _tlog}, fh_, ensure_ascii=False)
    os.replace(_tc + ".json.part", _tc + ".json")   # json — последним и разом: он и есть признак целого кеша
    os.remove(mixp)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", base, "-i", aacp, "-map", "0:v", "-map", "1:a", "-c", "copy",
                "-map_chapters", "-1", "-movflags", "+faststart", out], check=True, stdin=subprocess.DEVNULL)
os.remove(aacp)
_mark("запись фильма")
# таблица таймкодов отрезков — по фактическим (до кадра) длинам кусков, как собран фильм: аудиты берут кадры по ней
t = 0.0; rows = []
for i, s in enumerate(plan["segments"]):
    d = cores[i]; k_ = d / max(s["out"] - s["in"], 1e-6)
    rows.append({"i": i, "start": round(t, 3), "end": round(t + d, 3), "note": s.get("note", ""), "asig": ASIG, "xfade": round(hand[i][1] + (hand[i + 1][0] if i + 1 < len(hand) else 0), 3), "src": plan["sources"][s["src"]],
                 "in": s["in"], "out": s["out"], "broll": [{"at_film": round(t + (o["at"] - s["in"]) * k_, 3), "dur": o["dur"], "file": o["file"], "in": o.get("in", 0)} for o in s.get("broll", [])]})
    t += d
json.dump(rows, open(os.path.splitext(out)[0] + ".segments.json", "w"), ensure_ascii=False, indent=1)
# чистка кеша: неиспользованные этой сборкой файлы, к которым 14 дней не обращалась ни одна сборка (используемые
# получают свежий mtime — куски соседней версии плана не стареют от возраста), с --prune — все неиспользованные.
# Удаляются только файлы кеша по имени: --workdir может указывать на папку с чужими файлами.
_now = _time.time()
for p_ in USED | set(_glob.glob(_tc + "*")):   # одно время на все файлы кеша: зависимые не «старше» своих кусков (см. stale)
    if os.path.exists(p_): os.utime(p_, (_now, _now))
_CACHE = _re.compile(r"^(?:v_[0-9a-f]{12}\.img|v[hmtfx]_[0-9a-f]{12}\.mov|(?:a|ab)_[0-9a-f]{12}\.wav)(?:\.part\.(?:mov|wav))?$|^list\.txt$")
# куски прежних форматов (кусок одним файлом, блоки склейки): нынешняя сборка их не читает — удаляются сразу, место нужно под 4K
_OLD = _re.compile(r"^(?:(?:v|vb)_[0-9a-f]{12}\.mov|\d{3}_[0-9a-f]{8}\.mov|block_\d+\.mov)(?:\.part\.mov)?$")
for p_ in _glob.glob(os.path.join(wd, "*")):
    _b = os.path.basename(p_)
    if p_ in USED or not os.path.isfile(p_): continue
    if ("--workdir" not in a and _OLD.match(_b)) or (_CACHE.match(_b) and ("--prune" in a or _now - os.path.getmtime(p_) > 14 * 86400)):
        os.remove(p_)
_mark("чистка кеша")
print("время: " + ", ".join(f"{n_} {d_ / 60:.1f} мин" if d_ >= 60 else f"{n_} {d_:.0f} с" for n_, d_ in _TM if d_ >= 1)
      + f"; всего {sum(d_ for _, d_ in _TM) / 60:.1f} мин (декодер {'аппаратный' if HWDEC else 'программный'}, кусков разом {JOBS})", flush=True)
print("готово", out, f"{t/60:.1f} мин")
if TP_FAIL:                            # успех не объявляется по промаху: файл есть, но код возврата ненулевой
    raise SystemExit(f"ОШИБКА: истинный пик {tp} dBTP выше {TP_TARGET} после 4 попыток — смотри выброс в плане")
