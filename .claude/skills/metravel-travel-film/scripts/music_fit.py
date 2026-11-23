#!/usr/bin/env python3
"""Музыка по времени: разбор треков, подложки по частям дня, склейки видов на доли, проверка музыки плана.

  music_fit.py analyze <папка|трек …> [--out музыка.json]
      Разбор каждого трека один раз (кеш по размеру и дате файла): длина, теги Epidemic Sound (жанр, настроение, энергия,
      темп), громкие окна (≥ 8 с не тише p90 − 10 дБ — то, что раньше вписывали в PARTS руками), вступление и концовка,
      кульминация (самые громкие 8 с), доли и сильные доли, доля средних частот (аккордеон и скрипка «кричат» громче
      замера). Запуск: uv run -q --with numpy python music_fit.py analyze "6 музыка/серия 5"
  music_fit.py beds <plan.json> --parts части.json --tracks музыка.json --out <plan_новый.json> [--replace]   (--out — только новое имя)
      Подложки по частям дня (владелец 16.11: музыка — по логическим частям, не «трек на сцену»). Подряд идущие планы
      одной части — одна подложка из громких окон трека; окно кончилось — следующее с наложением 1 с; при возвращении
      часть продолжает трек с места остановки. Вход трека — на сильную долю; "peak_on" ставит кульминацию трека на
      начало названного плана (полёт, титр). --replace убирает прежние подложки ("bed": true) плана.
  music_fit.py snap <plan.json> --tracks музыка.json --out <plan_новый.json> [--max 0.35] [--min-len 4]
      Склейки между видами (планы без речи под одной подложкой) сдвигаются на сильную долю, а если её нет в пределах
      сдвига — на ближайшую долю; склейка, уже стоящая в долю, не трогается. Не дальше --max секунд,
      план не короче --min-len, удлинение — только в пределах исходника. Речь, перебивки, плашки и планы с "fixed"
      не трогаются. Печатает, сколько склеек попадало в долю до и после.
  music_fit.py check <plan.json> [--tracks музыка.json] [--others <plan другой серии> …]
                     [--segments <фильм.segments.json> --music <фильм_музыка.wav>] [--shared "0." …] [--out отчёт.md]
      ВХОД       подложка на виде начинается в тихом месте трека (вне громких окон) — на виде будет «провал»
      КОНЕЦ      подложка длиннее остатка трека — в конце тишина
      ДВАЖДЫ     трек звучит в полтора раза дольше, чем в нём громкого материала, — слышен по кругу
      СЕРИИ      трек уже стоит в другой серии (--others; владелец: без повторов между сериями); музыка под планами
                 с заметкой --shared (по умолчанию «0.» — интро сериала) общая и не считается
      ЧАСТЬ      внутри одной сцены (один номер в заметках) трек меняется
      ОБРЫВ      музыка кончается без затухания (< 0,5 с) и следующая не подхватывает
      ТИХО       (--segments, --music) на виде музыка тише −35 дБ дольше 2 с — по готовой дорожке музыки
      ДОЛИ       справка: сколько склеек между видами попадает в долю (±0,12 с)

Из сборщика серии (plan_sN.py):  import music_fit as MF;  T = MF.load_tracks("музыка.json")
    S.plan["music"]["cues"] += MF.beds(S.plan, ЧАСТИ, T)[0];  MF.snap(S.plan, T)

части.json: {"scenes": {"1.": "дорога", "4.": "дорога", "2.": "утро"},    префикс заметки → часть (длинный префикс главнее)
             "skip": ["0."],  "default": "тизер",                          без музыки от этого скрипта; часть по умолчанию
             "parts": {"дорога": {"track": "A Nomad's Journey", "level": 8, "peak_on": "4. интро дня"}}}
Уровень "level" — как level_db подложки под речью; при "music": {"auto_level": true} уровни ставит render_plan.
"""
import json, math, os, re, subprocess, sys, unicodedata

SR, NFFT, HOP = 11025, 1024, 256
WIN = 0.5                        # шаг огибающей громкости, с
DROP, MIN_WIN, FILL = 10.0, 8.0, 2.0   # громкое окно: не тише p90 − DROP, не короче MIN_WIN, провалы короче FILL не рвут
PEAK_LEN = 8.0
LAG = NFFT / float(SR)           # атака видна в кадре спектра, когда входит в его конец: время доли = кадр + длина окна
                                 # (сверка с librosa.beat.beat_track на 10 треках: без поправки доли раньше на 0,093 с)
