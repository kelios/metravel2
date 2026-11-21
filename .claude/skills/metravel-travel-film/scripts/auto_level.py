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
MAX_CUT, MAX_LIFT = 40.0, 12.0


def rms_windows(path, win=WIN, half_sum=False):
    """RMS (дБ) по окнам win секунд, моно 8 кГц. Нет файла — [].
    half_sum: стерео в моно как 0,5·(L+R) — так сведена дорожка `_музыка.wav`, которую слушает audit_mix.py;
    без этого музыка меряется иначе, чем её потом проверяют (некоррелированное стерео — до 3 дБ разницы)."""
    if not path or not os.path.exists(path):
        return []
    n = int(round(8000 * win))
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


def live_speech(segs, words_root, alias):
    """Интервалы живой речи на шкале фильма по словам исходников. segs: [(src_path, in, out, film_start, k, muted)]."""
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
            cache[wf] = [(x["start"], x.get("end", x["start"] + 0.3)) for y in json.load(open(wf))["segments"] for x in y.get("words", [])]
        for ws, we in cache[wf]:
            if a + off <= ws < b + off:
                iv.append((t0 + (ws - off - a) * k, t0 + (min(we, b + off) - off - a) * k))
    return merge(iv)


def merge(iv, gap=GAP):
    out = []
    for s, e in sorted(iv):
        if out and s - out[-1][1] < gap:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [(s, e) for s, e in out]


def envelope(n, music, live, voice, speech_iv, adj):
    """Усиление музыки (дБ) по окнам WIN. music/live/voice — RMS окон; speech_iv — живая речь; adj — [(t0, t1, дБ)]."""
    at = lambda w, i: w[i] if i < len(w) else -120.0
    talk = [False] * n
    for s, e in speech_iv:
        for i in range(max(0, int(s / WIN)), min(n, int(math.ceil(e / WIN)))):
            talk[i] = True
    vo_iv = merge([(i * WIN, (i + 1) * WIN) for i in range(n) if at(voice, i) > -45])
    for s, e in vo_iv:
        for i in range(max(0, int(s / WIN)), min(n, int(math.ceil(e / WIN)))):
            talk[i] = True
    runs, i = [], 0                                     # фразы: подряд идущие окна речи
    while i < n:
        j = i
        while j < n and talk[j] == talk[i]:
            j += 1
        runs.append((i, j, talk[i]))
        i = j
    levels = []
    for i0, i1, sp in runs:
        if sp:
            rng = range(i0, i1)
            lv = max(energy(live, rng), energy(voice, rng))
            levels.append(lv)
    ref = sorted(levels)[len(levels) // 2] if levels else -20.0   # типичная речь фильма
    tgt = [0.0] * n
    for i0, i1, sp in runs:
        if sp:
            rng = range(i0, i1)
            lv = max(energy(live, rng), energy(voice, rng))
            lm = energy(music, rng)
            g = 0.0 if lm < -70 else (lv - UNDER) - lm
            for i in rng:
                tgt[i] = max(-MAX_CUT, min(MAX_LIFT, g))
        else:
            h = int(1.5 / WIN)                       # вид: к уровню речи фильма по 3-секундной громкости трека
            for i in range(i0, i1):
                lm = energy(music, range(max(i0, i - h), min(i1, i + h)))
                tgt[i] = 0.0 if lm < -70 else max(-MAX_CUT, min(MAX_LIFT, (ref - VIEW_BELOW) - lm))
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
