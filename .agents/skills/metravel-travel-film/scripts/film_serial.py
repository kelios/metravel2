"""Общая механика сборки серии travel-фильма: сборщик plan_sN.py описывает только сцены, всё остальное — здесь.

Перенесено из рабочей папки GR21 (gr21_serial.py, снимок 23.11.2026 11:44): поиск исходников, рассказ по словам,
перебивки, фото, плашки, «воспоминание» и выходы из него, громкость речи, переходы, края звука, размытые копии,
музыка, голос за кадром, звуки, общее интро сериала и «ранее». Имена функций и переменных прежние: сборщик,
написанный под gr21_serial, переводится заменой строки импорта. Пути, названия серий, кадры интро и «ранее»
берутся из film.json — того же, что читает film.py (класс film.Film); этот модуль фильма не знает.

Сборщик серии (создаёт `film.py series sN`, шаблон — plan_template.py):
    import film_serial as S
    from film_serial import clip, story, file_seg, rv, ph, photo_seg, card, put
    S.start("s2"); S.serial_intro(2); <сцены>; <общие проходы>; S.part_beds(); S.save(sys.argv[1])

film.json ищется так: FILM_JSON, затем вверх от папки сборщика, затем вверх от текущей папки. Ключи этого слоя
(все необязательные, пути — от папки планов):
  "prep": "../.."                      папка подготовки (PREP)
  "maps": "../../2 карты", "reels": "../../3 нарезки лучших кадров", "cards": "титры", "music": "../../6 музыка",
  "sfx": "<music>/звуки", "intro_voice": "../../1 сценарий/интро серий"
  "series": {"s2": {"n": 2, "days": [2], "title": "Отлив и роковая ошибка"}}, "series_total": 7
  "intro": {"shots": [[день, "ключ клипа", от, до, "заметка"], ["map", "00 обзор маршрута.mp4", 0, 9, "карта"]],
            "title_card": "название GR21.png", "voice": "интро сериала — коротко.wav", "voice_at": 0.5,
            "music": "ES_Habitat - Jakob Ahlbom.mp3", "music_in": 3.4}
  "recap": {"1": [[день, "ключ", от, длина, "заметка"]]}     кадры блока «ранее — серия 1»; голос — «ранее — серия 1*.wav»
  "sounds": {"whoosh": "…mp3", "cash": "…mp3", "bleep": "…wav"}   файлы в папке звуков
  "photo_key": "Медиатека - {num} из"   как по номеру найти фото телефона; "foreign": ["/Собраны/", …] — чужие исходники
  "fonts": {"title": "…ttf", "text": "…ttf", "end_bold": "…ttf", "end": "…ttf"}   шрифты плашек (titry.py) и концовки (end_card.py);
            не заданы — из загрузок Filmora (~/Library/Application Support/Wondershare Filmora Mac), затем системные
  "year": 2026                          год на концовке

Соглашения заметок отрезков: «N. …» — номер сцены сценария; «рассказ:» — кусок рамки-рассказа (под ним
воспоминание и окошко рассказчика); CFG["teaser"] — префикс тизера (без переходов и выравнивания); CFG["intro"] —
префиксы вступления (только музыка и голос за кадром).

Проверочный прогон: FILM_SERIAL_SHADOW=<папка> — всё, что библиотека создала бы в рабочей папке (задания копий,
кеши громкости, плашки, фото-копии, расшифровки), пишется в <папка>; готовое читается с места. Так сборщик
сверяется с прежним планом, не трогая папку фильма: `FILM_SERIAL_SHADOW=/tmp/x python3 -I plan_s5.py /tmp/x/plan.json`.
"""
import copy, glob, hashlib, json, os, re, subprocess, sys, time, unicodedata

SK = os.path.dirname(os.path.abspath(__file__))
if SK not in sys.path: sys.path.insert(0, SK)
import film as _film

N = lambda s: unicodedata.normalize("NFC", s)


def _find_cfg():
    f = os.environ.get("FILM_JSON")
    if f: return f
    main = getattr(sys.modules.get("__main__"), "__file__", None)
    for d in ([os.path.dirname(os.path.abspath(main))] if main else []) + [os.getcwd()]:
        while True:
            if os.path.exists(os.path.join(d, "film.json")): return os.path.join(d, "film.json")
            if os.path.dirname(d) == d: break
            d = os.path.dirname(d)
    raise SystemExit("film_serial: film.json не найден — запускай сборщик из папки планов, положи film.json рядом или задай FILM_JSON")


F = _film.Film(_find_cfg())
HERE = F.dir                                   # папка планов: задания копий, плашки, фото-копии, размытие
ROOT = F.c["sources"]
PREP = F.p("prep")
INV_PATH = F.p("inventory")
INV = json.load(open(INV_PATH, encoding="utf-8")) if os.path.exists(INV_PATH) else []
DATA = os.path.dirname(INV_PATH)
SPEECH = F.p("words_out")
MAPS = F.p("maps")
REELS = F.p("reels")
CARDS = F.p("cards")
MUSIC = F.p("music") + "/"
SFX = (F.p("sfx") + "/") if F.c.get("sfx") else MUSIC + "звуки/"
INTRO_VO = F.p("intro_voice") + "/"
SKILL_SCRIPTS = SK
SHADOW = os.environ.get("FILM_SERIAL_SHADOW") or ""
FACE = 4.0

plan = {"sources": {}, "segments": [], "music": {"cues": []}}
log = []
CFG = {"tag": "s1", "teaser": "T.", "intro": ("0.", "1.", "2.")}
TEMP = set()


def start(tag, teaser="T.", intro=("0.", "1.", "2."), auto_level=False):
    """auto_level=True — уровни музыки ставит render_plan (нужны --words-root и --alias при рендере); duck_beds не режет подложки."""
    CFG.update(tag=tag, teaser=teaser, intro=tuple(intro))
    if auto_level: plan["music"]["auto_level"] = True


def series(tag=None):
    """Серия из film.json: {"n": номер, "days": [дни], "title": название}."""
    return F.series(tag or CFG["tag"])


def job_path(name):
    return os.path.join(HERE, f"{name}_{CFG['tag']}.json")


def _p(path, write=False):
    """Файл, который библиотека создаёт сама. Обычный запуск — он и есть. Проверочный прогон (FILM_SERIAL_SHADOW):
    запись идёт в тень, чтение — из тени, если там уже есть, иначе с места."""
    if not SHADOW: return path
    sp = os.path.join(SHADOW, os.path.abspath(path).lstrip(os.sep))
    if write: os.makedirs(os.path.dirname(sp), exist_ok=True); return sp
    return sp if os.path.exists(sp) else path


def _load(path, default):
    path = _p(path)
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else default


def _under(path, folder):
    return N(path).startswith(N(folder).rstrip("/") + "/")


# ---------------------------------------------------------------- файлы и слова
_FD = {}
def fdur(p):
    if p.lower().endswith((".png", ".jpg", ".jpeg")): return 1e9
    if p not in _FD:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True)
        _FD[p] = float(r.stdout.strip() or 1e9)
    return _FD[p]


def find(day, key):
    c = [v for v in INV if v["day"] == day and N(key) in N(os.path.basename(v["path"]))]
    c = [v for v in c if v["kind"] == "video"] or c
    if len(c) != 1:
        raise SystemExit(f"д{day} «{key}»: найдено {len(c)}" + ("" if INV else f" — инвентарь пуст ({INV_PATH}): film.py prep <дни>"))
    return c[0]


def tok(s):
    return re.sub(r"[^\w]", "", N(s).lower().replace("ё", "е"))


def words_json(v):
    """Расшифровка по словам (mlx-whisper), кэш в данные/речь; делается при первом обращении (film.py prep готовит заранее)."""
    real = f"{SPEECH}/д{v['day']}/{v['cam']}/{os.path.splitext(os.path.basename(v['path']))[0]}.words.json"
    if not os.path.exists(_p(real)):
        import tempfile, shutil
        T = tempfile.mkdtemp(); p = _p(real, True)
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", v["path"], "-vn", "-ac", "1", "-ar", "16000", "-af", "loudnorm=I=-20", T + "/a.wav"],
                           stdin=subprocess.DEVNULL, capture_output=True)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        if r.returncode != 0:
            json.dump({"segments": []}, open(p, "w")); return p
        subprocess.run(["mlx_whisper", T + "/a.wav", "--model", "mlx-community/whisper-large-v3-turbo", "--language", "ru", "--output-format", "json",
                        "--output-dir", T, "--condition-on-previous-text", "False", "--word-timestamps", "True", "--verbose", "False"],
                       stdin=subprocess.DEVNULL, capture_output=True)
        if not os.path.exists(T + "/a.json"):
            raise SystemExit(f"расшифровка не получилась: {v['path']} (нужен mlx_whisper: uv tool install --python 3.12 mlx-whisper)")
        shutil.copy(T + "/a.json", p)
    return _p(real)


_words = {}
def words(day, key):
    if (day, key) not in _words:
        w = [x for s in json.load(open(words_json(find(day, key))))["segments"] for x in s.get("words", [])]
        _words[(day, key)] = [(tok(x["word"]), x["start"], x["end"]) for x in w if tok(x["word"])]
    return _words[(day, key)]


def at(day, key, phrase, after=0.0, edge="start"):
    w = words(day, key); p = [tok(x) for x in phrase.split()]
    for i in range(len(w) - len(p) + 1):
        if w[i][1] < after: continue
        if all(w[i + k][0].startswith(p[k][:max(3, len(p[k]) - 2)]) for k in range(len(p))):
            return w[i][1] if edge == "start" else w[i + len(p) - 1][2]
    raise SystemExit(f"д{day} {key}: не нашла «{phrase}» после {after}")