ON_BEAT = 0.12                   # склейка «в долю», с
STEADY = 0.045                   # разброс шага долей больше — ритма нет (эмбиент): склейки по такому треку не двигаются
                                 # (10 треков серии 5: ритмичные 2,2–3,2 % и 99–100 % совпадения с librosa, остальные 6–8 %)


def N(s):
    return unicodedata.normalize("NFC", s)


def _np():
    try:
        import numpy
        return numpy
    except ImportError:
        sys.exit("нужен numpy: uv run -q --with numpy python music_fit.py …")


# ---------------------------------------------------------------- разбор трека
def tags(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags:format=duration", "-of", "json", path],
                       capture_output=True, text=True)
    try: f = json.loads(r.stdout or "{}").get("format", {})
    except ValueError: f = {}
    t = {k.lower(): v for k, v in (f.get("tags") or {}).items()}
    try: bpm = float(t.get("tbpm") or t.get("bpm") or 0)
    except ValueError: bpm = 0.0
    return {"title": t.get("title", "").replace("\\'", "'"), "artist": t.get("artist", ""), "genre": t.get("genre", ""),
            "mood": t.get("mood", ""), "energy": t.get("energy", ""), "bpm_tag": bpm, "dur": float(f.get("duration") or 0)}


def windows(mask, step, min_len=MIN_WIN, fill=FILL):
    out, i, n = [], 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j + 1 < n and mask[j + 1]: j += 1
            if out and i * step - out[-1][1] <= fill: out[-1][1] = (j + 1) * step
            else: out.append([i * step, (j + 1) * step])
            i = j + 1
        else:
            i += 1
    return [[round(a, 2), round(b, 2)] for a, b in out if b - a >= min_len]


