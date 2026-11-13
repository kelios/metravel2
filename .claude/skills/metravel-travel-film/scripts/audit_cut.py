#!/usr/bin/env python3
"""Автопроверка монтажа по плану до рецензии: то, что рецензент по листам кадров и уровню звука пропускает.

audit_cut.py <plan.json> --words-root DIR [--alias alias.json] [--out audit.md]

plan.json — формат make_wfp/plan_s1 (sources, segments[{src,in,out,note,gain_db,broll,cards}], music{cues,sfx}).
--words-root — папка с расшифровками по словам (*.words.json от mlx_whisper --word-timestamps), ищутся по имени исходника.
--alias — {производный файл: [исходник, сдвиг]} для вертикальных, размытых и подобных копий (речь берётся из исходника).
Соглашение заметок: «рассказ:» — воспоминание (рассказ на другой день), «тизер» — намеренно короткие планы.

Проверки (каждая находка — строка с таймкодом фильма):
  ФРАЗА     край куска режет слово или фразу (сосед — не продолжение того же плана)
  ПОКАЗ     перебивка поверх живой речи со словами-указателями («вот этот», «тут написано», «смотрите») — прячет показанное
  НЕМОЙ     в кадре говорят (≥3 слов), а звук плана заглушён и голоса за кадром нет
  ВРЕМЯ     живые сцены идут не в порядке съёмки (откат больше 15 минут)
  ПОВТОР    один и тот же кусок исходника в фильме дважды
  ПЛАШКА    титр короче 3 с; две плашки одновременно
  МУЗЫКА    участок фильма дольше 1 с без музыки и без голоса
  МЕЛЬК     главный план виден меньше 2 с между перебивками (кроме тизера)
  ВЫХОД     возврат из воспоминания к событиям без плашки места/времени
"""
import json, os, re, subprocess, sys
from datetime import datetime, timedelta

a = sys.argv[1:]
plan = json.load(open(a[0]))
root = a[a.index("--words-root") + 1]
alias = json.load(open(a[a.index("--alias") + 1])) if "--alias" in a else {}
out = a[a.index("--out") + 1] if "--out" in a else None
S, SEG = plan["sources"], plan["segments"]
DEM = re.compile(r"^(вот|этот|эта|это|этой|эту|этом|тут|здесь|смотрите|смотри|видите|видишь|покажу|показываю|написано|вон|такой|такая|такое)$")

_idx = None
def words_for(path):
    global _idx
    off = 0.0
    if path in alias: path, off = alias[path][0], float(alias[path][1])
    if _idx is None:
        _idx = {}
        for dp, _, fs in os.walk(root):
            for f in fs:
                if f.endswith(".words.json") and not f.startswith("._"): _idx[f[:-11]] = os.path.join(dp, f)
    p = _idx.get(os.path.splitext(os.path.basename(path))[0])
    if not p: return None, path, off
    w = [(x["word"].strip().lower().strip(".,!?«»…"), x["start"] - off, x["end"] - off) for s in json.load(open(p))["segments"] for x in s.get("words", [])]
    return w, path, off

def shot_time(path):
    if path in alias: path = alias[path][0]
    m = re.search(r"_(\d{14})_", os.path.basename(path))
    if m: return datetime.strptime(m.group(1), "%Y%m%d%H%M%S")
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags=creation_time", "-of", "csv=p=0", path], capture_output=True, text=True)
    try: return datetime.fromisoformat(r.stdout.strip()[:19]) + timedelta(hours=2)
    except Exception: return None

T, t = [], 0.0
for s in SEG: T.append(t); t += s["out"] - s["in"]
def tc(x): return f"{int(x // 60)}:{x % 60:04.1f}"
F = []
def add(kind, at, note, text): F.append((at, kind, note, text))

voice = []                                  # голос за кадром (уровень ≥ 20 в плане)
def film(srckey, tt):
    for i, s in enumerate(SEG):
        if s["src"] == srckey and s["in"] - 0.01 <= tt <= s["out"] + 0.01: return T[i] + tt - s["in"]
music = []
for c in (plan.get("music") or {}).get("cues", []):
    a0, b0 = film(*c["a"]), film(*c["b"])
    if a0 is None or b0 is None: continue
    (voice if c.get("level_db", 0) >= 20 else music).append((a0, b0))