# ---------------------------------------------------------------- отрезки
def src(path):
    for k, v in plan["sources"].items():
        if v == path: return k
    k = "s" + str(len(plan["sources"]) + 1); plan["sources"][k] = path; return k


def seg(path, a, b, dur, note="", gain=0, broll=(), cards=()):
    a = max(0.0, a); b = min(b, dur - 0.05)
    if b - a < 1.0: raise SystemExit(f"короткий отрезок {note}: {a}–{b}")
    s = {"src": src(path), "in": round(a, 3), "out": round(b, 3), "note": note, "xd_out": 0.5}
    if gain: s["gain_db"] = gain
    if broll: s["broll"] = list(broll)
    if cards: s["cards"] = list(cards)
    plan["segments"].append(s); log.append(f"{note[:62]:62s} {b - a:6.1f} с")
    return s


def clip(day, key, a=None, b=None, note="", mute=False, cards=(), over=(), each=7.0):
    """Живой план; over — перебивки поверх по `each` с, вперемежку с лицом говорящего (длинный монолог в камеру)."""
    v = find(day, key)
    a = 0.15 if a is None else a; b = v["dur"] - 0.15 if b is None else min(b, v["dur"] - 0.15)
    s = seg(v["path"], a, b, v["dur"], note or key, gain=-60 if mute else 0, cards=cards)
    if over:
        n = len(over); gap = max(2.5, ((b - a) - n * each) / (n + 1)); t = a + gap; br = []
        for path, sin, vert, odur in over:
            d = min(each, odur - sin - 0.1, b - t - 2.0)
            if d < 2.0: break
            br.append({"at": round(t, 3), "dur": round(d, 3), "file": path, "in": round(sin, 3), "fit": "contain" if vert else "cover"}); t += d + gap
        s["broll"] = br
    return s


CLEAN = {}   # очищенная копия → исходник (для расшифровки и громкости)
def cleaned(day, key):
    """Копия клипа: видео как есть, звук — срез ветра 90 Гц и мягкое шумоподавление (разборчивость речи на ветру)."""
    v = find(day, key); h = hashlib.md5(f"{v['path']}|clean1".encode()).hexdigest()[:10]
    out = _p(os.path.join(HERE, "очищенный звук", f"{h}.mov"))
    if not os.path.exists(out):
        out = _p(os.path.join(HERE, "очищенный звук", f"{h}.mov"), True); os.makedirs(os.path.dirname(out), exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", v["path"], "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy",
                        "-af", "highpass=f=90,afftdn=nr=12:nf=-40:tn=1,equalizer=f=3000:t=q:w=1:g=3", "-c:a", "pcm_s16le", "-ar", "48000",
                        out + ".part.mov"], check=True, stdin=subprocess.DEVNULL)
        os.replace(out + ".part.mov", out)
    CLEAN[out] = v["path"]; return out


def clip_clean(day, key, a, b, note):
    v = find(day, key); return seg(cleaned(day, key), a, b, v["dur"], note)


def file_seg(path, a, b, note, mute=True):
    return seg(path, a, min(b, fdur(path)), fdur(path), note, gain=-60 if mute else 0)


def photo(day, num, dur=4.0):
    """Фото телефона → 4K-видео (кэш «фото/»): поворот по EXIF; режим — CFG["photo_mode"] (still1 — неподвижно, вертикальное —
    полоса 16:9; pan1 — прежняя панорама на размытом фоне), см. photo_file(); тихая дорожка. Возвращает путь к mp4.
    Рендер рисует картинки-перебивки растяжением на весь кадр (как плашки), поэтому фото идут только через эту копию.
    Фото ищется в инвентаре дня по film.json "photo_key" (по умолчанию «Медиатека - {num} из» — выгрузка «Фото» на маке)."""
    k = N(F.c["photo_key"].format(num=num))
    v = next((v for v in INV if v["day"] == day and v["kind"] == "photo" and k in N(os.path.basename(v["path"]))), None)
    if v is None: raise SystemExit(f"д{day}: нет фото {num}")
    return photo_file(v["path"], dur, str(num))