def _spectra(np, y):
    """Огибающая атак (общая и басовая) и средний спектр мощности — кусками, чтобы не держать весь спектр в памяти."""
    n = 1 + (len(y) - NFFT) // HOP
    if n < 8: return np.zeros(0), np.zeros(0), np.zeros(NFFT // 2 + 1)
    w = np.hanning(NFFT).astype(np.float32); flux = np.zeros(n); low = np.zeros(n); psd = np.zeros(NFFT // 2 + 1)
    lowbin = int(200 * NFFT / SR); prev = None
    for a in range(0, n, 2000):
        b = min(n, a + 2000)
        idx = np.arange(NFFT)[None, :] + HOP * np.arange(a, b)[:, None]
        S = np.abs(np.fft.rfft(y[idx] * w, axis=1))
        psd += (S ** 2).sum(axis=0)
        L = np.log1p(100.0 * S)
        D = np.diff(np.vstack([prev, L]) if prev is not None else np.vstack([L[:1], L]), axis=0)
        D = np.maximum(D, 0.0)
        flux[a:b] = D.sum(axis=1); low[a:b] = D[:, :lowbin].sum(axis=1)
        prev = L[-1:]
    return flux, low, psd / n


def _tempo(np, on, hop_t, hint):
    """Темп, уд/мин: пик автокорреляции огибающей атак; с подсказкой из тегов — рядом с ней (±6 %), иначе 60–180."""
    x = on - on.mean(); n = len(x)
    f = np.fft.rfft(x, 2 * n); ac = np.fft.irfft(f * np.conj(f))[:n]
    lo, hi = (hint * 0.94, hint * 1.06) if hint else (60.0, 180.0)
    l0, l1 = max(2, int(60.0 / hi / hop_t)), min(n - 2, int(math.ceil(60.0 / lo / hop_t)))
    if l1 <= l0: return hint or 100.0
    lags = np.arange(l0, l1 + 1); sc = ac[lags].copy()
    if not hint: sc = sc * np.exp(-0.5 * (np.log2((60.0 / (lags * hop_t)) / 110.0) / 0.9) ** 2)
    k = int(lags[int(np.argmax(sc))])
    d = ac[k - 1] - 2 * ac[k] + ac[k + 1]                              # уточнение пика параболой
    kk = k + (0.5 * (ac[k - 1] - ac[k + 1]) / d if abs(d) > 1e-12 else 0.0)
    return 60.0 / (kk * hop_t)


def _beats(np, on, hop_t, bpm):
    """Доли динамическим программированием (Ellis 2007): максимум атак при шаге, близком к периоду темпа."""
    P = 60.0 / bpm / hop_t; n = len(on)
    if n < 4 * P: return []
    k = np.arange(-int(P), int(P) + 1)
    g = np.exp(-0.5 * (k * 32.0 / P) ** 2)
    loc = np.convolve(on / (on.std() + 1e-9), g, "same")
    offs = np.arange(-int(round(2 * P)), -int(round(P / 2)) + 1)
    pen = -100.0 * np.log(-offs / P) ** 2
    C = loc.copy(); back = -np.ones(n, dtype=int)
    for t in range(-int(offs[0]), n):
        sc = C[t + offs] + pen; m = int(np.argmax(sc))
        C[t] = loc[t] + sc[m]; back[t] = t + offs[m]
    tail = C[n - int(round(P)):]; t = n - int(round(P)) + int(np.argmax(tail)); b = [t]
    while back[b[-1]] >= 0: b.append(int(back[b[-1]]))
    b = b[::-1]
    thr = 0.5 * math.sqrt(float(np.mean(loc[b] ** 2)))                 # тишина по краям — не доли
    while len(b) > 2 and loc[b[0]] < thr: b = b[1:]
    while len(b) > 2 and loc[b[-1]] < thr: b = b[:-1]
    return [round(x * hop_t + LAG, 3) for x in b]


def analyze_track(path):
    np = _np()
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True).stdout
    y = np.frombuffer(raw, np.float32)
    t = tags(path)
    if len(y) < SR * 5: return None
    dur = len(y) / SR; n = int(SR * WIN); k = len(y) // n
    env = 10 * np.log10(np.mean(y[:k * n].reshape(k, n).astype(np.float64) ** 2, axis=1) + 1e-12)
    p90 = float(np.percentile(env, 90))
    loud = windows(env >= p90 - DROP, WIN) or [[0.0, round(dur, 2)]]
    m = int(PEAK_LEN / WIN); pw = 10 ** (env / 10)
    run = np.convolve(pw, np.ones(m) / m, "valid") if k > m else pw
    pk = int(np.argmax(run)) * WIN
    in_loud = np.zeros(k, bool)
    for a, b in loud: in_loud[int(a / WIN):int(b / WIN)] = True
    flux, low, psd = _spectra(np, y)
    hop_t = HOP / SR; beats, strong, bpm, meter, steady = [], [], t["bpm_tag"], 4, 1.0
    if len(flux) > 100:
        loc = np.convolve(flux, np.ones(21) / 21, "same"); on = np.maximum(flux - loc, 0.0)
        bpm = _tempo(np, on, hop_t, t["bpm_tag"] or None)
        beats = _beats(np, on, hop_t, bpm)
        if len(beats) >= 8:                                             # ровность шага долей: у ритмичного трека разброс 2–3 %,
            ibi = np.diff(np.array(beats)); steady = float(ibi.std() / (np.median(ibi) + 1e-9))   # у эмбиента без пульса 6–8 %
        if len(beats) >= 12:                                            # сильная доля: где бас бьёт заметнее остальных
            fr = [min(len(low) - 1, max(0, int(round((x - LAG) / hop_t)))) for x in beats]
            lv = np.array([low[max(0, i - 2):i + 3].max() for i in fr]); best = (-1e9, 4, 0)
            for mt in (4, 3):
                for ph in range(mt):
                    s = float(lv[ph::mt].mean() - lv.mean()) / (float(lv.std()) + 1e-9)
                    if mt == 3: s -= 0.15                               # размер 3/4 — только при явном перевесе
                    if s > best[0]: best = (s, mt, ph)
            meter = best[1]; strong = beats[best[2]::meter]
    fq = np.fft.rfftfreq(NFFT, 1.0 / SR)
    mid = float(psd[(fq >= 700) & (fq <= 3500)].sum() / (psd[fq >= 60].sum() + 1e-12))
    st = os.stat(path)
    return dict(t, file=N(path), size=st.st_size, mtime=int(st.st_mtime), dur=round(dur, 2), bpm=round(float(bpm), 1), meter=meter,
                beats=beats, strong=strong, loud=loud, intro=loud[0][0], outro=loud[-1][1], peak=round(pk, 1),
                steady=round(steady, 3), p90=round(p90, 1), rms_loud=round(float(10 * np.log10(pw[in_loud].mean() + 1e-12)), 1), mid=round(mid, 3))


def load_tracks(path):
    if not path or not os.path.exists(path): return {}
    return json.load(open(path, encoding="utf-8")).get("tracks", {})


def cmd_analyze(a):
    out = opt(a, "--out"); files = []
    for p in [x for x in a if not x.startswith("--") and x != out]:
        if os.path.isdir(p):
            files += sorted(os.path.join(dp, f) for dp, _, fs in os.walk(p) for f in fs
                            if f.lower().endswith((".mp3", ".wav", ".m4a", ".flac")) and not f.startswith("._") and "/звуки" not in N(dp))
        else:
            files.append(p)
    if not files: sys.exit("нет треков")
    if not out: out = os.path.join(files[0] if os.path.isdir(files[0]) else os.path.dirname(files[0]), "музыка.json")
    T = load_tracks(out); done = 0
    for f in files:
        key = N(os.path.basename(f)); st = os.stat(f); old = T.get(key)
        if old and old.get("size") == st.st_size and old.get("mtime") == int(st.st_mtime): continue
        r = analyze_track(f)
        if not r: print("  пропуск (короче 5 с):", key); continue
        T[key] = r; done += 1
        print(f"  {key[:54]:54} {r['dur']:6.1f} с  {r['bpm']:5.1f} уд/мин {r['meter']}/4  окна {r['loud']}  пик {r['peak']}  "
              f"шаг ±{100 * r['steady']:.0f}%  средние {r['mid']:.2f}  {r['genre']}; {r['mood']}")
    tmp = out + f".{os.getpid()}"
    json.dump({"version": 1, "tracks": T}, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1); os.replace(tmp, out)
    print(f"{out}: треков {len(T)}, разобрано заново {done}")


# ---------------------------------------------------------------- геометрия плана
def timeline(segs):
    T, t = [], 0.0
    for x in segs: T.append(t); t += x["out"] - x["in"]
    return T


def film_pos(segs, T, key, tt):
    for i, x in enumerate(segs):
        if x["src"] == key and x["in"] - 0.01 <= tt <= x["out"] + 0.01: return i, T[i] + tt - x["in"]
    return None


def cue_span(segs, T, c):
    a, b = film_pos(segs, T, *c["a"]), film_pos(segs, T, *c["b"])
    return None if a is None or b is None or b[1] <= a[1] else (a[1], b[1])


def is_voice(c):
    """Голос за кадром — как в render_plan.py: записи .wav; музыка — mp3 (поднятые куски подложки бывают > 20 дБ)."""
    return c.get("file", "").lower().endswith(".wav")


def voice_spans(plan, T):
    segs = plan["segments"]
    return [s for s in (cue_span(segs, T, c) for c in (plan.get("music") or {}).get("cues", []) if is_voice(c)) if s]


def is_view(x, a0, b0, voice):
    """Вид: план без речи — заглушён или только фон места, и голос за кадром его не занимает."""
    if any(min(b0, vb) - max(a0, va) > 0.3 * (b0 - a0) for va, vb in voice): return False
    return (x.get("gain_db", 0) or 0) <= -40 or bool(x.get("ambient"))


def find_track(tracks, name):
    key = N(name).lower()
    for k, v in tracks.items():
        if key in N(k).lower() or key == N(v.get("title", "")).lower(): return v
    return None


def track_of(tracks, path):
    return tracks.get(N(os.path.basename(path)))


def nearest(xs, t):
    return min(xs, key=lambda x: abs(x - t)) if xs else None


# ---------------------------------------------------------------- подложки по частям дня
def part_of(note, cfg):
    best = None
    for pre, part in (cfg.get("scenes") or {}).items():
        if note.startswith(pre) and (best is None or len(pre) > len(best[0])): best = (pre, part)
    if best: return best[1]
    if any(note.startswith(x) for x in cfg.get("skip", [])): return None
    return cfg.get("default")


def beds(plan, cfg, tracks, overlap=1.0, min_left=20.0):
    """→ (подложки, предупреждения). План не меняется."""
    segs = plan["segments"]; T = timeline(segs); cues, warn, runs, state = [], [], [], {}
    def at_(tt, start=True):
        for i, x in enumerate(segs):
            d = x["out"] - x["in"]
            if (T[i] - 1e-6 <= tt < T[i] + d - 1e-6) if start else (T[i] + 1e-6 < tt <= T[i] + d + 1e-6):
                return [x["src"], round(x["in"] + tt - T[i], 3)]
    for i, sg in enumerate(segs):
        p = part_of(sg.get("note", ""), cfg)
        if runs and runs[-1][0] == p: runs[-1][2] = i
        else: runs.append([p, i, i])
    for p, ia, ib in runs:
        if p is None: continue
        pc = (cfg.get("parts") or {}).get(p)
        if not pc: warn.append(f"часть «{p}» не описана в parts"); continue
        tr = find_track(tracks, pc["track"])
        if not tr: warn.append(f"часть «{p}»: трека «{pc['track']}» нет в разборе — music_fit.py analyze"); continue
        if is_voice(tr): warn.append(f"часть «{p}»: трек .wav render_plan сведёт как голос — нужен mp3"); continue
        wins = [w for w in (pc.get("windows") or tr["loud"]) if w[1] - w[0] >= 4.0] or [[0.0, tr["dur"]]]
        t0, t1 = T[ia], T[ib] + segs[ib]["out"] - segs[ib]["in"]; grid = tr.get("strong") or tr.get("beats") or []
        if p not in state:
            ws, we = wins[0]; off = 0.0
            pk = pc.get("peak_on"); j = next((m for m in range(ia, ib + 1) if pk and segs[m].get("note", "").startswith(pk)), None)
            if j is not None and ws <= tr["peak"] - (T[j] - t0) <= we - 8.0: off = tr["peak"] - (T[j] - t0) - ws   # кульминация — на план
            else:
                if pk and j is None: warn.append(f"часть «{p}»: плана «{pk}» для кульминации в первом заходе нет")
                elif pk: warn.append(f"часть «{p}»: кульминация трека не дотягивается до «{pk}» — вход с начала окна")
                g = next((x for x in grid if ws <= x <= ws + 4.0), None)                              # вход — на сильную долю
                if g is not None: off = g - ws
            state[p] = (0, off)
        wi, off = state[p]; first = True
        for _ in range(200):
            ws, we = wins[wi]; left = we - ws - off
            if left < 2.0: wi, off = (wi + 1) % len(wins), 0.0; continue
            end = min(t1, t0 + left); last = end >= t1 - 1e-6
            cues.append({"name": f"{p} ({tr['title'] or pc['track']})", "file": tr["file"], "src_in": round(ws + off, 3),
                         "level_db": pc.get("level", 8), "bed": True, "fade_in": 0.4 if first else 1.0,
                         "fade_out": 2.0 if last else 1.0, "a": at_(t0), "b": at_(end, False)})
            if last:
                off += end - t0
                if we - ws - off < min_left: wi, off = (wi + 1) % len(wins), 0.0
                state[p] = (wi, off); break
            t0 = end - overlap; wi, off, first = (wi + 1) % len(wins), 0.0, False
        else: warn.append(f"часть «{p}»: подложка оборвана на {tc(t0)} — окон трека не хватило на 200 заходов")
    return cues, warn


# ---------------------------------------------------------------- склейки видов на доли
def _source_dur(path, cache):
    if path not in cache:
        o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                           capture_output=True, text=True).stdout.strip()
        try: cache[path] = float(o)
        except ValueError: cache[path] = 0.0
    return cache[path]


