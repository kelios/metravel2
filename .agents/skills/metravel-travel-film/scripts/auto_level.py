#!/usr/bin/env python3
"""Автоуровни музыки для render_plan.py (план: "music": {"auto_level": true}).

Правило владельца (16.11): под речью музыка слышна, но тихая — на 12–15 дБ ниже речи; на видах без слов —
в полную силу, к уровню речи фильма, без «крика»; приглушение отпускается с концом фразы; тихие вступления
треков на видах подтягиваются. Ручная поправка трека — "auto_adj_db" у cue, поверх автоматики.

Речь ищется по словам расшифровки (--words-root, как в audit_mix.py): по одной энергии не отличить разговор
от ветра и прибоя на виде. Голос за кадром — по дорожке голоса. Модуль без numpy: окна считает ffmpeg (astats).
"""
import array, json, math, os, re, struct, subprocess, sys, unicodedata

WIN = 0.1            # шаг огибающей, с
UNDER = 13.0         # музыка под речью ниже речи на столько дБ (цель рубрики 12–15)
VIEW_BELOW = 1.0     # на видах музыка ниже типичной речи фильма на столько дБ — в полную силу, но не громче речи
ATTACK, RELEASE = 0.4, 0.6   # приглушение начинается до первого слова и отпускается после последнего, с
GAP = 0.8            # паузы между словами короче этого — одна фраза
VO_GAP = 2.0         # голос за кадром: паузы между фразами короче этого — музыка не поднимается (s3 v14: «ранее», запас 9 дБ)
MAX_CUT, MAX_LIFT = 40.0, 12.0
# Голос за кадром (доозвучка, связки, «ранее») — как речь, но с потолком: музыка под ним не громче VO_TOP дБ по метрике
# audit_mix (моно ½(L+R), окна голоса). Рецензент 23.11, s5 v5b: под доозвучкой −27,6…−28,2 при норме владельца ≤ −32.
# Подхват — за VO_EDGE до голоса, отпуск — через VO_EDGE после. Запас VO_MARGIN — на разброс 3-секундной оценки.
VO_TOP, VO_EDGE, VO_MARGIN = -32.0, 0.3, 1.0
VO_PRE = 0.5   # потолок — от места файла голоса в плане за 0,5 с до начала (s6 v12: по энергии голоса приглушение опаздывало
               # на 0,15–0,5 с — тихий первый слог ниже порога, первые слова над −20…−28 дБ)


def rms_windows(path, win=WIN, half_sum=False, power=False):
    """RMS (дБ) по окнам win секунд, 8 кГц. Нет файла — [].
    power: как слышно в стерео-миксе — сумма мощностей каналов (моно-файл встаёт в микс на оба канала: +3 дБ).
      Так меряет громкость и ebur128 (без K-фильтра). Автоуровни меряют всё так: s6 v2 (рецензент 22.11) — музыка
      по моно-сумме ½(L+R) у широкого стерео тише на 3 дБ, чем звучит, и на видах выходила громче разговора.
    half_sum: стерео в моно как 0,5·(L+R) — так сведена дорожка `_музыка.wav` для audit_mix.py."""
    if not path or not os.path.exists(path):
        return []
    n = int(round(8000 * win))
    if power:
        r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", path, "-vn", "-af",
                            f"aresample=8000,asetnsamples=n={n}:p=0,astats=metadata=1:reset=1:measure_overall=none,"
                            "ametadata=print:key=lavfi.astats.1.RMS_level,ametadata=print:key=lavfi.astats.2.RMS_level",
                            "-f", "null", "-"], capture_output=True, text=True)
        out, cur = [], None
        for ch, v in re.findall(r"lavfi\.astats\.([12])\.RMS_level=(-?inf|-?[\d.]+)", r.stdout + r.stderr):
            p_ = 10 ** (max(float(v), -120.0) / 10)
            if ch == "1":
                if cur is not None: out.append(cur * 2)            # моно: на оба канала
                cur = p_
            else:
                out.append(cur + p_); cur = None
        if cur is not None: out.append(cur * 2)
        return [max(10 * math.log10(x + 1e-14), -120.0) for x in out]
    down = "pan=mono|c0=0.5*c0+0.5*c1" if half_sum else "aformat=channel_layouts=mono"
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", path, "-vn", "-af",
                        f"{down},aresample=8000,asetnsamples=n={n}:p=0,astats=metadata=1:reset=1,"
                        "ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"], capture_output=True, text=True)
    return [max(float(x), -120.0) for x in re.findall(r"lavfi\.astats\.Overall\.RMS_level=(-?inf|-?[\d.]+)", r.stdout + r.stderr)]


def energy(w, idx):
    idx = [i for i in idx if 0 <= i < len(w)]
    if not idx:
        return -120.0
    return 10 * math.log10(sum(10 ** (w[i] / 10) for i in idx) / len(idx) + 1e-12)


def _norm(x):
    return unicodedata.normalize("NFC", x)