def photo_file(path, dur=4.0, tag="архив"):
    """Любое фото (в т. ч. архив прошлых поездок) → 4K-видео; см. photo().
    Режим CFG["photo_mode"]: "still1" (по умолчанию) — неподвижно, вертикальное и квадратное — полоса 16:9 по горизонтали
    (по людям — crop_band; без людей центр на 42 % высоты: лица и главное обычно выше середины), без размытого фона.
    "pan1" — прежняя медленная панорама с размытым фоном у вертикальных (для уже принятых серий)."""
    mode = CFG.get("photo_mode") or "still1"
    v = {"path": path}
    _band = None
    if mode == "still1":                                        # вертикальное фото — полоса по людям (crop_band)
        from PIL import Image as _I, ImageOps as _O
        _im = _O.exif_transpose(_I.open(v["path"]))
        if _im.height > _im.width * 9 / 16 * 1.05:
            import crop_band
            _band = crop_band.ensure([(v["path"], None, None)], crop_band.find_yolox(HERE)).get(crop_band._key(v["path"]))
    h = hashlib.md5((f"{v['path']}|{dur:.2f}|{mode}" + (f"|люди{_band:.3f}" if _band is not None else "")).encode()).hexdigest()[:10]
    out = _p(os.path.join(HERE, "фото", f"{tag}_{h}.mp4"))
    if not os.path.exists(out):
        out = _p(os.path.join(HERE, "фото", f"{tag}_{h}.mp4"), True); os.makedirs(os.path.dirname(out), exist_ok=True)
        import tempfile
        from PIL import Image, ImageFilter, ImageOps, ImageEnhance
        im = ImageOps.exif_transpose(Image.open(v["path"])).convert("RGB")
        if mode == "still1":
            BW, BH = 3840, 2160
            k = max(BW / im.width, BH / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            cy = im.height * (_band if _band is not None else (0.42 if im.height > im.width * BH / BW * 1.05 else 0.5))   # вертикальное — по людям, иначе чуть выше центра
            y0 = int(min(max(0, cy - BH / 2), im.height - BH)); x0 = (im.width - BW) // 2
            canvas = im.crop((x0, y0, x0 + BW, y0 + BH))
            vf = "fps=30000/1001,format=yuv420p"
        else:
            BW, BH = 4224, 2376                                   # кадр +10 % — запас под панораму
            if im.width / im.height >= 1.5:
                k = max(BW / im.width, BH / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
                canvas = im.crop(((im.width - BW) // 2, (im.height - BH) // 2, (im.width - BW) // 2 + BW, (im.height - BH) // 2 + BH))
            else:
                k = max(BW / im.width, BH / im.height); bg = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
                bg = bg.crop(((bg.width - BW) // 2, (bg.height - BH) // 2, (bg.width - BW) // 2 + BW, (bg.height - BH) // 2 + BH))
                bg = ImageEnhance.Brightness(bg.resize((BW // 8, BH // 8)).filter(ImageFilter.GaussianBlur(6)).resize((BW, BH), Image.BILINEAR)).enhance(0.8)
                k = BH / im.height; fg = im.resize((round(im.width * k), BH), Image.LANCZOS)
                bg.paste(fg, ((BW - fg.width) // 2, 0)); canvas = bg
            vf = f"fps=30000/1001,crop=3840:2160:x='(iw-ow)*t/{dur:.3f}':y='(ih-oh)/2*(1-t/{dur:.3f})',format=yuv420p"
        tmp = tempfile.mkdtemp() + "/p.jpg"; canvas.save(tmp, quality=95)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", f"{dur:.3f}", "-i", tmp, "-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo",
                        "-vf", vf, "-c:v", "h264_videotoolbox", "-b:v", "40M", "-c:a", "aac", "-shortest", out + ".part.mp4"], check=True, stdin=subprocess.DEVNULL)
        os.replace(out + ".part.mp4", out)
    return out


def ext(path, a=0.3):
    """Видео не из поездки (архив прошлых походов) как перебивка: кортеж для over=… с определением вертикали."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation:format=duration",
                        "-of", "json", path], capture_output=True, text=True)
    j = json.loads(r.stdout or "{}"); s = (j.get("streams") or [{}])[0]
    rot = abs(int(float(next((d.get("rotation", 0) for d in s.get("side_data_list", []) if "rotation" in d), 0))))
    vert = (s.get("width", 1) < s.get("height", 1)) ^ (rot == 90)
    return (path, a, vert, float(j.get("format", {}).get("duration", 1e9)))


def ph_file(path, dur=4.0, tag="архив"):
    return (photo_file(path, dur + 0.5, tag), 0.1, False, dur + 0.5)


def ph(day, num, dur=4.0):
    """Фото как перебивка (кортеж для over=…)."""
    return (photo(day, num, dur + 0.5), 0.1, False, dur + 0.5)


def photo_seg(day, num, dur, note):
    """Фото на главной дорожке (без звука места — под музыку)."""
    p = photo(day, num, dur + 0.3); return seg(p, 0.1, dur + 0.1, fdur(p), note, gain=-60)


def rv(day, key, a=None, b=None):
    v = find(day, key)
    vert = (v.get("w", 1) < v.get("h", 1)) ^ (abs(v.get("rot") or 0) == 90)
    return (v["path"], 0.3 if a is None else a, vert, v["dur"] if v["kind"] == "video" else 1e9)


def spread(over, t, end):
    br = []; n = len(over); slot = max(3.0, (end - t) / max(1, n))
    for i, o in enumerate(over):
        if t >= end - 1.5: break
        d = min(slot, end - t) if i < n - 1 else end - t
        path, sin, vert, odur = o; d = min(d, odur - sin - 0.1)
        if d < 2.0: continue
        br.append({"at": round(t, 3), "dur": round(d, 3), "file": path, "in": round(sin, 3), "fit": "contain" if vert else "cover"})
        t += d
    return br


def story(day, key, start_phrase, end_phrase, over=(), note="", after=0.0, face=FACE, pad=(0.15, 0.3)):
    """Кусок рассказа от первой фразы до конца второй; поверх — перебивки после `face` секунд лица."""
    v = find(day, key)
    a = at(day, key, start_phrase, after) - pad[0]
    b = at(day, key, end_phrase, a, edge="end") + pad[1]
    return seg(v["path"], a, b, v["dur"], note, broll=spread(over, a + face, b) if over else ())


def S(prefix):
    c = [x for x in plan["segments"] if x["note"].startswith(prefix)]
    if not c: raise SystemExit("нет отрезка " + prefix)
    return c[0]


def is_cont(note):
    return bool(re.search(r"\((после вырезки|часть \d+|после пи|пи)\)", note))


# ---------------------------------------------------------------- плашки (titry.py скилла), один раз на файл
CARD_ARGS = {}   # файл плашки → (вид, имя, строки): cards_clear_of_pip() перерисует её у верхнего края
_TITRY_SIG = None
_STALE_CARDS = set()


def card(kind, name, *lines):
    """PNG плашки рисуется заново, если поменялись вид, строки, шрифты или titry.py (подпись — в «<имя>.json» рядом):
    иначе под тем же именем в рендер уходит прежний текст. Виды — в titry.py."""
    global _TITRY_SIG
    if _TITRY_SIG is None: _TITRY_SIG = hashlib.md5(open(SK + "/titry.py", "rb").read()).hexdigest()[:12]
    real = f"{CARDS}/{name}.png"; sigp = f"{CARDS}/{name}.json"; out = _p(real)
    fonts = F.c.get("fonts") or {}
    sig = {"kind": kind, "lines": list(lines), "titry": _TITRY_SIG}
    if fonts: sig["fonts"] = fonts
    try: old = json.load(open(_p(sigp)))
    except Exception: old = None
    stale = old != sig
    if SHADOW and stale and os.path.exists(out) and old and old.get("kind") == kind and old.get("lines") == list(lines):
        stale = False; _STALE_CARDS.add(name)             # проверочный прогон: вид и строки те же — готовая плашка годится
    if not os.path.exists(out) or stale:
        out = _p(real, True); os.makedirs(os.path.dirname(out), exist_ok=True)
        env = dict(os.environ, **{k: v for k, v in (("FILM_FONT_TITLE", fonts.get("title")), ("FILM_FONT_TEXT", fonts.get("text"))) if v})
        r = subprocess.run([sys.executable, "-I", SK + "/titry.py", kind, out, *lines], capture_output=True, text=True, env=env)
        if r.returncode:
            raise SystemExit(f"плашка «{name}»: {(r.stderr or r.stdout).strip()}")
        json.dump(sig, open(_p(sigp, True), "w"), ensure_ascii=False)
    CARD_ARGS[out] = (kind, name, lines)
    return out


def put(sg, file, at_=0.5, dur=3.6):
    a = round(sg["in"] + at_, 3)
    sg.setdefault("cards", []).append({"at": a, "dur": round(min(dur, sg["out"] - a - 0.2), 3), "file": file})


def put_across(prefix, file, at_=0.1, dur=3.2):
    """Плашка поверх стыка: начинается на первом отрезке с заметкой prefix и, если он короче, продолжается
    на следующих (не удлинять кадры «ранее» — пауза голоса). Куски касаются краёв отрезков,
    render_plan продлевает их в запас перехода — в растворении плашка стоит на месте, не мигает.
    "span" — общее время на экране (audit_cut меряет его), "cont" — продолжение (не отдельная плашка)."""
    segs = [x for x in plan["segments"] if x["note"].startswith(prefix)]
    if not segs: raise SystemExit("нет отрезка " + prefix)
    left, at, first = dur, round(segs[0]["in"] + at_, 3), None
    for i, sg in enumerate(segs):
        room = sg["out"] - at
        last = left <= room - 0.3 or i == len(segs) - 1
        c = {"at": at, "dur": round(min(left, room - 0.2) if last else room, 3), "file": file}
        if first is None: first = c; c["span"] = dur
        else: c["cont"] = True
        sg.setdefault("cards", []).append(c)
        if last: break
        left -= room - float(sg.get("xd_out", 0) or 0)     # растворение: оба куска на экране одновременно
        at = segs[i + 1]["in"]
    return first


# ---------------------------------------------------------------- названия серий — один словарь на весь сериал
# Начало у всех серий одинаковое (интро + «ранее»), поэтому номер и название серии видны в первые 5 с, а каждый
# блок «ранее» подписан своей серией. Названия — film.json → "series" → "sN" → "title".
SERIES_TITLES = {int(v.get("n") or k[1:]): v["title"] for k, v in (F.c.get("series") or {}).items() if (v or {}).get("title")}
EPISODES = SERIES_TITLES                     # прежнее имя — тот же словарь


def _title(n):
    if n not in SERIES_TITLES: raise SystemExit(f"у серии {n} нет названия: film.json → series → s{n} → title")
    return SERIES_TITLES[n]


def episode_card(n):
    """Большая плашка «Серия N» + название (вид «серия»). Имя файла содержит название: смена названия = новый файл."""
    return card("серия", f"серия {n} — {_title(n)}", f"Серия {n}", _title(n))


def episode_number_card(n):
    """«Серия N из M · название» под названием фильма на первом кадре серии (вид «номер»)."""
    total = int(F.c.get("series_total") or len(SERIES_TITLES))
    return card("номер", f"номер серии {n} — {_title(n)}", (f"Серия {n} из {total}" if total > 1 else f"Серия {n}") + f" · {_title(n)}")


def recap_card(e):
    """Начало блока «ранее» по серии e (вид «блок», как «Вспоминаем»)."""
    return card("блок", f"ранее серия {e} — {_title(e)}", f"Ранее · Серия {e}", _title(e))


def title_card():
    """Название фильма на первом кадре: готовый файл film.json → intro.title_card (в папке плашек) или плашка «крупно» из "film"."""
    f = (F.c.get("intro") or {}).get("title_card")
    if f: return f if os.path.isabs(f) else f"{CARDS}/{f}"
    name = F.c.get("film") or "фильм"
    return card("крупно", f"название {name}", name)


# ---------------------------------------------------------------- общие проходы (порядок как в серии 1)
def fit_broll_to_files():
    for x in plan["segments"]:
        br = sorted(x.get("broll", []), key=lambda o: o["at"])
        for k, o in enumerate(br):
            L = fdur(o["file"]) - 0.05
            if o.get("in", 0) + o["dur"] <= L: continue
            o["in"] = round(max(0.0, L - o["dur"]), 3)
            if o["in"] + o["dur"] > L: o["dur"] = round(L - o["in"], 3)
        x["broll"] = [o for o in br if o["dur"] >= 1.0]


def join_runs(max_gap=8.0):
    """Соседние куски одного рассказа (пауза ≤ max_gap с или перекрытие) — встык: ни вырезанных, ни повторённых слов."""
    segs = plan["segments"]; n = 0
    for l, r in zip(segs, segs[1:]):
        g = r["in"] - l["out"]
        if l["src"] == r["src"] and -3.0 < g <= max_gap and abs(g) > 0.01 and (l.get("gain_db", 0) or 0) > -40 and (r.get("gain_db", 0) or 0) > -40:
            l["out"] = r["in"]; n += 1
    print("  куски рассказа встык:", n)


def whole_phrases():
    """Края живой речи — по целой фразе (дотянуть до соседних слов с паузой < 0,6 с), но не в звук, уже стоящий в фильме."""
    segs = plan["segments"]; used = {}
    for x in segs: used.setdefault(x["src"], []).append(x)
    for i, x in enumerate(segs):
        if x["note"].startswith(CFG["intro"] + (CFG["teaser"],)) or (x.get("gain_db", 0) or 0) <= -40 or "(пи)" in x["note"] or x.get("fixed"): continue
        path = plan["sources"][x["src"]]; v = next((v for v in INV if v["path"] == CLEAN.get(path, path)), None)
        if not v or v["kind"] != "video": continue
        w = [(y["start"], y["end"]) for s_ in json.load(open(words_json(v)))["segments"] for y in s_.get("words", [])]
        if not w: continue
        others = [y for y in used[x["src"]] if y is not x]
        free = lambda a0, b0: all(b0 <= y["in"] + 0.01 or a0 >= y["out"] - 0.01 for y in others)
        prev = segs[i - 1] if i else None; nxt = segs[i + 1] if i + 1 < len(segs) else None
        a0, b0 = x["in"], x["out"]
        if not (prev and prev["src"] == x["src"] and abs(prev["out"] - x["in"]) < 0.05):
            na = a0
            while True:
                c = [s0 for s0, e0 in w if s0 < na - 0.02 and e0 > na - 0.6 and s0 > a0 - 6]
                if not c: break
                na = min(c)
            na = max(0.0, na - 0.15)
            if na < a0 - 0.02 and free(na, a0): x["in"] = round(na, 3)
        if not (nxt and nxt["src"] == x["src"] and abs(nxt["in"] - x["out"]) < 0.05):
            nb = b0; capped = False
            while True:
                c = [e0 for s0, e0 in w if e0 > nb + 0.02 and s0 < nb + 0.6]
                if not c: break
                if max(c) >= b0 + 15: capped = True; break
                nb = max(c)
            if capped:
                ends = [e0 for s0, e0 in w if b0 - 0.05 <= e0 <= nb and not any(e0 < s1 < e0 + 0.45 for s1, _ in w)]
                nb = max(ends) if ends else b0
            nb = min(nb + 0.25, fdur(path) - 0.05)
            if nb > b0 + 0.02 and free(b0, nb): x["out"] = round(nb, 3)
        # перебивки и плашки живут во времени исходника — при сдвиге края их не двигаем


VMODE = lambda: CFG.get("vertical_mode", "blur")             # "crop" — полоса 16:9 без размытого фона (как фото still1)
VMODE_KEY = lambda: "" if VMODE() == "blur" else f"|{VMODE()}|люди"   # прежний режим — прежние имена копий; crop — полоса по людям


def vertical_main():
    """Вертикальный кусок главной дорожки → 16:9 со звуком (vertical_render.py скилла по vertical_jobs_<tag>.json):
    CFG["vertical_mode"] = "blur" (по умолчанию, на размытом фоне) или "crop" (полоса 16:9 по людям — верх самой высокой фигуры − 5 %,
    crop_band.py; без людей — центр на 42 % высоты; у отрезка можно задать sg["vcrop_y"] — доля высоты центра полосы)."""
    jobs = []
    for sg in plan["segments"]:
        path = plan["sources"][sg["src"]]; v = next((v for v in INV if v["path"] == path), None)
        if not v or v["kind"] != "video": continue
        if not ((v.get("w", 1) < v.get("h", 1)) ^ (abs(v.get("rot") or 0) == 90)): continue
        yk = f"|y{float(sg['vcrop_y']):.2f}" if VMODE() == "crop" and sg.get("vcrop_y") is not None else ""
        h = hashlib.md5(f"{path}|{sg['in']:.3f}|{sg['out']:.3f}{VMODE_KEY()}{yk}".encode()).hexdigest()[:10]
        out = os.path.join(HERE, "вертикальные", f"{h}.mp4")
        jobs.append({"src": path, "in": sg["in"], "dur": round(sg["out"] - sg["in"], 3), "out": out, "mode": VMODE(),
                     "y": float(sg["vcrop_y"]) if sg.get("vcrop_y") is not None else "auto"})   # auto — по людям (crop_band), без людей — 42 %
        if os.path.exists(out):
            off = sg["in"]; sg["src"] = src(out); sg["in"], sg["out"] = 0.0, round(sg["out"] - off, 3)
            for o in sg.get("broll", []) + sg.get("cards", []):
                o["at"] = round(o["at"] - off, 3)
    mem = os.path.join(HERE, "память")
    for sg in plan["segments"]:
        for o in sg.get("broll", []):
            if o.get("fit") != "contain" or _under(o["file"], mem): continue
            h = hashlib.md5(f"{o['file']}|{o['in']:.3f}|{o['dur']:.3f}|br{VMODE_KEY()}".encode()).hexdigest()[:10]
            out = os.path.join(HERE, "вертикальные", f"{h}.mp4")
            jobs.append({"src": o["file"], "in": o["in"], "dur": round(o["dur"] + 0.2, 3), "out": out, "mode": VMODE()})
            if os.path.exists(out): o["file"], o["in"], o["fit"] = out, 0.0, "cover"
    json.dump(jobs, open(_p(job_path("vertical_jobs"), True), "w"), ensure_ascii=False, indent=1)
    print(f"вертикальных на главной: {len(jobs)}, готовых {sum(os.path.exists(j['out']) for j in jobs)}")


BLEEP_DONE = []
def bleeps(items):
    """Бранное слово — без звука, поверх «пи». items: [(день, ключ, начало слова)]."""
    segs = plan["segments"]
    for d, k, word in items:
        path = find(d, k)["path"]
        for _, a0, b0 in [x for x in words(d, k) if x[0].startswith(tok(word)[:4])]:
            sg = next((x for x in segs if CLEAN.get(plan["sources"][x["src"]], plan["sources"][x["src"]]) == path and x["in"] <= a0 and b0 <= x["out"]), None)
            if sg is None: continue
            a0, b0 = a0 - 0.03, min(b0, a0 + 0.9) + 0.03; i = segs.index(sg)   # распознавание растягивает слово до 2+ с — пи не длиннее слова
            L, M, R = copy.deepcopy(sg), copy.deepcopy(sg), copy.deepcopy(sg)
            L["out"] = round(a0, 3); M["in"], M["out"] = round(a0, 3), round(b0, 3); R["in"] = round(b0, 3)
            L["xd_out"] = 0; M["xd_out"] = 0; M["gain_db"] = -60; M["note"] = sg["note"] + " (пи)"; R["note"] = sg["note"] + " (после пи)"
            for part in (L, M, R):
                part["broll"] = [dict(o, at=max(o["at"], part["in"]), dur=round(min(o["at"] + o["dur"], part["out"]) - max(o["at"], part["in"]), 3),
                                      **{"in": round(o.get("in", 0) + max(0, part["in"] - o["at"]), 3)})
                                 for o in sg.get("broll", []) if min(o["at"] + o["dur"], part["out"]) - max(o["at"], part["in"]) > 0.05]
                part["cards"] = [c for c in sg.get("cards", []) if part["in"] <= c["at"] < part["out"]]
            segs[i:i + 1] = [x for x in (L, M, R) if x["out"] - x["in"] > 0.04]
            BLEEP_DONE.append((word, round(a0, 2), M))


def mute_words(day, key, phrase):
    """Неверный факт в живой речи: фразу — без звука (поверх титр-поправка), отрезок делится на три."""
    path = find(day, key)["path"]; a0 = at(day, key, phrase) - 0.05; b0 = at(day, key, phrase, a0, edge="end") + 0.05
    segs = plan["segments"]; sg = next(x for x in segs if plan["sources"][x["src"]] == path and x["in"] <= a0 and b0 <= x["out"])
    i = segs.index(sg); L, M, R = copy.deepcopy(sg), copy.deepcopy(sg), copy.deepcopy(sg)
    L["out"] = round(a0, 3); M["in"], M["out"] = round(a0, 3), round(b0, 3); R["in"] = round(b0, 3)
    L["xd_out"] = M["xd_out"] = 0; M["gain_db"] = -60; M["ambient"] = True; M["note"] = sg["note"] + " (часть 2)"; R["note"] = sg["note"] + " (часть 3)"
    for part in (L, M, R):
        part["cards"] = [c for c in sg.get("cards", []) if part["in"] <= c["at"] < part["out"]]; part["fixed"] = True
    segs[i:i + 1] = [x for x in (L, M, R) if x["out"] - x["in"] > 0.04]


def cut_words(day, key, after_phrase, before_phrase):
    """Вырезать живую речь между концом after_phrase и началом before_phrase (отрезок → два, встык без растворения)."""
    path = find(day, key)["path"]; a0 = at(day, key, after_phrase, edge="end") + 0.08; b0 = at(day, key, before_phrase, a0) - 0.1
    segs = plan["segments"]; sg = next(x for x in segs if plan["sources"][x["src"]] == path and x["in"] <= a0 and b0 <= x["out"])
    i = segs.index(sg); L, R = copy.deepcopy(sg), copy.deepcopy(sg)
    L["out"] = round(a0, 3); R["in"] = round(b0, 3); L["xd_out"] = 0; R["note"] = sg["note"] + " (после вырезки)"
    for part in (L, R):
        part["cards"] = [c for c in sg.get("cards", []) if part["in"] <= c["at"] < part["out"]]; part["fixed"] = True
    segs[i:i + 1] = [L, R]


def no_flashes():
    """Ни один план на экране не короче 2 с (кроме тизера и «пи»)."""
    for x in plan["segments"]:
        if x["note"].startswith(CFG["teaser"]) or "(пи)" in x["note"]: continue
        br = sorted([o for o in x.get("broll", []) if o["dur"] >= 2.0], key=lambda o: o["at"])
        for o, nxt in zip(br, br[1:]):
            g = nxt["at"] - (o["at"] + o["dur"])
            if 0.01 < g < 2.0: o["dur"] = round(o["dur"] + g, 3)
        if br:
            o = br[-1]; g = x["out"] - (o["at"] + o["dur"])
            if 0.01 < g < 2.0: o["dur"] = round(o["dur"] + g, 3)
            g = br[0]["at"] - x["in"]
            if 0.01 < g < 2.0 and "рассказ:" not in x["note"]:
                br[0]["in"] = round(max(0.0, br[0].get("in", 0) - g), 3); br[0]["dur"] = round(br[0]["dur"] + g, 3); br[0]["at"] = x["in"]
        x["broll"] = br


def exit_marks(chips):
    """Выход из воспоминания: «вжух» и плашка слева вверху — где и когда мы сейчас. chips: {префикс заметки живого плана: (дата, место)}."""
    segs = plan["segments"]
    for i in range(len(segs) - 1):
        a_, b_ = segs[i], segs[i + 1]
        if "рассказ:" not in a_["note"] or "рассказ:" in b_["note"]: continue
        b_["exit_mark"] = True
        ch = next((v for k, v in chips.items() if b_["note"].startswith(k)), None)
        if ch and b_["out"] - b_["in"] >= 3.5:
            f = card("блок", f"{CFG['tag']} выход {ch[0]} · {ch[1]}", ch[0], ch[1])
            b_["cards"] = [c for c in b_.get("cards", []) if "/место " not in c["file"]]
            ex = {"at": round(b_["in"] + 0.3, 3), "dur": round(min(3.6, b_["out"] - b_["in"] - 0.4), 3), "file": f}
            for c in b_["cards"]:
                if not c.get("pip") and c["at"] < ex["at"] + ex["dur"]:
                    sh = ex["at"] + ex["dur"] + 0.2 - c["at"]; c["at"] = round(c["at"] + sh, 3); c["dur"] = round(min(c["dur"], b_["out"] - c["at"]), 3)
            b_["cards"].append(ex)


def has_speech(path, a0, b0):
    path = CLEAN.get(path, path)
    VERT = {j["out"]: (j["src"], j["in"]) for j in _load(job_path("vertical_jobs"), [])}
    if path in VERT: path, off = VERT[path]; a0, b0 = a0 + off, b0 + off
    v = next((v for v in INV if v["path"] == path), None)
    if not v: return False
    js = f"{SPEECH}/д{v['day']}/{v['cam']}/{os.path.basename(path)[:-4]}.json"
    if not os.path.exists(js):
        if v.get("kind") != "video": return False
        js = words_json(v)
    tot = 0.0
    for x in json.load(open(js))["segments"]:
        t = x["text"].strip()
        if len(t) < 8 or "Продолжение следует" in t or "Субтитры" in t: continue
        tot += max(0.0, min(b0, x["end"]) - max(a0, x["start"]))
    return tot >= 0.15 * (b0 - a0)


SPEECH_LUFS = -14.0
FOREIGN = re.compile("|".join(map(re.escape, F.c.get("foreign") or [])) or "$^", re.I)   # подстроки пути, не регулярки
def origin(path):
    """Исходник копии: очищенный звук (CLEAN) и вертикальные (vertical_jobs) — к оригиналу; копия в тени — к месту."""
    path = CLEAN.get(path, path)
    if SHADOW and _under(path, SHADOW): path = path[len(SHADOW.rstrip("/")):]
    VERT = {j["out"]: j["src"] for j in _load(job_path("vertical_jobs"), [])}
    return VERT.get(path, path)


def foreign(path):
    """Чужой смонтированный ролик или любой исходник не с поездки: расшифровок нет, has_speech молчит, звук не наш.
    Своё — всё под папкой исходников (film.json "sources") и под папкой подготовки."""
    o = origin(path)
    mine = o.startswith(ROOT.rstrip("/") + "/") or _under(o, PREP)
    return bool(FOREIGN.search(o if SHADOW and _under(path, SHADOW) else path) or FOREIGN.search(o) or not mine)


def loudness():
    """Речь к −14 LUFS, живой фон места к −26; заглушённый план без речи — живой звук места вместо тишины."""
    LC = DATA + "/громкость_отрезков.json"; lc = _load(LC, {})
    PK = DATA + "/пики_отрезков.json"; pk = _load(PK, {})
    for sg in plan["segments"]:
        path = plan["sources"][sg["src"]]; tech = _under(path, MAPS) or _under(path, REELS) or _under(path, CARDS) or foreign(path)
        if sg["note"].startswith(CFG["intro"] + (CFG["teaser"],)) or tech or sg.get("ambient"): continue
        if (sg.get("gain_db", 0) or 0) <= -40 and not has_speech(path, sg["in"], sg["out"]):
            sg["gain_db"] = 0; sg["ambient"] = True
        elif (sg.get("gain_db", 0) or 0) > -40 and not has_speech(path, sg["in"], sg["out"]):
            sg["ambient"] = True
    for sg in plan["segments"]:
        if (sg.get("gain_db", 0) or 0) <= -40: continue
        path = plan["sources"][sg["src"]]; key = f"{path}|{sg['in']}|{sg['out']}"
        if key not in pk:                                  # громкость и истинный пик отрезка
            r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-ss", str(sg["in"]), "-t", str(sg["out"] - sg["in"]), "-i", path,
                                "-map", "0:a:0", "-af", "ebur128=framelog=quiet:peak=true", "-f", "null", "-"], capture_output=True, text=True)
            m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr); p = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", r.stderr)
            lc[key] = float(m[-1]) if m else None; pk[key] = float(p[-1]) if p and p[-1] != "-inf" else None
        lu = lc.get(key)
        if lu is not None and lu > -70:
            g = min(20.0, 10 ** (((-26.0 if sg.get("ambient") else SPEECH_LUFS) - lu) / 20))
            sg["loud_gain"] = round(max(g, 0.05), 3); sg["lufs"] = lu
    if not SHADOW: os.makedirs(DATA, exist_ok=True)
    json.dump(lc, open(_p(LC, True), "w"), ensure_ascii=False); json.dump(pk, open(_p(PK, True), "w"), ensure_ascii=False)


def gain(notes):
    """{префикс заметки: дБ} — тихий живой звук по проверке на слух."""
    for x in plan["segments"]:
        for k, d in notes.items():
            if x["note"].startswith(k) and x.get("loud_gain"): x["loud_gain"] = round(x["loud_gain"] * 10 ** (d / 20), 3)


def blur_substitute():
    """Посторонние крупным планом и номера машин — размытые заменители (размытие лиц → размытие/карта_sN.json; ручные записи —
    карта_ручная_sN.json, в т. ч. номера машин из plates.py jobs). Исключения лиц (исключения_sN.json) снимают только авто-записи:
    ручные (доразмыто руками, номера) — проверены глазами и идут мимо исключений. Кусок, переведённый на копию, уносит с собой
    якоря музыки и голоса. Повторный вызов безопасен: save() вызывает его ещё раз — края кусков, поправленные после первого
    вызова (join_runs и т. п.), тоже попадают на копии."""
    mp = os.path.join(HERE, "размытие", f"карта_{CFG['tag']}.json")    # своя карта серии
    manp = os.path.join(HERE, "размытие", f"карта_ручная_{CFG['tag']}.json")   # ручные подстановки — поверх авто
    if not any(os.path.exists(f) for f in (mp, manp, os.path.join(HERE, "размытие", "карта_ручная_общая.json"))): print("  размытие: карты серии нет"); return
    cmap = json.load(open(mp)) if os.path.exists(mp) else {}
    exf = os.path.join(HERE, "размытие", f"исключения_{CFG['tag']}.json")      # проверено глазами: размыты авторы или предметы
    EX = json.load(open(exf)) if os.path.exists(exf) else {}
    EX = {k: v for k, v in EX.items() if not isinstance(v, dict)}   # {"не размывать": [[с, по]]} — исключение по времени, его делает размытие лиц
    cmap = {k: v for k, v in cmap.items() if not any(N(e) in N(os.path.basename(k)) for e in EX)}
    CM = {}                                                         # ключ — NFC (имена на диске бывают NFD); порядок: ручная серии, общая, авто —
    comp = os.path.join(HERE, "размытие", "карта_ручная_общая.json")  # cover() берёт первую существующую копию, покрывающую кусок
    for f in (manp, comp):                                          # общая: общие куски всех серий (интро сериала, «ранее»), plates.py jobs --series общая
        if os.path.exists(f):
            for k, v in json.load(open(f)).items(): CM.setdefault(N(k), []).extend(v)
    for k, v in cmap.items(): CM.setdefault(N(k), []).extend(v)
    def cover(path, a0, b0):
        for a, b, out in CM.get(N(path), []):
            if a - 0.01 <= a0 and b0 <= b + 0.01 and os.path.exists(out) and N(out) != N(path): return a, out
    cues = plan["music"].get("cues", []) + plan["music"].get("sfx", [])
    n = 0
    for x in plan["segments"]:
        old = plan["sources"][x["src"]]; c = cover(old, x["in"], x["out"])
        if c:
            a, out = c; o_src, o_in, o_out = x["src"], x["in"], x["out"]
            x["src"] = src(out); x["in"] = round(x["in"] - a, 3); x["out"] = round(x["out"] - a, 3)
            for c_ in cues:                                          # музыка привязана к (источник, время) — переносим на копию
                for e in ("a", "b"):
                    if c_[e][0] == o_src and o_in - 0.01 <= c_[e][1] <= o_out + 0.01: c_[e] = [x["src"], round(c_[e][1] - a, 3)]
            for o in x.get("broll", []) + x.get("cards", []):
                o["at"] = round(o["at"] - a, 3)
                if o.get("pip") and "in" in o: o["in"] = round(o["in"] - a, 3)
            n += 1
        for o in x.get("broll", []):
            c = cover(o["file"], o.get("in", 0), o.get("in", 0) + o["dur"])
            if c: o["file"] = c[1]; o["in"] = round(o.get("in", 0) - c[0], 3); n += 1
    CFG["blur_done"] = True
    print("  размытие: заменено кусков", n)


def transitions_and_edges():
    segs = plan["segments"]
    for i, x in enumerate(segs[:-1]):
        n_ = segs[i + 1]; same = n_["src"] == x["src"]       # один план с пропуском — склейка: растворение даёт двойное изображение
        x["xd_out"] = 0 if (same or x["note"].startswith(CFG["teaser"]) or "(пи)" in x["note"] or "(пи)" in n_["note"]) else x.get("xd_out", 0.5)
    for i, x in enumerate(segs):
        if (x.get("gain_db", 0) or 0) <= -40 or x["note"].startswith(CFG["teaser"]): continue
        p_ = segs[i - 1] if i else None; n_ = segs[i + 1] if i + 1 < len(segs) else None
        if not (p_ and p_["src"] == x["src"] and abs(p_["out"] - x["in"]) < 0.05): x.setdefault("fade_in", 0.12)
        if not (n_ and n_["src"] == x["src"] and abs(n_["in"] - x["out"]) < 0.05): x.setdefault("fade_out", 0.2)


def dedupe_broll():
    """Повторная перебивка — сдвинуть на неиспользованный участок того же файла."""
    used = {}
    for x in plan["segments"]: used.setdefault(N(plan["sources"][x["src"]]), []).append((x["in"], x["out"]))
    for x in plan["segments"]:
        for o in sorted(x.get("broll", []), key=lambda o: o["at"]):
            k = N(o["file"]); a0 = o.get("in", 0); b0 = a0 + o["dur"]; U = used.setdefault(k, [])
            if any(min(b0, b) - max(a0, a) > 1.0 for a, b in U):
                L = fdur(o["file"]) - 0.1
                ok = [c for c in sorted([0.1] + [b + 0.3 for a, b in U]) if c + o["dur"] <= L and not any(min(c + o["dur"], b) - max(c, a) > 0.2 for a, b in U)]
                if ok: o["in"] = round(ok[0], 3); a0, b0 = o["in"], o["in"] + o["dur"]
            U.append((a0, b0))


def memory_look(date_chips, enter_card):
    """Перебивки под рассказом — тёплые копии «память» (memory_grade.py скилла по memory_jobs_<tag>.json),
    рассказчик — окошком слева внизу; «Вспоминаем» — на входе в первый рассказ; дата — на входе в каждый."""
    MEM = os.path.join(HERE, "память"); jobs = []; first = True
    for i, sg in enumerate(plan["segments"]):
        if "рассказ:" not in sg["note"]: continue
        srcp = plan["sources"][sg["src"]]; cards = list(sg.get("cards", []))
        prv = plan["segments"][i - 1]
        if first and sg.get("broll"):
            cards.append({"at": round(sg["in"] + 0.3, 3), "dur": round(min(3.6, sg["out"] - sg["in"] - 0.5), 3), "file": enter_card}); first = False
        elif "рассказ:" not in prv["note"] and not is_cont(sg["note"]):
            chip = next((t for k, t in date_chips.items() if sg["note"].startswith(k)), None)
            if chip:
                cards.append({"at": round(sg["in"] + 0.4, 3), "dur": round(min(3.6, sg["out"] - sg["in"] - 0.5), 3), "file": card("дата", f"дата {chip}", chip)})
        for o in sg.get("broll", []):
            if o["file"].lower().endswith((".png", ".jpg", ".jpeg")) or _under(o["file"], MAPS): continue
            _v = next((v for v in INV if v["path"] == o["file"]), None)          # вертикальный в «cover» — полоса по людям: новое имя копии
            _vt = bool(_v) and o.get("fit", "cover") != "contain" and ((_v.get("w", 1) < _v.get("h", 1)) ^ (abs(_v.get("rot") or 0) == 90))
            h = hashlib.md5(f"{o['file']}|{o['in']:.3f}|{o['dur']:.3f}|nodip{'|люди' if _vt else ''}".encode()).hexdigest()[:10]
            out = os.path.join(MEM, f"{h}.mp4")
            jobs.append({"src": o["file"], "in": max(0.0, o["in"] - 1.0), "dur": o["dur"] + 2.0, "out": out, "fit": o.get("fit", "cover"), "dip_at": None})
            o["orig"] = {"file": o["file"], "in": o["in"]}
            o["in"] = round(o["in"] - max(0.0, o["in"] - 1.0), 3); o["file"] = out; o["fit"] = "cover"
            cards.append({"at": o["at"], "dur": o["dur"], "file": srcp, "in": o["at"], "pip": {"x": 0.165, "y": 0.80, "scale": 0.27}})
        sg["cards"] = cards
    json.dump(jobs, open(_p(job_path("memory_jobs"), True), "w"), ensure_ascii=False, indent=1)
    ip = os.path.join(MEM, "источники.json")           # постоянный указатель «копия → исходник» (только дописывается): memory_jobs
    idx = _load(ip, {})                                 # перезаписывается каждой сборкой, а проверка «авторы размыты» смотрит старые версии
    idx.update({j["out"]: [j["src"], j["in"]] for j in jobs})
    if not SHADOW: os.makedirs(MEM, exist_ok=True)
    json.dump(idx, open(_p(ip, True), "w"), ensure_ascii=False, indent=0)
    print(f"воспоминания: перебивок {len(jobs)}, готовых {sum(os.path.exists(j['out']) for j in jobs)}")


# ---------------------------------------------------------------- музыка и звуки
def track(es, fallback):
    """Трек серии из «<музыка>/серия N/» (по части названия), пока его нет — временный из папки музыки."""
    d = MUSIC + f"серия {CFG['tag'][1:]}/"
    for f in sorted(glob.glob(d + "*")):
        if N(es).lower() in N(os.path.basename(f)).lower(): return f
    TEMP.add(f"{es} → временно {os.path.basename(fallback)}")
    return MUSIC + fallback


def seg_by(prefix, last=False):
    c = [x for x in plan["segments"] if x["note"].startswith(prefix)]
    if not c: raise SystemExit("нет отрезка " + prefix)
    return c[-1] if last else c[0]


def cue(name, file, first, last, level, fade_in=1.5, fade_out=3.0, src_in=0.0, a_off=0.0, bed_=False):
    f, l = seg_by(first), seg_by(last, True)
    plan["music"]["cues"].append({"name": name, "file": file, "src_in": src_in, "level_db": level, "fade_in": fade_in, "fade_out": fade_out,
                                  "a": [f["src"], f["in"] + a_off], "b": [l["src"], l["out"]], **({"bed": True} if bed_ else {})})


def voice(name, file, first, last=None, a_off=0.3, src_in=0.0):
    """Голос за кадром: уровень 20 (поверх −13 базы Filmora), без затуханий; конец — где кончается запись."""
    segs = plan["segments"]; i = next(k for k, x in enumerate(segs) if x["note"].startswith(first))
    rest = fdur(file) - src_in + 0.2; t = segs[i]["in"] + a_off; k = i
    while rest > segs[k]["out"] - t and k + 1 < len(segs):
        rest -= segs[k]["out"] - t; k += 1; t = segs[k]["in"]
    end = round(min(segs[k]["out"], t + rest), 3)
    plan["music"]["cues"].append({"name": name, "file": file, "src_in": src_in, "level_db": 20, "fade_in": 0.0, "fade_out": 0.3,
                                  "a": [segs[i]["src"], segs[i]["in"] + a_off], "b": [segs[k]["src"], end]})


def bed(name, file, first, last, level, src_in=0.0):
    """Подложка сцены; длинная — трек повторяется с начала (стык — затухание)."""
    segs = plan["segments"]
    a_i = next(i for i, x in enumerate(segs) if x["note"].startswith(first))
    b_i = max(i for i, x in enumerate(segs) if x["note"].startswith(last))
    L = music_end(file); room = L - src_in - 1.0; start, acc, piece = a_i, 0.0, 0
    def emit(st, en, si, firstp):
        plan["music"]["cues"].append({"name": f"{name} ({os.path.basename(file)[3:25]})", "file": file, "src_in": si, "level_db": level, "bed": True,
                                      "fade_in": 0.4 if firstp else 1.0, "fade_out": 3.0,
                                      "a": [segs[st]["src"], segs[st]["in"]], "b": [segs[en]["src"], segs[en]["out"]]})
    for k in range(a_i, b_i + 1):
        d = segs[k]["out"] - segs[k]["in"]
        if acc + d > room and k > start:
            emit(start, k - 1, src_in if piece == 0 else 0.0, piece == 0); piece += 1; start, acc = k, 0.0; room = L - 1.0
        acc += d
    emit(start, b_i, src_in if piece == 0 else 0.0, piece == 0)


_ME = {}
def music_end(file):
    """Где у трека кончается музыка: последняя секунда громче (пик − 18 дБ) — хвост-затухание в подложку не берём."""
    if file not in _ME:
        import numpy as np
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", file, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True).stdout
        a = np.frombuffer(raw, np.int16).astype(float) / 32768; n = len(a) // 8000
        db = [20 * np.log10(np.sqrt(np.mean(a[i * 8000:(i + 1) * 8000] ** 2)) + 1e-9) for i in range(n)]
        top = max(db); _ME[file] = float(max(i for i, d in enumerate(db) if d > top - 18) + 1)
    return _ME[file]


def part_beds(parts=None, tracks=None):
    """Музыка по частям дня — music_fit.beds по таблице «части_<tag>.json» (сцена → часть → трек) и разбору треков
    (film.json "tracks", готовит `film.py music`). Заменяет свои part_of()/part_beds() в сборщиках. Справочник — references/music.md.
    Таблицы или разбора нет — музыка не ставится, причина печатается и попадает в итог save()."""
    import music_fit as MF
    parts = parts or os.path.join(HERE, f"части_{CFG['tag']}.json"); tracks = tracks or F.p("tracks")
    if not os.path.exists(parts): TEMP.add(f"музыки нет: нет таблицы частей {os.path.basename(parts)}"); return []
    T = MF.load_tracks(tracks)
    if not T: TEMP.add(f"музыки нет: нет разбора треков {tracks} — film.py music"); return []
    cfg = json.load(open(parts, encoding="utf-8"))
    for p_, pc in list((cfg.get("parts") or {}).items()):   # пустое имя трека music_fit.find_track сочло бы любым треком разбора
        if not (pc or {}).get("track"): TEMP.add(f"музыки нет: у части «{p_}» не задан трек ({os.path.basename(parts)})"); cfg["parts"].pop(p_)
    cues, warn = MF.beds(plan, cfg, T)
    plan["music"]["cues"] += cues
    for w in warn: TEMP.add("музыка: " + w)
    print(f"  музыка по частям: подложек {len(cues)}" + (f", замечаний {len(warn)}" if warn else ""))
    return cues


def duck_beds(boost=12.0, min_run=4.0, duck=None):
    """Под речью подложка тихая; где никто не говорит (план без звука или только фон места) — громче на boost дБ.
    duck: {префикс заметки: дБ} — ещё тише там, где проверка на слух нашла тонущую речь."""
    if (plan.get("music") or {}).get("auto_level"):
        # автоуровни (render_plan + auto_level.py): уровень под речью и на видах ставит рендер по словам расшифровки;
        # нарезка трека на куски с затуханиями дала бы лишние стыки, а их level_db всё равно не берётся — подложка остаётся одним cue на сцену
        log.append("duck_beds: auto_level — подложки не режутся, ручные приглушения не применяются"); return
    duck = duck or {}
    dk = lambda m: -max([v for k, v in duck.items() if plan["segments"][m]["note"].startswith(k)] or [0.0])
    segs = plan["segments"]; T = []; t = 0.0
    for x in segs: T.append(t); t += x["out"] - x["in"]
    def pos(s_, tt):
        for i, x in enumerate(segs):
            if x["src"] == s_ and x["in"] - 0.01 <= tt <= x["out"] + 0.01: return i, T[i] + tt - x["in"]
    voice_ = [(pos(*c["a"])[1], pos(*c["b"])[1]) for c in plan["music"]["cues"] if c.get("level_db", 0) >= 20]
    def quiet(i):
        x = segs[i]; a0, b0 = T[i], T[i] + x["out"] - x["in"]
        if any(min(b0, vb) - max(a0, va) > 0.3 * (b0 - a0) for va, vb in voice_): return False
        return (x.get("gain_db", 0) or 0) <= -40 or bool(x.get("ambient"))
    out = []
    for c in plan["music"]["cues"]:
        if not c.get("bed"): out.append(c); continue
        ia, fa = pos(*c["a"]); ib, _ = pos(*c["b"]); runs = []; k = ia
        while k <= ib:
            q = quiet(k); j = k
            while j + 1 <= ib and quiet(j + 1) == q: j += 1
            runs.append([k, j, q]); k = j + 1
        for r in runs:
            if r[2] and sum(segs[m]["out"] - segs[m]["in"] for m in range(r[0], r[1] + 1)) < min_run: r[2] = False
        merged = []                                       # [i0, i1, сдвиг дБ]: +boost без речи, −duck там, где речь тонет
        for r in runs:
            for m in range(r[0], r[1] + 1):
                off = (boost if r[2] else 0.0) + dk(m)
                if merged and merged[-1][2] == off and merged[-1][1] == m - 1: merged[-1][1] = m
                else: merged.append([m, m, off])
        runs = merged
        if len(runs) == 1:
            c["level_db"] += runs[0][2]; out.append(c); continue
        for m_, (i0, i1, q) in enumerate(runs):
            st = fa if m_ == 0 else T[i0]
            out.append(dict(c, a=c["a"] if m_ == 0 else [segs[i0]["src"], segs[i0]["in"]], b=c["b"] if m_ == len(runs) - 1 else [segs[i1]["src"], segs[i1]["out"]],
                            src_in=round(c["src_in"] + st - fa, 3), level_db=round(c["level_db"] + q, 1),
                            fade_in=c["fade_in"] if m_ == 0 else 1.0, fade_out=c["fade_out"] if m_ == len(runs) - 1 else 1.0, name=c["name"] + (" ↑" if q > 0 else " ↓" if q < 0 else "")))
    plan["music"]["cues"] = out


def seg_with(src_path, t):
    for x in plan["segments"]:
        if plan["sources"][x["src"]] == src_path and x["in"] - 0.01 <= t <= x["out"] - 0.5: return x


def sound(kind):
    """Файл звука из film.json "sounds" (whoosh — «вжух», cash — «касса», bleep — «пи») в папке звуков; нет файла — None и строка в итоге."""
    p = SFX + dict(_film.DEFAULTS["sounds"], **(F.c.get("sounds") or {}))[kind]
    if os.path.exists(p): return p
    TEMP.add(f"звука нет: {p}"); return None


def sfx(name, file, src_path, t, dur, level):
    if not file: return None
    x = seg_with(src_path, t)
    if x is None: print("  звук вне плана:", name); return None
    plan["music"].setdefault("sfx", []).append({"name": name, "file": file, "src_in": 0.0, "level_db": level, "fade_in": 0.0, "fade_out": 0.2,
                                                "a": [x["src"], round(t, 3)], "b": [x["src"], round(min(t + dur, x["out"]), 3)]})
    return x


def whooshes():
    for i, x in enumerate(plan["segments"]):
        if x.get("exit_mark"):
            sfx("вжух выход " + x["note"][:16], sound("whoosh"), plan["sources"][x["src"]], x["in"], 1.6, 1)
        if "рассказ:" in x["note"] and x.get("broll") and not is_cont(x["note"]) and "рассказ:" not in plan["segments"][i - 1]["note"]:
            o = x["broll"][0]
            sfx("вжух " + x["note"][:20], sound("whoosh"), plan["sources"][x["src"]], max(x["in"], o["at"] - 0.25), 2.0, 3)


def prices(items):
    """[(день, ключ, фраза, после, сумма, пояснение)] — «касса» и жёлтая плашка в момент слов."""
    for d, k, ph_, after, amt, sub in items:
        try: t = at(d, k, ph_, after)
        except SystemExit as e: print("  цена не найдена:", e); continue
        p_ = find(d, k)["path"]; snd = sound("cash")
        x = sfx("касса " + amt, snd, p_, t, 2.2, 6) if snd else seg_with(p_, t)   # звука нет — плашка цены всё равно ставится
        if x is None and not snd: print("  цена вне плана:", amt)
        if x is not None:
            a_ = max(x["in"], min(t - 0.1, x["out"] - 3.2))
            x.setdefault("cards", []).append({"at": round(a_, 3), "dur": round(min(3.8, x["out"] - a_), 3), "file": card("цена", f"цена {amt} · {sub}", amt, sub)})


def cards_clear_of_pip():
    """Плашка не под окошком рассказчика (справка справа внизу длинной строкой уходила под окошко слева внизу).
    Заходит на окошко — та же плашка у верхнего края («…-верх»); не помогло или заходит на другую плашку —
    сборка плана падает. Геометрия общая с audit_cut (ОКНО)."""
    import overlay_geom as OG
    moved = {}
    for sg in plan["segments"]:
        for c, p in OG.clashes(sg):
            old = c["file"]
            if old not in moved:
                kind, name, lines = CARD_ARGS.get(old, (None, None, None))
                if not kind or kind.endswith("-верх") or kind not in ("место", "дата", "цена", "справка"):
                    raise SystemExit(f"плашка {os.path.basename(old)} на «{sg['note'][:40]}» заходит на окошко рассказчика — "
                                     "поставь её на другой отрезок или укороти строки")
                moved[old] = card(kind + "-верх", name + " верх", *lines)
                log.append(f"плашка над окошком рассказчика → вверх: {name}")
            for x in plan["segments"]:
                for cc in x.get("cards", []):
                    if cc["file"] == old and not cc.get("pip"): cc["file"] = moved[old]
        left = OG.clashes(sg)
        if left:
            raise SystemExit(f"плашка {os.path.basename(left[0][0]['file'])} на «{sg['note'][:40]}» и сверху заходит на окошко")
        cs = [c for c in sg.get("cards", []) if not c.get("pip") and c["file"].lower().endswith(".png")]
        for c in cs:
            if c["file"] not in moved.values(): continue
            for d in cs:
                if d is not c and min(c["at"] + c["dur"], d["at"] + d["dur"]) - max(c["at"], d["at"]) > 0.05 \
                        and OG.hit(OG.card_box(c["file"]), OG.card_box(d["file"])):
                    raise SystemExit(f"плашка {os.path.basename(c['file'])} наверху заходит на {os.path.basename(d['file'])} "
                                     f"на «{sg['note'][:40]}» — разведи их по времени")


# ---------------------------------------------------------------- перебивки из таблицы «мысль → кадр»
# Правило владельца (22.11.2026, на все фильмы): любой план ≥ 4 с; перебивка — только того, о чём говорят сейчас, одна на мысль,
# 4–6 с; нет кадра по теме — остаётся говорящий; лицо между перебивками < 4 с — вторую не ставить; фото неподвижно, ≥ 4 с,
# не больше одного подряд. Каталог, мысли, подбор и таблица для рецензента — shot_catalog.py.
CUT_NO_TOUCH = ("0.", "T.")          # интро сериала, «ранее», тизер — свой слой перебивок
CUT_MIN = 4.0


def cutaways(path, day):
    """Снять все перебивки с кусков (кроме интро/«ранее»/тизера) и поставить из таблицы path. day — день серии по умолчанию.
    Строка: {"note": префикс куска, "at": время исходника куска, "dur": 4–6, "day": день, "clip": ключ клипа | "photo": номер,
             "in": вход клипа, "words": слова под кадром, "see": что видно, "lock": причина закрытия (номер, чужое лицо, асфальт)}."""
    rows = json.load(open(path)) if os.path.exists(path) else []
    if not rows: raise SystemExit(f"cutaways: таблица перебивок пуста или нет файла — {path}")
    cleared = 0
    for x in plan["segments"]:
        if x["note"].startswith(CUT_NO_TOUCH): continue
        cleared += len(x.get("broll", [])); x["broll"] = []
        for k in ("keep", "dense", "keep_broll", "cover_all"): x.pop(k, None)
    for r in rows:
        x = S(r["note"]); d_ = int(r.get("day", day))
        if "photo" in r: f = ph(d_, int(r["photo"]), float(r["dur"]) + 0.3)[0]; i = 0.1
        else: f = rv(d_, r["clip"])[0]; i = float(r.get("in", 0.3))
        x.setdefault("broll", []).append({"file": f, "in": i, "at": float(r["at"]), "dur": float(r["dur"]), "fit": "cover"})
    for x in plan["segments"]: x["broll"] = sorted(x.get("broll", []), key=lambda o: o["at"])
    CFG["cutaways"] = path
    print(f"  перебивки из таблицы: снято {cleared}, поставлено {len(rows)} из {os.path.basename(path)}")
    return rows


def cutaways_check(P=None):
    """Находки по плану: перебивка < 4 с или за краем куска, лицо между перебивками < 4 с. Печатает save(), если стоял cutaways()."""
    P = P or plan; out = []; t = 0.0
    tc = lambda s_: f"{int(s_ // 60)}:{s_ % 60:04.1f}"
    for x in P["segments"]:
        d = x["out"] - x["in"]
        if not x["note"].startswith(CUT_NO_TOUCH):
            cur = x["in"]
            for o in sorted(x.get("broll", []), key=lambda o: o["at"]):
                if o["at"] < x["in"] - 0.05 or o["at"] + o["dur"] > x["out"] + 0.05: out.append(f"{tc(t + o['at'] - x['in'])} «{x['note']}»: перебивка за краем куска")
                if o["dur"] < CUT_MIN - 0.05: out.append(f"{tc(t + o['at'] - x['in'])} «{x['note']}»: перебивка {o['dur']:.1f} с < 4")
                g = o["at"] - cur
                if 0.05 < g < CUT_MIN - 0.05 and cur > x["in"] + 0.05: out.append(f"{tc(t + cur - x['in'])} «{x['note']}»: лицо между перебивками {g:.1f} с < 4")
                cur = max(cur, o["at"] + o["dur"])
        t += d
    return out


def save(out):
    if not plan["segments"]: raise SystemExit("в плане нет отрезков: сборщик не описал ни одной сцены")
    cards_clear_of_pip()
    for w, a0, M in BLEEP_DONE:
        if not sound("bleep"): continue
        plan["music"].setdefault("sfx", []).append({"name": "пи " + w, "file": sound("bleep"), "src_in": 0.0, "level_db": 20, "fade_in": 0.0, "fade_out": 0.01,
                                                    "a": [M["src"], M["in"]], "b": [M["src"], M["out"]]})
    for c in plan["music"].get("cues", []) + plan["music"].get("sfx", []):   # мастер −14 LUFS: музыка и голоса вместе с речью +2 дБ
        c["level_db"] = c.get("level_db", 0) + 2
    for x in plan["segments"]:
        x.pop("fixed", None)
    if CFG.get("blur_done"): blur_substitute()           # второй проход: края кусков, поправленные после первого вызова, — тоже на копии
    segs = plan["segments"]; T = []; t = 0.0              # звук привязан к (источник, время): первое вхождение должно быть тем самым местом
    for x in segs: T.append(t); t += x["out"] - x["in"]
    def pos(s_, tt):
        for i, x in enumerate(segs):
            if x["src"] == s_ and x["in"] - 0.01 <= tt <= x["out"] + 0.01: return T[i] + tt - x["in"]
    bad = [c["name"] for c in plan["music"]["cues"] + plan["music"].get("sfx", [])
           if pos(*c["a"]) is None or pos(*c["b"]) is None or pos(*c["b"]) - pos(*c["a"]) <= 0]
    if bad: raise SystemExit("звук не на месте (кадр повторён раньше в фильме?): " + ", ".join(bad))
    if CFG.get("cutaways"):                               # правила таблицы перебивок — до рецензента
        for f_ in cutaways_check(): print("  v20:", f_)
    json.dump(plan, open(out, "w"), ensure_ascii=False, indent=1)
    tot = sum(s["out"] - s["in"] for s in plan["segments"])
    print("\n".join(log))
    print(f"отрезков {len(plan['segments'])}, источников {len(plan['sources'])}, всего {tot / 60:.1f} мин")
    for t in sorted(TEMP): print("  МУЗЫКА ВРЕМЕННАЯ:" if "временн" in t else "  ВНИМАНИЕ:", t)
    if SHADOW:
        print(f"  проверочный прогон: записи библиотеки ушли в {SHADOW}" +
              (f"; плашек с прежней подписью titry (при обычной сборке перерисуются): {len(_STALE_CARDS)}" if _STALE_CARDS else ""))


# ---------------------------------------------------------------- общее интро серий и «ранее в сериале»
# Зритель, попавший на любую серию, сразу в курсе: «о чём поход» (запись интро, коротко) + «ранее в сериале» —
# по фразе на каждую прошедшую серию (фразы пишутся один раз, повторяются во всех следующих).
# Кадры — film.json: "intro" → "shots" и "recap" → {"серия": [...]}; сборщик может дополнить S.EPISODE_RECAP.update({...}).
_INTRO = F.c.get("intro") or {}
INTRO_SHOTS = [tuple(x) for x in _INTRO.get("shots") or []]          # (день | "map", ключ клипа | файл карты, от, до, заметка)
EPISODE_RECAP = {int(k): [tuple(x) for x in v] for k, v in (F.c.get("recap") or {}).items()}   # серия: [(день, ключ, от, длина, заметка)]


def intro_voice(name, note=True):
    cs = sorted(glob.glob(glob.escape(INTRO_VO + name) + " (чистовая*).wav"), key=os.path.getmtime)   # перерезано по правильным дублям
    if cs: return cs[-1]
    q = INTRO_VO + name + " (паузы ужаты).wav"                       # паузы внутри записи > 0,8 с — ужатая копия, если есть
    if os.path.exists(q): return q
    p = INTRO_VO + name + ".wav"
    if os.path.exists(p): return p
    if note: TEMP.add(f"голос «{name}» — временный синтез")
    return INTRO_VO + "временно (синтез — заменится вашей записью)/" + name + ".wav"


def _recaps(ep):
    """Серии, по которым «ранее» можно собрать: есть кадры и запись голоса. Остальные — строкой в итог."""
    out = []
    for e in range(1, ep):
        if e not in EPISODE_RECAP: TEMP.add(f"«ранее {e}» пропущено: нет кадров (film.json → recap → \"{e}\")"); continue
        if not os.path.exists(intro_voice(f"ранее — серия {e}", note=False)): TEMP.add(f"«ранее {e}» пропущено: нет записи «ранее — серия {e}.wav» в {INTRO_VO}"); continue
        out.append(e)
    return out


def serial_intro(ep):
    """Начало серии ep: интро сериала + «ранее» по сериям 1..ep-1. Заметки «0. интро: …», «0. ранее N: …».
    Голос и музыку ставит serial_intro_sound() после transitions_and_edges(). Интро не описано в film.json — пропуск."""
    if not INTRO_SHOTS: log.append("интро сериала не описано (film.json → intro → shots) — серия начинается со сцен"); return
    first = None
    for d, k, a, b, note in INTRO_SHOTS:
        sg = (file_seg(MAPS + "/" + (k or _INTRO.get("map") or ""), a, b, "0. интро: " + note) if d == "map"
              else clip(d, k, a, b, "0. интро: " + note, mute=True))
        sg["xd_out"] = 0.4; first = first or sg
    put(first, title_card(), 0.6, 5.0)
    put(first, episode_number_card(ep), 0.6, 5.0)
    last = max(_recaps(ep) or [0])
    for e in _recaps(ep):
        # голос с 0,3 с, после него ≥ 0,3 с кадра; последний блок уходит в живую сцену растворением 0,3 с — ещё 0,3 с, иначе
        # голос «ранее» ложится на первое слово сцены (audit_cut ГОЛОС)
        shots = EPISODE_RECAP[e]; need = fdur(intro_voice(f"ранее — серия {e}")) + (0.9 if e == last else 0.6)
        k_ = max(1.0, need / sum(du for *_, du, _n in shots))   # только растягивает: голос короче — блок не ужимать,
        # кадры ≥ 4 с, остаток закрывает музыка интро
        if min(du for *_, du, _n in shots) * k_ < 4.0:
            raise SystemExit(f"«ранее {e}»: под голос {need:.1f} с кадр короче 4 с (КОРОЧЕ 4 С) — меньше кадров в EPISODE_RECAP[{e}]")
        for d, key, a, du, note in shots:
            v = find(d, key); b = min(a + du * k_, v["dur"] - 0.2)
            if b - a < 4.0: raise SystemExit(f"«ранее {e}: {note}»: исходник кончается — план {b - a:.1f} с < 4 с")
            sg = clip(d, key, a, b, f"0. ранее {e}: {note}", mute=True); sg["xd_out"] = 0.3
        put_across(f"0. ранее {e}:", recap_card(e), 0.1, 3.2)   # порог audit_cut ПЛАШКА — 3 с; длина блока — по голосу


def serial_intro_sound(ep, level=7):
    """Голос интро и фраз «ранее» + сквозная музыка интро (film.json → intro: voice, voice_at, music, music_in)."""
    if not INTRO_SHOTS: return
    head = "0. интро: " + INTRO_SHOTS[0][4]
    v = INTRO_VO + (_INTRO.get("voice") or "интро сериала.wav")
    if os.path.exists(v): voice("интро сериала", v, head, a_off=float(_INTRO.get("voice_at", 0.5)))
    else: TEMP.add(f"голоса интро нет: {v}")
    for e in _recaps(ep):
        voice(f"ранее — серия {e}", intro_voice(f"ранее — серия {e}"), f"0. ранее {e}:", a_off=0.3)
    m = MUSIC + (_INTRO.get("music") or "")
    if _INTRO.get("music") and os.path.exists(m): bed("интро сериала", m, "0.", "0.", level, src_in=float(_INTRO.get("music_in", 0.0)))
    else: TEMP.add("музыки интро нет (film.json → intro → music)")


def end_card(note="T. концовка metravel.by", dur=5.0):
    """Концовка MeTravel последним отрезком: файл «концовка metravel.by <год>.mp4» в папке плашек (нет — рисует end_card.py скилла).
    Длина не 5 с — свой файл («… <год> 7с.mp4»): готовый пятисекундный длиннее не станет."""
    year = str(F.c.get("year") or time.strftime("%Y")); fonts = F.c.get("fonts") or {}
    real = f"{CARDS}/концовка metravel.by {year}" + ("" if abs(dur - 5.0) < 0.01 else f" {dur:g}с") + ".mp4"; out = _p(real)
    if not os.path.exists(out):
        out = _p(real, True); os.makedirs(os.path.dirname(out), exist_ok=True)
        env = dict(os.environ, **{k: v for k, v in (("FILM_FONT_END_BOLD", fonts.get("end_bold")), ("FILM_FONT_END", fonts.get("end"))) if v})
        r = subprocess.run([sys.executable, "-I", SK + "/end_card.py", out, year, f"{dur:.2f}"], capture_output=True, text=True, env=env)
        if r.returncode: raise SystemExit(f"концовка: {(r.stderr or r.stdout).strip()[-400:]}")
    return file_seg(out, 0, dur, note)
