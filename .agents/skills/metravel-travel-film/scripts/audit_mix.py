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
  ГРОМКО   без речи музыка громче соседней речи больше чем на 3 LU
  ПРОВАЛ   ниже −50 dBFS дольше 0,5 с
"""
import json, os, re, subprocess, sys, tempfile, unicodedata

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

def mean_db(series, a0, b0):
    v = [m for t, m in series if a0 <= t < b0 and m > -70]
    if not v: return -99.0
    import math
    return 10 * math.log10(sum(10 ** (m / 10) for m in v) / len(v))

F = []; SPEECH = {}
S_base = lufs_series(base) if base else []
S_mus = lufs_series(music) if music else []
S_voi = lufs_series(voice) if voice else []
for s in segs:
    a0, b0 = s["start"] + 0.3, s["end"] - 0.3
    if b0 - a0 < 1: continue
    vo = mean_db(S_voi, a0, b0); sw = src_words(s) if root else None
    talking = vo > -35 or (sw is not None and len([w for w in sw if len(w) > 1]) >= 3) or (sw is None and not root)
    sp = max(mean_db(S_base, a0, b0) if (sw and len(sw) >= 3) or not root else -99, vo)
    mu = mean_db(S_mus, a0, b0)
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

F.sort()
tc = lambda x: f"{int(x // 60)}:{x % 60:04.1f}"
lines = [f"# Проверка на слух: {os.path.basename(film)}, находок {len(F)}", ""]
for k in ["ТОНЕТ", "НЕСЛЫШНО", "ГРОМКО", "ПРОВАЛ"]:
    rows = [f for f in F if f[1] == k]
    lines += [f"## {k} — {len(rows)}"] + ([f"- {tc(t)} «{n[:44]}»: {x}" for t, _, n, x, _ in rows] or ["- нет"]) + [""]
txt = "\n".join(lines)
if out:
    open(out, "w").write(txt)
    # машиночитаемо — для сборки: сколько опустить музыку на отрезке (до разницы 12 LU)
    json.dump([{"start": t, "kind": k, "note": n, "smr": v} for t, k, n, _, v in F], open(os.path.splitext(out)[0] + ".json", "w"), ensure_ascii=False, indent=1)
print(txt)
