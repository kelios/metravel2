#!/usr/bin/env python3
"""Проверка «на слух» без слуха: слышна ли речь под музыкой и нет ли провалов.

audit_mix.py <фильм.mp4> --segments <segments.json> --base <без_музыки.mov> [--music <музыка.wav>] [--voice <голос.wav>]
             [--words-root DIR] [--out audit_mix.md]

segments.json — таблица отрезков рендера (start, end, note, src, in, out): её пишет proxy_render.py рядом с фильмом.
--base — звук живых планов без музыки; --music / --voice — дорожки музыки и голоса за кадром (proxy_render.py пишет их рядом).
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

def lufs_series(path, step=0.4):
    """Кратковременная громкость (M, окно 400 мс) по всему файлу: [(t, lufs)]."""
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", path, "-vn", "-af", "ebur128=metadata=1,ametadata=print:key=lavfi.r128.M",
                        "-f", "null", "-"], capture_output=True, text=True)
    txt = r.stdout + r.stderr
    ts = [float(x) for x in re.findall(r"pts_time:([\d.]+)", txt)]
    ms = [float(x) for x in re.findall(r"lavfi\.r128\.M=(-?[\d.]+|-inf)", txt)]
    return list(zip(ts, ms))

def mean_db(series, a0, b0):
    v = [m for t, m in series if a0 <= t < b0 and m > -70]
    if not v: return -99.0
    import math
    return 10 * math.log10(sum(10 ** (m / 10) for m in v) / len(v))

F = []
S_base = lufs_series(base) if base else []
S_mus = lufs_series(music) if music else []
S_voi = lufs_series(voice) if voice else []
for s in segs:
    a0, b0 = s["start"] + 0.3, s["end"] - 0.3
    if b0 - a0 < 1: continue
    sp = max(mean_db(S_base, a0, b0), mean_db(S_voi, a0, b0))
    mu = mean_db(S_mus, a0, b0)
    if sp > -40 and mu > -60 and sp - mu < 10:
        F.append((s["start"], "ТОНЕТ", s["note"], f"речь {sp:.1f}, музыка {mu:.1f} LUFS — разница {sp - mu:.1f} LU (нужно ≥ 10)"))
    if sp <= -40 and mu > -60:
        nb = [mean_db(S_base, x["start"], x["end"]) for x in segs if abs(x["start"] - s["end"]) < 0.1 or abs(x["end"] - s["start"]) < 0.1]
        nb = [v for v in nb if v > -40]
        if nb and mu - max(nb) > 3: F.append((s["start"], "ГРОМКО", s["note"], f"музыка без речи {mu:.1f}, соседняя речь {max(nb):.1f} LUFS"))

r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", film, "-vn", "-af", "silencedetect=n=-50dB:d=0.5", "-f", "null", "-"], capture_output=True, text=True)
for st, du in zip(re.findall(r"silence_start: ([\d.]+)", r.stderr), re.findall(r"silence_duration: ([\d.]+)", r.stderr)):
    F.append((float(st), "ПРОВАЛ", "", f"{float(du):.1f} с ниже −50 dBFS"))

if root:                                     # разборчивость: whisper по готовому звуку против слов исходника
    N = lambda x: re.sub(r"[^\w]", "", unicodedata.normalize("NFC", x).lower().replace("ё", "е"))
    idx = {}
    for dp, _, fs in os.walk(root):
        for f in fs:
            if f.endswith(".words.json") and not f.startswith("._"): idx[f[:-11]] = os.path.join(dp, f)
    T = tempfile.mkdtemp()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", film, "-vn", "-ac", "1", "-ar", "16000", T + "/a.wav"], check=True)
    subprocess.run(["mlx_whisper", T + "/a.wav", "--model", "mlx-community/whisper-large-v3-turbo", "--language", "ru", "--output-format", "json",
                    "--output-dir", T, "--condition-on-previous-text", "False", "--word-timestamps", "True", "--verbose", "False"], capture_output=True)
    got = [(N(w["word"]), w["start"]) for x in json.load(open(T + "/a.json"))["segments"] for w in x.get("words", [])]
    for s in segs:
        p = idx.get(os.path.splitext(os.path.basename(s["src"]))[0])
        if not p: continue
        src = [N(w["word"]) for x in json.load(open(p))["segments"] for w in x.get("words", []) if s["in"] <= w["start"] < s["out"]]
        src = [w for w in src if len(w) > 2]
        if len(src) < 6: continue
        heard = {w for w, t in got if s["start"] - 1 <= t <= s["end"] + 1}
        rec = sum(1 for w in src if w in heard) / len(src)
        if rec < 0.6: F.append((s["start"], "НЕСЛЫШНО", s["note"], f"узнано {rec:.0%} слов исходника ({len(src)} слов)"))

F.sort()
tc = lambda x: f"{int(x // 60)}:{x % 60:04.1f}"
lines = [f"# Проверка на слух: {os.path.basename(film)}, находок {len(F)}", ""]
for k in ["ТОНЕТ", "НЕСЛЫШНО", "ГРОМКО", "ПРОВАЛ"]:
    rows = [f for f in F if f[1] == k]
    lines += [f"## {k} — {len(rows)}"] + ([f"- {tc(t)} «{n[:44]}»: {x}" for t, _, n, x in rows] or ["- нет"]) + [""]
txt = "\n".join(lines)
if out: open(out, "w").write(txt)
print(txt)