def view_cuts(plan, tracks):
    """Склейки между двумя видами под одной подложкой: [(номер плана слева, время фильма, время трека, трек)]."""
    segs = plan["segments"]; T = timeline(segs); voice = voice_spans(plan, T); out = []
    bed = [(cue_span(segs, T, c), c) for c in (plan.get("music") or {}).get("cues", []) if not is_voice(c)]
    for i in range(len(segs) - 1):
        a0, b0 = T[i], T[i + 1]; b1 = b0 + segs[i + 1]["out"] - segs[i + 1]["in"]
        if not (is_view(segs[i], a0, b0, voice) and is_view(segs[i + 1], b0, b1, voice)): continue
        for sp, c in bed:
            if sp and sp[0] + 0.5 <= b0 <= sp[1] - 0.5:
                tr = track_of(tracks, c.get("file", ""))
                if tr and tr.get("beats") and tr.get("steady", 1.0) <= STEADY: out.append((i, b0, c["src_in"] + b0 - sp[0], tr))
                break
    return out


def on_beat(cuts):
    return sum(1 for _, _, mt, tr in cuts if abs(nearest(tr["beats"], mt) - mt) <= ON_BEAT)


def snap(plan, tracks, max_shift=0.35, min_len=4.0, log=None):
    """Меняет plan на месте. → (склеек под музыкой, в долю до, в долю после, сдвинуто)."""
    segs = plan["segments"]; cues = (plan.get("music") or {}).get("cues", []); durs = {}; moved = 0
    pins = [(c, k) for c in cues + (plan.get("music") or {}).get("sfx", []) for k in ("a", "b") if isinstance(c.get(k), list)]
    def lost():                                                          # точки музыки, выпавшие из плана (render_plan на них падает)
        T = timeline(segs); return {(id(c), k) for c, k in pins if film_pos(segs, T, *c[k]) is None}
    before = view_cuts(plan, tracks); n0 = on_beat(before)
    for i, _, _, _ in before:
        cur = [c for c in view_cuts(plan, tracks) if c[0] == i]         # прежние сдвиги уже учтены
        if not cur: continue
        _, t, mt, tr = cur[0]; x = segs[i]
        if x.get("fixed") or segs[i + 1].get("fixed"): continue
        ends = [o["at"] + o["dur"] for o in x.get("broll", []) + x.get("cards", []) if "at" in o and "dur" in o]
        if any(e > x["out"] - 0.6 for e in ends): continue               # у края плана перебивка или плашка
        cand = sorted([b for b in tr.get("strong", []) if abs(b - mt) <= max_shift], key=lambda b: abs(b - mt)) + \
               sorted([b for b in tr["beats"] if abs(b - mt) <= max_shift], key=lambda b: abs(b - mt))
        if abs(nearest(tr["beats"], mt) - mt) <= 0.02: continue          # уже в долю — не тянуть к сильной
        for b in cand:
            d = b - mt
            if abs(d) <= 0.02: break                                     # уже в долю
            new = x["out"] + d
            if new - x["in"] < min_len: continue
            if d > 0:
                dur = _source_dur(plan["sources"].get(x["src"], ""), durs)
                if not dur or new > dur - 0.1: continue
            lost0 = lost(); old = x["out"]; x["out"] = round(new, 3); edge = []
            for c, k in pins:                                            # подложка, привязанная к этому краю, едет с ним
                if c[k][0] == x["src"] and abs(c[k][1] - old) <= 0.02: edge.append((c, k, c[k])); c[k] = [x["src"], x["out"]]
            if lost() - lost0:                                           # другая точка музыки внутри отрезанного — сдвиг не делается
                x["out"] = old
                for c, k, v in edge: c[k] = v
                continue
            moved += 1
            if log is not None: log.append(f"{tc(t)} «{x.get('note', '')[:40]}»: склейка {d:+.2f} с — на долю «{tr['title']}»")
            break
    after = view_cuts(plan, tracks)
    return len(after), n0, on_beat(after), moved