TALK_MIN_WORDS, TALK_DENSITY = 3, 0.3   # разговор, а не вид: слов (длиннее 1 буквы) не меньше 3 и не реже 0,3 в секунду
# галлюцинации whisper на ветре и тишине (s3: «город сверху», «поля», «мол и маяк», «обед» — «субтитры создавал DimaTorzok»)
HALLU = re.compile(r"субтитр|dimatorzok|редактор\w* субтитр|продолжение следует|подписывайтесь на канал", re.I)


def real_words(wf):
    """Слова расшифровки без галлюцинаций whisper: фраза с HALLU и фраза из одного слова, повторённого ≥ 3 раз
    («мах мах мах» на ветряках). Общий источник слов для auto_level и audit_mix."""
    out = []
    for y in json.load(open(wf))["segments"]:
        ws = y.get("words", [])
        toks = [re.sub(r"[^\w]", "", x.get("word", "")).lower() for x in ws]
        if HALLU.search(y.get("text", "") + " " + " ".join(toks)) or (len(toks) >= 3 and len(set(toks)) == 1):
            continue
        out += ws
    return out


def is_talk(nwords, dur):
    """Отрезок — разговор (короткие реплики «фух, хорошо», «пока-пока» — тоже, рецензент 22.11).
    Общий порог с audit_mix.py (ЗАПАС, ТОНЕТ): рендер и проверка одинаково решают, где речь."""
    return nwords >= TALK_MIN_WORDS and nwords >= dur * TALK_DENSITY


def live_speech(segs, words_root, alias):
    """Отрезки-разговоры на шкале фильма целиком: [(начало, конец)]. segs: [(src_path, in, out, film_start, k, muted)].
    Целиком, а не по словам: в паузе между фразами музыка не должна вставать до уровня вида (s3 v14 — запас 4–9 дБ)."""
    idx = {}
    for dp, _, fs in os.walk(words_root):
        for f in fs:
            if f.endswith(".words.json") and not f.startswith("._"):
                idx[_norm(f[:-11])] = os.path.join(dp, f)
    cache, iv = {}, []
    for p, a, b, t0, k, muted in segs:
        if muted:
            continue
        off = 0.0
        if p in alias:
            p, off = alias[p][0], float(alias[p][1])
        wf = idx.get(_norm(os.path.splitext(os.path.basename(p))[0]))
        if not wf:
            continue
        if wf not in cache:
            cache[wf] = [(x["start"], re.sub(r"[^\w]", "", x.get("word", ""))) for x in real_words(wf)]
        nw = sum(1 for ws, w in cache[wf] if a + off <= ws < b + off and len(w) > 1)
        if is_talk(nw, (b - a) * k):
            iv.append((t0, t0 + (b - a) * k))
    return [(s, e) for s, e in sorted(iv)]


def merge(iv, gap=GAP):
    out = []
    for s, e in sorted(iv):
        if out and s - out[-1][1] < gap:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [(s, e) for s, e in out]


VIEW_BED = 7.0       # живой звук вида (прибой, ветер) уже у цели — музыка фоном на столько дБ ниже
VIEW_FLOOR = -27.0   # и не тише этого (мощность стерео; ½(L+R) широкого трека на 3–6 дБ тише): ПРОВАЛ audit_mix — тише −35 дБ
SPEECH_MIN = -42.0   # окно речи громче этого (−45 у audit_mix по моно-сумме + 3 дБ мощности стерео)


def view_music(target, live_db):
    """Уровень музыки на виде: в цель target метится сумма «музыка + живой звук» (энергетически), а не одна музыка —
    s6 v2 (рецензент 22.11): прибой и ветер плюс музыка к уровню речи дали виды −12.4 LUFS при разговоре −13.0
    и фильм −12.5. Музыке остаётся target минус живой звук; когда живой звук сам у цели — фоном
    min(живой, цель) − VIEW_BED; не тише VIEW_FLOOR."""
    room = 10 ** (target / 10) - 10 ** (live_db / 10)
    need = 10 * math.log10(room) if room > 1e-12 else -120.0
    return max(need, min(live_db, target) - VIEW_BED, VIEW_FLOOR)


def speech_windows(w, rng):
    """Окна речи: громче SPEECH_MIN и не тише максимума отрезка на 20 дБ — как speech_mask в audit_mix.py."""
    rng = [i for i in rng if 0 <= i < len(w)]
    top = max((w[i] for i in rng), default=-120.0)
    on = [i for i in rng if w[i] > SPEECH_MIN and w[i] >= top - 20]
    return on or rng