used = {}
prev_live = None
for i, s in enumerate(SEG):
    p = S[s["src"]]; d = s["out"] - s["in"]; note = s["note"]
    recap = "рассказ:" in note; teaser = "тизер" in note
    w, orig, off = words_for(p)
    prv = SEG[i - 1] if i else None; nxt = SEG[i + 1] if i + 1 < len(SEG) else None
    cont_p = prv and prv["src"] == s["src"] and abs(prv["out"] - s["in"]) < 0.05
    cont_n = nxt and nxt["src"] == s["src"] and abs(nxt["in"] - s["out"]) < 0.05
    muted = (s.get("gain_db", 0) or 0) <= -40
    if w:
        inside = [x for x in w if x[1] >= s["in"] - 0.05 and x[2] <= s["out"] + 0.05]
        if not muted and inside:
            bef = [x for x in w if x[2] > s["in"] - 0.6 and x[1] < s["in"] - 0.05]
            aft = [x for x in w if x[1] < s["out"] + 0.6 and x[2] > s["out"] + 0.05]
            if bef and not cont_p:
                add("ФРАЗА", T[i], note, f"начало режет: …{' '.join(x[0] for x in bef[-4:])} | {' '.join(x[0] for x in inside[:4])}")
            if aft and not cont_n:
                add("ФРАЗА", T[i] + d, note, f"конец режет: {' '.join(x[0] for x in inside[-4:])} | {' '.join(x[0] for x in aft[:5])}…")
        if not muted and not recap:
            for o in s.get("broll", []):
                if o.get("flash"): continue
                ws = [x[0] for x in w if o["at"] <= x[1] < o["at"] + o["dur"]]
                dem = [x for x in ws if DEM.match(x)]
                if len(ws) >= 3 and dem:
                    add("ПОКАЗ", T[i] + o["at"] - s["in"], note, f"{os.path.basename(o['file'])[:28]} {o['dur']:.1f} с поверх: «{' '.join(ws)[:120]}»")
        if muted and len(inside) >= 3:
            covered = sum(max(0, min(b, T[i] + d) - max(a_, T[i])) for a_, b in voice)
            br = sum(o["dur"] for o in s.get("broll", []))
            if covered < 0.5 * d and br < 0.8 * d:
                add("НЕМОЙ", T[i], note, f"в плане {len(inside)} слов («{' '.join(x[0] for x in inside[:8])}…»), звук заглушён, голоса за кадром нет")
    if not recap and not teaser and not note.startswith(("интро", "15.")):
        st = shot_time(p)
        if st and prev_live and st < prev_live[0] - timedelta(minutes=15):
            add("ВРЕМЯ", T[i], note, f"снято {st:%d.%m %H:%M}, а предыдущая живая сцена «{prev_live[1][:40]}» — {prev_live[0]:%H:%M}")
        if st: prev_live = (st, note)
    key = alias.get(p, [p])[0]
    for a_, b_, n_ in used.get(key, []):
        if min(b_, s["out"]) - max(a_, s["in"]) > 1.0:
            add("ПОВТОР", T[i], note, f"кусок уже был в «{n_[:40]}»")
    used.setdefault(key, []).append((s["in"], s["out"], note))
    for o in s.get("broll", []):                       # перебивки тоже: один кадр второй раз без замысла
        if o.get("flash") or o.get("bridge"): continue
        f0 = o.get("orig", {}).get("file", o["file"]); i0 = o.get("orig", {}).get("in", o.get("in", 0))
        if f0 in alias: f0, sh = alias[f0][0], float(alias[f0][1]); i0 += sh
        for a_, b_, n_ in used.get(f0, []):
            if min(b_, i0 + o["dur"]) - max(a_, i0) > 1.0:
                add("ПОВТОР", T[i] + o["at"] - s["in"], note, f"перебивка {os.path.basename(f0)[:28]} уже была в «{n_[:40]}»")
        used.setdefault(f0, []).append((i0, i0 + o["dur"], note + " / перебивка"))
    cards = [c for c in s.get("cards", []) if not c.get("pip") and c["file"].lower().endswith(".png")]
    for c in cards:
        if c["dur"] < 3.0 and not teaser: add("ПЛАШКА", T[i] + c["at"] - s["in"], note, f"{os.path.basename(c['file'])} на экране {c['dur']:.1f} с")
    if not teaser and not recap:
        br = sorted([o for o in s.get("broll", []) if not o.get("flash")], key=lambda o: o["at"])
        edges = [s["in"]] + [x for o in br for x in (o["at"], o["at"] + o["dur"])] + [s["out"]]
        for g0, g1 in zip(edges[::2], edges[1::2]):
            if 0.05 < g1 - g0 < 2.0 and not (g0 == s["in"] and cont_p) and not (g1 == s["out"] and cont_n):
                add("МЕЛЬК", T[i] + g0 - s["in"], note, f"главный план {g1 - g0:.1f} с между перебивками")
    if prv and "рассказ:" in prv["note"] and not recap:
        if not any(("выход" in c["file"] or "место " in c["file"]) for c in s.get("cards", [])):
            add("ВЫХОД", T[i], note, "возврат из воспоминания без плашки «где и когда»")

cov = sorted(music + voice); end = 0.0
for a_, b_ in cov:
    if a_ > end + 1.0: add("МУЗЫКА", end, "", f"{a_ - end:.1f} с без музыки и голоса")
    end = max(end, b_)
if t > end + 1.0: add("МУЗЫКА", end, "", f"{t - end:.1f} с без музыки в конце")

F.sort()
lines = [f"# Автопроверка монтажа: {os.path.basename(a[0])}, {t / 60:.1f} мин, находок {len(F)}", ""]
for kind in ["ФРАЗА", "ПОКАЗ", "НЕМОЙ", "ВРЕМЯ", "ПОВТОР", "ПЛАШКА", "МУЗЫКА", "МЕЛЬК", "ВЫХОД"]:
    rows = [f for f in F if f[1] == kind]
    lines.append(f"## {kind} — {len(rows)}")
    lines += [f"- {tc(at)} «{note[:46]}»: {text}" for at, _, note, text in rows] or ["- нет"]
    lines.append("")
txt = "\n".join(lines)
if out: open(out, "w").write(txt)
print(txt)