# ---------------------------------------------------------------- проверка музыки плана
def tc(x):
    return f"{int(x // 60)}:{x % 60:04.1f}"


def short(f):
    return re.sub(r"^ES_|\.\w+$", "", os.path.basename(f))


def scene_no(note):
    m = re.match(r"\s*(\d+)\.", note or "")
    return m.group(1) if m else None


def check(plan, tracks, others=(), segments=None, music_wav=None, shared=("0.",)):
    """shared — префиксы заметок с общей музыкой сериала (интро, «ранее»): она законно повторяется между сериями."""
    segs = plan["segments"]; T = timeline(segs); voice = voice_spans(plan, T); F = []
    def note_at(t):
        return next((segs[i].get("note", "") for i in range(len(segs)) if T[i] <= t < T[i] + segs[i]["out"] - segs[i]["in"]), "")
    music = []
    for c in (plan.get("music") or {}).get("cues", []):
        if is_voice(c): continue
        sp = cue_span(segs, T, c)
        if sp: music.append((sp[0], sp[1], c))
    music.sort(key=lambda m: m[0])
    used = {}
    for n_, (t0, t1, c) in enumerate(music):
        f = c.get("file", ""); tr = track_of(tracks, f); name = (tr or {}).get("title") or os.path.basename(f)
        s0, s1 = c.get("src_in", 0.0), c.get("src_in", 0.0) + t1 - t0
        if tr:
            i0 = next((i for i in range(len(segs)) if T[i] <= t0 < T[i] + segs[i]["out"] - segs[i]["in"]), None)
            if i0 is not None and is_view(segs[i0], T[i0], T[i0] + segs[i0]["out"] - segs[i0]["in"], voice) \
                    and not any(a - 1.0 <= s0 <= b for a, b in tr["loud"]):
                F.append((t0, "ВХОД", f"«{name}» входит с {s0:.0f} с трека — тихое место (громкие окна {tr['loud']}), а на экране вид"))
            if s1 > tr["dur"] + 0.3:
                F.append((t0, "КОНЕЦ", f"«{name}»: нужно до {s1:.0f} с, трек кончается на {tr['dur']:.0f} с — {s1 - tr['dur']:.0f} с тишины"))
        used.setdefault(f, []).append((s0, s1, t0, name, tr))
        nxt = music[n_ + 1] if n_ + 1 < len(music) else None
        if (c.get("fade_out", 3.0) or 0) < 0.5 and t1 < T[-1] + segs[-1]["out"] - segs[-1]["in"] - 1.0 and not (nxt and nxt[0] <= t1 + 0.3):
            F.append((t1, "ОБРЫВ", f"«{name}» кончается без затухания ({c.get('fade_out', 3.0)} с), следующая музыка не подхватывает"))
    need = []
    for f, L in used.items():                                           # сколько трека нужно и сколько в нём есть
        played = sum(b - a for a, b, _, _, _ in L); tr = L[0][4]
        have = sum(b - a for a, b in tr["loud"]) if tr else 0.0
        need.append((L[0][3], played, have, len(L)))
        if tr and played > have * 1.5 + 20:
            F.append((L[0][2], "ДВАЖДЫ", f"«{L[0][3]}» звучит {played / 60:.1f} мин, а громкого материала в треке {have / 60:.1f} мин — "
                      f"слышен по кругу {played / max(have, 1):.1f} раза: второй трек на эту часть или версия длиннее (Epidemic Sound: EditRecording)"))
    by_scene = {}
    for i, x in enumerate(segs):
        no = scene_no(x.get("note", "")); a0, b0 = T[i], T[i] + x["out"] - x["in"]
        if no is None: continue
        for t0, t1, c in music:
            if min(b0, t1) - max(a0, t0) > 2.0:
                by_scene.setdefault(no, [])
                f = os.path.basename(c.get("file", ""))
                if f not in [q[0] for q in by_scene[no]]: by_scene[no].append((f, max(a0, t0)))
    for no, L in by_scene.items():
        if len(L) > 1:
            F.append((L[1][1], "ЧАСТЬ", f"в сцене {no} музыка меняется: " + " → ".join(re.sub(r"^ES_|\.\w+$", "", f)[:30] for f, _ in L)))
    mine = {N(os.path.basename(c.get("file", ""))) for t0, _, c in music if not note_at(t0).startswith(tuple(shared))}
    for op in others:
        try: O = json.load(open(op, encoding="utf-8"))
        except Exception: continue
        theirs = {N(os.path.basename(c.get("file", ""))) for c in (O.get("music") or {}).get("cues", []) if not is_voice(c)}
        for f in sorted(mine & theirs):
            t0 = next(t for t, _, c in music if N(os.path.basename(c.get("file", ""))) == f)
            F.append((t0, "СЕРИИ", "«" + short(f) + "» уже стоит в " + os.path.basename(op)))
    if segments and music_wav and os.path.exists(music_wav):
        np = _np(); R = json.load(open(segments, encoding="utf-8"))
        raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", music_wav, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                             capture_output=True).stdout
        y = np.frombuffer(raw, np.int16).astype(np.float64) / 32768; W = 4000; k = len(y) // W
        db = 10 * np.log10(np.mean(y[:k * W].reshape(k, W) ** 2, axis=1) + 1e-12); view = np.zeros(k, bool)
        for p, s in zip(segs, R):
            if is_view(p, s["start"], s["end"], voice) and not p.get("note", "").startswith(("0.", "T.")):
                view[int(s["start"] / 0.5) + 1:max(int(s["end"] / 0.5) - 1, 0)] = True
        i = 0
        while i < k:
            if view[i] and db[i] < -35.0:
                j = i
                while j + 1 < k and view[j + 1] and db[j + 1] < -35.0: j += 1
                if (j - i + 1) * 0.5 >= 2.0:
                    t = i * 0.5; nt = next((s["note"] for s in R if s["start"] <= t < s["end"]), "")
                    F.append((t, "ТИХО", f"на виде «{nt[:40]}» музыка {float(db[i:j + 1].min()):.0f} дБ {(j - i + 1) * 0.5:.1f} с"))
                i = j + 1
            else:
                i += 1
    cuts = view_cuts(plan, tracks)
    info = {"need": sorted(need, key=lambda x: -x[1]), "cues": len(music), "tracks": sorted({re.sub(r"^ES_|\.\w+$", "", os.path.basename(c.get("file", ""))) for _, _, c in music}),
            "cuts": len(cuts), "on_beat": on_beat(cuts), "unknown": sorted({os.path.basename(c.get("file", "")) for _, _, c in music
                                                                         if not track_of(tracks, c.get("file", ""))})}
    return sorted(F), info, note_at


