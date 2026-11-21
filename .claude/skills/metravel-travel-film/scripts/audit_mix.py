#!/usr/bin/env python3
"""Проверка «на слух» без слуха: слышна ли речь под музыкой и нет ли провалов.

audit_mix.py <фильм.mp4> --segments <segments.json> --base <без_музыки.mov> [--music <музыка.wav>] [--voice <голос.wav>]
             [--words-root DIR] [--alias alias.json] [--out audit_mix.md]

segments.json — таблица отрезков рендера (start, end, note, src, in, out): её пишет render_plan.py рядом с фильмом.
--base — звук живых планов без музыки; --music / --voice — дорожки музыки и голоса за кадром (render_plan.py пишет их рядом).
--words-root — расшифровки исходников по словам (*.words.json): с ними проверяется разборчивость речи в готовом звуке.

Находки:
  ТОНЕТ    на отрезке с речью музыка тише речи меньше чем на 10 LU (цель 12–15) — голос «не слышно»
  НЕСЛЫШНО слова исходника в расшифровке готового звука узнаются меньше чем на 60% (нужен --words-root, долго: whisper по фильму)
  ЗАПАС    на отрезке с речью энергия речи минус энергия музыки < 10 дБ (цель 12–15): 10·log10(mean(x²))
           в окнах речи (0,5 с; окно не тише максимума отрезка на 20 дБ и громче −45) на «без музыки»
           (живая речь, нужен --words-root) или на голосе за кадром против «музыки» в тех же окнах
  ГРОМКО   без речи музыка громче соседней речи больше чем на 3 LU
  ПРОВАЛ   ниже −50 dBFS дольше 0,5 с в сведённом звуке; или все дорожки (музыка, «без музыки», голос)
           тише −35 дБ подряд ≥ 1,5 с — дыра на видах, которую сведённый звук ещё не считает тишиной
  ПАУЗА    то же внутри отрезка с живой речью — пауза в разговоре, сведения, не находка
  НАЛОЖЕНИЕ голос за кадром (> −35 дБ) одновременно со звуком кадра (> −30 дБ) ≥ 0,5 с: две речи сразу (s7 v2, В5 на роликах);
           с --words-root — только если в исходнике на этом месте есть слова (нет расшифровки = нет речи), иначе это
           поезд, ветер и шаги; без --words-root — по одной энергии
  ЧУЖОЙ ЗВУК отрезок из чужого смонтированного ролика (/Собраны/, /НАШИ ФОТКИ/, metravel-film-work; копии — через --alias)
           звучит громче −40 дБ: там чужая озвучка и музыка (s7 v2, «Тропа ведьм»); render_plan глушит их сам,
           кроме отрезков с "own_audio": true — такой звук должен быть нашим и нужным
Те же пороги, что у рецензента: сборщик видит их до film_gate.py request.
"""
import json, math, os, re, subprocess, sys, tempfile, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from auto_level import is_talk   # порог «разговор, а не вид» — общий с автоуровнями render_plan

a = sys.argv[1:]
film = a[0]
opt = lambda k: a[a.index(k) + 1] if k in a else None
segs = json.load(open(opt("--segments")))
base, music, voice, root, out = opt("--base"), opt("--music"), opt("--voice"), opt("--words-root"), opt("--out")
alias = json.load(open(opt("--alias"))) if opt("--alias") else {}
N = lambda x: re.sub(r"[^\w]", "", unicodedata.normalize("NFC", x).lower().replace("ё", "е"))
idx = {}
if root:
    for dp, _, fs in os.walk(root):
        for f in fs:
            if f.endswith(".words.json") and not f.startswith("._"): idx[unicodedata.normalize("NFC", f[:-11])] = os.path.join(dp, f)
def src_words(s):
    """Слова исходника на отрезке (вертикальные/размытые копии — через --alias). None — расшифровки нет."""
    p, off = s["src"], 0.0
    if p in alias: p, off = alias[p][0], float(alias[p][1])
    w = idx.get(unicodedata.normalize("NFC", os.path.splitext(os.path.basename(p))[0]))
    if not w: return None
    return [N(x["word"]) for y in json.load(open(w))["segments"] for x in y.get("words", []) if s["in"] + off <= x["start"] < s["out"] + off]