def envelope(n, music, live, voice, speech_iv, adj, caps=(), vo_plan=()):
    """Усиление музыки (дБ) по окнам WIN. music/live/voice — RMS окон; speech_iv — отрезки-разговоры; adj — [(t0, t1, дБ)].
    Уровень речи — свой у каждого разговора и каждой фразы голоса за кадром (энергия в окнах речи, как меряет audit_mix);
    музыка под ней — на UNDER ниже по 3-секундной громкости трека."""
    at = lambda w, i: w[i] if i < len(w) else -120.0
    win = lambda s, e: range(max(0, int(s / WIN)), min(n, int(math.ceil(e / WIN))))
    spans = [(win(s, e), live) for s, e in speech_iv]
    vo_iv = merge([(i * WIN, (i + 1) * WIN) for i in range(n) if at(voice, i) > SPEECH_MIN], VO_GAP)
    spans += [(win(s, e), voice) for s, e in vo_iv]
    h = int(1.5 / WIN)
    loc = lambda i, lo, hi: energy(music, range(max(lo, i - h), min(hi, i + h)))
    talk, levels = [None] * n, []
    for rng, w in spans:
        if not rng:
            continue
        e_ = int(0.5 / WIN)                                                    # края (растворение 0,3–0,5 с) звучат соседом: немой
        inner = range(rng.start + e_, rng.stop - e_) if len(rng) > 4 * e_ else rng   # «Сергей под мостом» (s6) мерил речь по соседу
        on = set(speech_windows(w, inner))
        lv = energy(w, on)
        if lv < SPEECH_MIN:                          # речь в расшифровке, а в звуке тихо (заглушено планом) — не приглушать
            continue
        levels.append(lv)
        for i in rng:                                # речь рядом (±1,5 с): тихая фраза в громком блоке — своя музыка;
            near = [q for q in range(max(rng.start, i - h), min(rng.stop, i + h)) if q in on]
            lvi = energy(w, near) if len(near) >= 5 else lv   # в паузе (речи рядом < 0,5 с) — уровень всего отрезка, без подъёма до вида
            lm = loc(i, rng.start, rng.stop)
            g = 0.0 if lm < -70 else max(-MAX_CUT, min(MAX_LIFT, (lvi - UNDER) - lm))
            talk[i] = g if talk[i] is None else min(talk[i], g)   # голос за кадром поверх разговора — по тихому
    ref = sorted(levels)[len(levels) // 2] if levels else -20.0   # типичная речь фильма
    tgt, i = [0.0] * n, 0
    while i < n:                                     # виды: к уровню речи фильма по 3-секундной громкости трека
        if talk[i] is not None:
            tgt[i] = talk[i]; i += 1; continue
        j = i
        while j < n and talk[j] is None:
            j += 1
        for q in range(i, j):
            lm = loc(q, i, j)
            lb = energy(live, range(max(i, q - h), min(j, q + h)))
            tgt[q] = 0.0 if lm < -70 else max(-MAX_CUT, min(MAX_LIFT, view_music(ref - VIEW_BELOW, lb) - lm))
        i = j
    a_, r_ = int(ATTACK / WIN), int(RELEASE / WIN)    # приглушение заранее и отпуск после фразы: минимум по окну
    g1 = [min(tgt[max(0, i - r_):min(n, i + a_ + 1)]) for i in range(n)]
    m = int(0.4 / WIN)                                # сглаживание 0,4 с — без щелчков и «качелей»
    acc, g2 = 0.0, []
    pref = [0.0]
    for x in g1:
        acc += x; pref.append(acc)
    for i in range(n):
        lo, hi = max(0, i - m // 2), min(n, i + m // 2 + 1)
        g2.append((pref[hi] - pref[lo]) / (hi - lo))
    for t0, t1, db in adj:                            # ручная поправка трека поверх автоматики
        for i in range(max(0, int(t0 / WIN)), min(n, int(math.ceil(t1 / WIN)))):
            g2[i] += db
    # потолок под голосом за кадром: music меряется мощностью стерео (power=True) — это до +3 дБ к моно ½(L+R) audit_mix
    for s0, e0 in list(vo_iv) + [(a_ - (VO_PRE - VO_EDGE), b_) for a_, b_ in vo_plan]:   # по энергии и по месту файла в плане
        for i in range(max(0, int((s0 - VO_EDGE) / WIN)), min(n, int(math.ceil((e0 + VO_EDGE) / WIN)))):
            if at(music, i) > -70: g2[i] = min(g2[i], VO_TOP - VO_MARGIN + 3.0 - loc(i, 0, n))
    for t0, t1, top in caps:                          # потолок музыки под речью (аккордеон, 23.11): уровень трека + усиление ≤ top
        for i in range(max(0, int(t0 / WIN)), min(n, int(math.ceil(t1 / WIN)))):
            if talk[i] is not None and at(music, i) > -70: g2[i] = min(g2[i], top - loc(i, 0, n))
    return g2, ref


def write_ctrl(gains_db, path, rate=1000):
    """Множитель громкости как моно-WAV float32 (rate Гц, линейно между окнами): ffmpeg amultiply."""
    step = int(rate * WIN)
    lin = [10 ** (g / 20) for g in gains_db] + [10 ** (gains_db[-1] / 20) if gains_db else 1.0]
    ramp = [j / step for j in range(step)]
    buf = array.array("f", [a + (b - a) * r for a, b in zip(lin, lin[1:]) for r in ramp])   # 40 мин — 2,4 млн отсчётов
    if sys.byteorder != "little":
        buf.byteswap()
    n = len(buf)
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + n * 4) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 3, 1, rate, rate * 4, 4, 32)
                + b"data" + struct.pack("<I", n * 4))
        f.write(buf.tobytes())