KINDS = ("ВХОД", "КОНЕЦ", "ДВАЖДЫ", "СЕРИИ", "ЧАСТЬ", "ОБРЫВ", "ТИХО")


def report(plan_path, F, info, note_at):
    L = [f"# Музыка плана: {os.path.basename(plan_path)}, находок {len(F)}", "",
         f"Подложек {info['cues']}, треков {len(info['tracks'])}: {', '.join(info['tracks'])}.", ""]
    if info["unknown"]:
        L += [f"Нет в разборе (music_fit.py analyze): {', '.join(info['unknown'])} — проверки ВХОД, КОНЕЦ и ДОЛИ по ним не шли.", ""]
    for k in KINDS:
        rows = [f for f in F if f[1] == k]
        L.append(f"## {k} — {len(rows)}")
        L += [f"- {tc(t)} «{note_at(t)[:40]}»: {txt}" for t, _, txt in rows] + [""]
    pct = f"{100.0 * info['on_beat'] / info['cuts']:.0f}%" if info["cuts"] else "—"
    L += ["## Сколько музыки нужно (справка)", "", "| трек | звучит, мин | громкого материала, мин | заходов |", "| --- | --- | --- | --- |"]
    L += [f"| {n_} | {pl / 60:.1f} | {hv / 60:.1f} | {k_} |" for n_, pl, hv, k_ in info["need"]] + [""]
    L += ["## ДОЛИ (справка)", f"- склеек между видами под музыкой: {info['cuts']}, в долю (±{ON_BEAT} с): {info['on_beat']} ({pct}). "
          "Подтянуть: music_fit.py snap.", ""]
    return "\n".join(L)