def lufs_series(path, step=0.4):
    """Кратковременная громкость (M, окно 400 мс) по всему файлу: [(t, lufs)]."""
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", path, "-vn", "-af", "ebur128=metadata=1,ametadata=print:key=lavfi.r128.M",
                        "-f", "null", "-"], capture_output=True, text=True)
    out_, t_ = [], None                       # пары «время — значение» строго по кадру: у части кадров метки нет
    for line in (r.stdout + r.stderr).splitlines():
        m = re.search(r"pts_time:([\d.]+)", line)
        if m: t_ = float(m.group(1)); continue
        m = re.search(r"lavfi\.r128\.M=(-?[\d.]+|-inf)", line)
        if m and t_ is not None: out_.append((t_, float(m.group(1)) if m.group(1) != "-inf" else -120.0)); t_ = None
    return out_

WIN = 0.5                                   # окно 0,5 с: 4000 сэмплов при 8 кГц, как у рецензента
def rms_windows(path):
    """RMS (дБ) по окнам 0,5 с, моно 8 кГц: [дБ, ...], индекс окна i = время i*0.5 с. Нет файла — []."""
    if not path or not os.path.exists(path): return []
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", path, "-vn", "-af",
                        "aformat=channel_layouts=mono,aresample=8000,asetnsamples=n=4000:p=0,astats=metadata=1:reset=1,"
                        "ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"], capture_output=True, text=True)
    v = re.findall(r"lavfi\.astats\.Overall\.RMS_level=(-?inf|-?[\d.]+)", r.stdout + r.stderr)
    return [max(float(x), -120.0) for x in v]

def energy_db(w, i0, i1, mask=None):
    """Энергия отрезка 10·log10(mean(x²)) по окнам [i0, i1) (mask — только эти окна)."""
    idx_ = [i for i in range(max(0, i0), min(len(w), i1)) if mask is None or mask(i)]
    if not idx_: return -120.0
    return 10 * math.log10(sum(10 ** (w[i] / 10) for i in idx_) / len(idx_) + 1e-12)

def mean_db(series, a0, b0):
    v = [m for t, m in series if a0 <= t < b0 and m > -70]
    if not v: return -99.0
    import math
    return 10 * math.log10(sum(10 ** (m / 10) for m in v) / len(v))

F = []; SPEECH = {}
S_base = lufs_series(base) if base else []
S_mus = lufs_series(music) if music else []
S_voi = lufs_series(voice) if voice else []
R_base, R_mus, R_voi = rms_windows(base), rms_windows(music), rms_windows(voice)
at = lambda w, i: w[i] if i < len(w) else -120.0
TALK_SEGS = []                              # отрезки с живой речью: пауза в разговоре — сведения, а не ПРОВАЛ
def speech_mask(w, i0, i1):
    """Окна речи отрезка: не тише максимума отрезка на 20 дБ и громче −45 дБ (рецензент 21.11)."""
    top = max((at(w, i) for i in range(i0, i1)), default=-120.0)
    return lambda i: at(w, i) > -45 and at(w, i) >= top - 20
for s in segs:                              # ЗАПАС: энергия речи против энергии музыки в моменты речи
    i0, i1 = int(round(s["start"] / WIN)), int(round(s["end"] / WIN))
    if i1 - i0 < 2 or not R_mus: continue
    vo_on = speech_mask(R_voi, i0, i1)
    if R_voi and sum(1 for i in range(i0, i1) if vo_on(i)) >= 2:       # голос за кадром: тизер, «ранее», связки
        ev, emv = energy_db(R_voi, i0, i1, vo_on), energy_db(R_mus, i0, i1, vo_on)
        if emv > -60 and ev - emv < 10:
            F.append((s["start"], "ЗАПАС", s["note"], f"голос за кадром {ev:.1f}, музыка {emv:.1f} дБ — запас {ev - emv:.1f} (нужно ≥ 10, цель 12–15)", round(ev - emv, 1)))
        continue
    sw = src_words(s) if root else None
    nw = len([w for w in sw if len(w) > 1]) if sw else 0
    # речь, а не вид: whisper находит в ветре 3–4 «слова» (s3 v12: «город сверху», «поля», «мол и маяк»)
    if is_talk(nw, s["end"] - s["start"]) and R_base:
        TALK_SEGS.append((s["start"], s["end"]))
        on = speech_mask(R_base, i0, i1)
        if sum(1 for i in range(i0, i1) if on(i)) < 2: continue
        eb, em = energy_db(R_base, i0, i1, on), energy_db(R_mus, i0, i1, on)
        if em > -60 and eb - em < 10:
            F.append((s["start"], "ЗАПАС", s["note"], f"речь {eb:.1f}, музыка {em:.1f} дБ — запас {eb - em:.1f} (нужно ≥ 10, цель 12–15)", round(eb - em, 1)))

n_w = max(len(R_base), len(R_mus), len(R_voi))   # ПРОВАЛ на видах: все дорожки тише −35 дБ подряд ≥ 1,5 с
HOLES = []
if R_mus and R_base:
    i = 0
    while i < n_w:
        if all(at(w, i) < -35 for w in (R_mus, R_base, R_voi or [])):
            j = i
            while j < n_w and all(at(w, j) < -35 for w in (R_mus, R_base, R_voi or [])): j += 1
            if (j - i) * WIN >= 1.5:
                HOLES.append((i * WIN, j * WIN))
                note = next((x["note"] for x in segs if x["start"] <= i * WIN < x["end"]), "")
                talk = any(t0 <= i * WIN < t1 for t0, t1 in TALK_SEGS)
                F.append((i * WIN, "ПАУЗА" if talk else "ПРОВАЛ", note, f"{(j - i) * WIN:.1f} с все дорожки тише −35 дБ"
                          + (" — пауза в разговоре, сведения" if talk else " (музыка, без музыки, голос)"), None))
            i = j
        else:
            i += 1

for s in segs:
    a0, b0 = s["start"] + 0.3, s["end"] - 0.3
    if b0 - a0 < 1: continue
    vo = mean_db(S_voi, a0, b0); sw = src_words(s) if root else None
    live = (sw is not None and is_talk(len([w for w in sw if len(w) > 1]), s["end"] - s["start"])) or not root
    talking = vo > -35 or live                  # тот же порог разговора, что у ЗАПАС и автоуровней: 3–4 «слова» ветра — вид
    sp = max(mean_db(S_base, a0, b0) if live else -99, vo)
    mu = mean_db(S_mus, a0, b0)
    if vo > -35 and vo >= sp - 0.01:            # голос за кадром: музыку меряем в те же моменты, а не по всему отрезку —
        on_t = {round(t, 1) for t, m in S_voi if a0 <= t < b0 and m > -45}   # хвост фразы в 0,3 с на виде под музыкой (s1 v21, 41:00.7)
        mu = mean_db([(t, m) for t, m in S_mus if round(t, 1) in on_t], a0, b0) if len(on_t) * 0.1 >= 0.5 else -99.0
    if talking and sp > -40 and mu > -60 and sp - mu < 10:
        F.append((s["start"], "ТОНЕТ", s["note"], f"речь {sp:.1f}, музыка {mu:.1f} LUFS — разница {sp - mu:.1f} LU (нужно ≥ 10)", round(sp - mu, 1)))
    if not talking and mu > -60:
        SPEECH.setdefault("quiet", []).append((s, mu))
    if talking and sp > -40: SPEECH.setdefault("talk", []).append((s["start"], sp))