# ---------------------------------------------------------------- запуск
def opt(a, k, d=None):
    return a[a.index(k) + 1] if k in a and a.index(k) + 1 < len(a) else d


def opts(a, k):
    out, i = [], 0
    while i < len(a):
        if a[i] == k:
            i += 1
            while i < len(a) and not a[i].startswith("--"): out.append(a[i]); i += 1
        else:
            i += 1
    return out


def _new_plan(out):
    """Планы неизменяемы: допуск рецензента выдан по sha файла. --out — только новое имя. Сравнивать строки путей мало:
    exFAT и APFS не различают регистр, и «./PLAN_S5.json» — тот же файл, что plan_s5.json (ревью 23.11)."""
    if not out: sys.exit("--out: новый файл плана (исходный план не переписывается)")
    if os.path.lexists(out): sys.exit(f"--out: {out} уже существует — планы не переписываются, дай новое имя")
    return out


def _save(plan, path):
    with open(path, "x", encoding="utf-8") as f:                        # «x»: файл с таким именем (в любом регистре) — отказ
        json.dump(plan, f, ensure_ascii=False, indent=1)


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"): print(__doc__); return 0
    cmd, a = a[0], a[1:]
    if cmd == "analyze": cmd_analyze(a); return 0
    if not a or a[0].startswith("--"): sys.exit(f"music_fit.py {cmd} <plan.json> …: music_fit.py --help")
    plan_path = a[0]; plan = json.load(open(plan_path, encoding="utf-8"))
    tracks = load_tracks(opt(a, "--tracks"))
    if cmd == "beds":
        if not opt(a, "--parts"): sys.exit("--parts: таблица частей дня (части_sN.json)")
        cfg = json.load(open(opt(a, "--parts"), encoding="utf-8")); out = opt(a, "--out")
        _new_plan(out)
        cues, warn = beds(plan, cfg, tracks)
        m = plan.setdefault("music", {"cues": [], "sfx": []})
        if "--replace" in a: m["cues"] = [c for c in m.get("cues", []) if not c.get("bed")]
        m.setdefault("cues", []).extend(cues); _save(plan, out)
        for w in warn: print("внимание:", w)
        print(f"{out}: подложек добавлено {len(cues)}")
        return 1 if warn else 0
    if cmd == "snap":
        out = opt(a, "--out")
        _new_plan(out)
        log = []; n, b0, b1, moved = snap(plan, tracks, float(opt(a, "--max", "0.35")), float(opt(a, "--min-len", "4")), log)
        _save(plan, out)
        for x in log: print("  " + x)
        print(f"{out}: склеек между видами под ритмичной музыкой {n}, в долю было {b0}, стало {b1}, сдвинуто {moved}")
        return 0
    if cmd == "check":
        F, info, note_at = check(plan, tracks, opts(a, "--others"), opt(a, "--segments"), opt(a, "--music"),
                                 tuple(opts(a, "--shared")) or ("0.",))
        txt = report(plan_path, F, info, note_at); out = opt(a, "--out")
        if out: open(out, "w", encoding="utf-8").write(txt)
        print(txt if not out else f"{out}: находок {len(F)} — " + ", ".join(f"{k} {sum(1 for f in F if f[1] == k)}" for k in KINDS))
        return 0
    sys.exit(f"неизвестная команда {cmd}")


if __name__ == "__main__":
    sys.exit(main())