for s, mu in SPEECH.get("quiet", []):           # музыка без речи против ближайшей настоящей речи (±60 с), а не шума соседнего плана
    near = [v for t, v in SPEECH.get("talk", []) if abs(t - s["start"]) < 60]
    ref = sorted(near)[len(near) // 2] if near else -14.0
    if mu - ref > 3: F.append((s["start"], "ГРОМКО", s["note"], f"музыка без речи {mu:.1f}, речь рядом {ref:.1f} LUFS", None))
r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", film, "-vn", "-af", "silencedetect=n=-50dB:d=0.5", "-f", "null", "-"], capture_output=True, text=True)
for st, du in zip(re.findall(r"silence_start: ([\d.]+)", r.stderr), re.findall(r"silence_duration: ([\d.]+)", r.stderr)):
    if any(h0 - 0.5 <= float(st) <= h1 for h0, h1 in HOLES): continue   # уже названо как дыра по дорожкам
    F.append((float(st), "ПРОВАЛ", "", f"{float(du):.1f} с ниже −50 dBFS", None))

if root and "--no-asr" not in a:             # разборчивость: whisper по готовому звуку против слов исходника
    T = tempfile.mkdtemp()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", film, "-vn", "-ac", "1", "-ar", "16000", T + "/a.wav"], check=True)
    subprocess.run(["mlx_whisper", T + "/a.wav", "--model", "mlx-community/whisper-large-v3-turbo", "--language", "ru", "--output-format", "json",
                    "--output-dir", T, "--condition-on-previous-text", "False", "--word-timestamps", "True", "--verbose", "False"], capture_output=True)
    got = [(N(w["word"]), w["start"]) for x in json.load(open(T + "/a.json"))["segments"] for w in x.get("words", [])]
    for s in segs:
        src = src_words(s)
        if not src: continue
        src = [w for w in src if len(w) > 2]
        if len(src) < 6: continue
        heard = {w for w, t in got if s["start"] - 1 <= t <= s["end"] + 1}
        rec = sum(1 for w in src if w in heard) / len(src)
        if rec < 0.6: F.append((s["start"], "НЕСЛЫШНО", s["note"], f"узнано {rec:.0%} слов исходника ({len(src)} слов)", None))

# НАЛОЖЕНИЕ: голос за кадром поверх звука кадра — по окнам 0,5 с, подряд идущие окна — одна находка
seg_at = lambda t: next((x for x in segs if x["start"] <= t < x["end"]), None)
def words_at(sg, t0, t1):
    """Есть ли слова исходника в окне фильма [t0, t1) (None — расшифровки нет)."""
    if not sg or not root: return None
    p, off = sg["src"], 0.0
    if p in alias: p, off = alias[p][0], float(alias[p][1])
    w = idx.get(unicodedata.normalize("NFC", os.path.splitext(os.path.basename(p))[0]))
    if not w: return None
    a0, b0 = sg["in"] + off + (t0 - sg["start"]), sg["in"] + off + (t1 - sg["start"])
    return any(a0 - 0.2 <= x["start"] < b0 + 0.2 for y in json.load(open(w))["segments"] for x in y.get("words", []))
if R_voi and R_base:
    i, n_o = 0, min(len(R_voi), len(R_base))
    while i < n_o:
        if at(R_voi, i) > -35 and at(R_base, i) > -30:
            j = i
            while j < n_o and at(R_voi, j) > -35 and at(R_base, j) > -30: j += 1
            sg = seg_at(i * WIN); hw = words_at(sg, i * WIN, j * WIN)
            if hw or (hw is None and not root):   # расшифровки есть только у клипов с речью: нет файла — нет речи
                F.append((i * WIN, "НАЛОЖЕНИЕ", sg["note"] if sg else "", f"{(j - i) * WIN:.1f} с голос за кадром {max(at(R_voi, k) for k in range(i, j)):.0f} дБ"
                          f" поверх звука кадра {max(at(R_base, k) for k in range(i, j)):.0f} дБ" + (" — в исходнике речь" if hw else ""), None))
            i = j
        else:
            i += 1

# ЧУЖОЙ ЗВУК: отрезок чужого ролика слышен в «без музыки»
FOREIGN = re.compile(r"/Собраны/|/НАШИ ФОТКИ/|metravel-film-work", re.I)
if R_base:
    for sg in segs:
        p = sg["src"]; q = alias[p][0] if p in alias else p
        if not (FOREIGN.search(p) or FOREIGN.search(q)): continue
        i0, i1 = int(round(sg["start"] / WIN)), int(round(sg["end"] / WIN))
        e = energy_db(R_base, i0, i1)
        if e > -40:
            F.append((sg["start"], "ЧУЖОЙ ЗВУК", sg["note"], f"звук ролика «{os.path.basename(q)}» {e:.0f} дБ (нужно ≤ −40: глушить; свой — \"own_audio\": true)", None))

F.sort()
tc = lambda x: f"{int(x // 60)}:{x % 60:04.1f}"
lines = [f"# Проверка на слух: {os.path.basename(film)}, находок {len(F)}", ""]
for k in ["ЧУЖОЙ ЗВУК", "НАЛОЖЕНИЕ", "ТОНЕТ", "ЗАПАС", "НЕСЛЫШНО", "ГРОМКО", "ПРОВАЛ", "ПАУЗА"]:
    rows = [f for f in F if f[1] == k]
    lines += [f"## {k} — {len(rows)}"] + ([f"- {tc(t)} «{n[:44]}»: {x}" for t, _, n, x, _ in rows] or ["- нет"]) + [""]
txt = "\n".join(lines)
if out:
    open(out, "w").write(txt)
    # машиночитаемо — для сборки: сколько опустить музыку на отрезке (до разницы 12 LU)
    json.dump([{"start": t, "kind": k, "note": n, "smr": v} for t, k, n, _, v in F], open(os.path.splitext(out)[0] + ".json", "w"), ensure_ascii=False, indent=1)
print(txt)
