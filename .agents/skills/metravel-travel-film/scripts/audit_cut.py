#!/usr/bin/env python3
"""Автопроверка монтажа по плану до рецензии: то, что рецензент по листам кадров и уровню звука пропускает.

audit_cut.py <plan.json> --words-root DIR [--alias alias.json] [--out audit.md]

plan.json — формат make_wfp/plan_s1 (sources, segments[{src,in,out,note,gain_db,broll,cards}], music{cues,sfx}).
--words-root — папка с расшифровками по словам (*.words.json от mlx_whisper --word-timestamps), ищутся по имени исходника.
--alias — {производный файл: [исходник, сдвиг]} для вертикальных, размытых и подобных копий (речь берётся из исходника).
Соглашение заметок: «рассказ:» — воспоминание (рассказ на другой день), «тизер» — намеренно короткие планы.

Проверки (каждая находка — строка с таймкодом фильма):
  ФРАЗА     край куска режет слово или фразу (сосед — не продолжение того же плана)
  ПОКАЗ     перебивка поверх живой речи с сильным указателем («смотрите», «видите», «вон», «написано», «покажу», «вот этот/эта»)
            — прячет показанное
  НЕМОЙ     в кадре говорят (≥3 слов), а звук плана заглушён и голоса за кадром нет
  ВРЕМЯ     живые сцены идут не в порядке съёмки (откат больше 15 минут)
  ПОВТОР    один и тот же кусок исходника в фильме дважды
  ПЛАШКА    титр короче 3 с; две плашки одновременно
  ОКНО      плашка заходит на окошко «картинка в картинке» (рассказчик) того же отрезка — текст под ним (overlay_geom.py)
  МУЗЫКА    участок фильма дольше 1 с без музыки и без голоса
  МЕЛЬК     главный план виден меньше 2 с между перебивками (кроме тизера)
  ВЫХОД     возврат из воспоминания к событиям без плашки места/времени
  ТЕМП      сводка (планов в минуту, медиана ≤ 3,5 с, 8+ с ≤ 15 %, фото ≤ 5 %) и находки: план ≥ 8 с не с дрона и не вид;
            говорящая голова > 8 с без перебивки (правила монтажа GR21, рецензент 22.11)
"""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import overlay_geom as OG   # где плашка и окошко — та же геометрия, что у раскладки плана
from auto_level import real_words   # слова расшифровки без «Субтитры сделал DimaTorzok» и «мах мах мах»
from datetime import datetime, timedelta

a = sys.argv[1:]
plan = json.load(open(a[0]))
root = a[a.index("--words-root") + 1]
alias = json.load(open(a[a.index("--alias") + 1])) if "--alias" in a else {}
out = a[a.index("--out") + 1] if "--out" in a else None
S, SEG = plan["sources"], plan["segments"]
# сильные указатели (рецензент 22.11, s3 v19: «вот», «это», «тут» звучат в разговоре каждые 2 с — 57 ложных ПОКАЗ):
# одно слово — «смотрите / видите / вон / написано / покажу», или пара «вот этот / вот эта / вот это …»
DEM = re.compile(r"^(смотрите|смотри|видите|видишь|покажу|показываю|написано|вон)$")
DEM2 = re.compile(r"^(этот|эта|это|эту|этой|этом|эти|этих)$")

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
    w = [(x["word"].strip().lower().strip(".,!?«»…"), x["start"] - off, x.get("end", x["start"] + 0.3) - off) for x in real_words(p)]   # без галлюцинаций whisper
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
                dem = [x for x in ws if DEM.match(x)] + [f"вот {b_}" for a_, b_ in zip(ws, ws[1:]) if a_ == "вот" and DEM2.match(b_)]
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
    key, sh = (alias[p][0], float(alias[p][1])) if p in alias else (p, 0.0)   # производная копия: время исходника = время копии + сдвиг
    for a_, b_, n_ in used.get(key, []):
        if min(b_, s["out"] + sh) - max(a_, s["in"] + sh) > 1.0:
            add("ПОВТОР", T[i], note, f"кусок уже был в «{n_[:40]}»")
    used.setdefault(key, []).append((s["in"] + sh, s["out"] + sh, note))
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
        if c.get("cont"): continue                     # продолжение плашки поверх стыка — меряется по первому куску ("span")
        if c.get("span", c["dur"]) < 3.0 and not teaser: add("ПЛАШКА", T[i] + c["at"] - s["in"], note, f"{os.path.basename(c['file'])} на экране {c.get('span', c['dur']):.1f} с")
    for c, p in OG.clashes(s):
        add("ОКНО", T[i] + max(c["at"], p["at"]) - s["in"], note, f"{os.path.basename(c['file'])} заходит на окошко рассказчика — текст под ним")
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

# ТЕМП (рецензент 22.11, правила монтажа GR21): планы по плану — главный план между перебивками и каждая перебивка
SH = []                                                 # (начало в фильме, длина, файл, заметка, отрезок)
for i, s in enumerate(SEG):
    if "тизер" in s["note"]: continue
    br = sorted([o for o in s.get("broll", []) if not o.get("flash")], key=lambda o: o["at"])
    cur = s["in"]
    for o in br + [None]:
        b0 = s["out"] if o is None else max(s["in"], o["at"])
        if b0 - cur > 0.3: SH.append((T[i] + cur - s["in"], b0 - cur, S[s["src"]], s["note"], i))
        if o is None: break
        d_ = min(o["dur"], s["out"] - o["at"])
        if d_ > 0.3: SH.append((T[i] + o["at"] - s["in"], d_, o.get("orig", {}).get("file", o["file"]), s["note"] + " / перебивка", i))
        cur = max(cur, o["at"] + o["dur"])
TEMPO = []
if SH:
    import statistics
    dl = [d for _, d, _, _, _ in SH]; tot_ = sum(dl)
    drone = lambda f: bool(re.fullmatch(r"DJI_\d{4}\.MP4", os.path.basename((alias.get(f) or [f])[0]), re.I))
    photo_t = sum(d for _, d, f, _, _ in SH if "/фото/" in f)
    med = statistics.median(dl); long8 = sum(1 for d in dl if d >= 8) / len(dl)
    TEMPO = [f"планов {len(SH)}, в минуту {len(SH) / (tot_ / 60):.1f}; медиана {med:.1f} с (цель ≤ 3,5){' ✗' if med > 3.5 else ''}; "
             f"8+ с — {long8:.0%} (цель ≤ 15 %){' ✗' if long8 > 0.15 else ''}; фото — {photo_t / tot_:.0%} времени (цель ≤ 5 %){' ✗' if photo_t / tot_ > 0.05 else ''}"]
    for t0, d, f, n_, i in SH:                         # одна находка на план: голова без перебивки или просто длинный план
        if d < 8 or "/фото/" in f: continue
        head = False
        if "перебивка" not in n_ and (SEG[i].get("gain_db", 0) or 0) > -40:
            w, _, _ = words_for(S[SEG[i]["src"]])
            head = bool(w) and sum(1 for x in w if SEG[i]["in"] <= x[1] < SEG[i]["out"]) >= 8
        if head:
            add("ТЕМП", t0, n_, f"говорящая голова {d:.1f} с без перебивки (цель ≤ 8 с, дальше — то, о чём речь)")
        elif not drone(f) and not re.search(r"дрон|вид|панорам|сверху|карта", n_, re.I):
            add("ТЕМП", t0, n_, f"план {d:.1f} с ({os.path.basename(f)[:28]}) — длиннее 6 с только дрон, вид под музыку или реплика без перебивки")

F.sort()
lines = [f"# Автопроверка монтажа: {os.path.basename(a[0])}, {t / 60:.1f} мин, находок {len(F)}", ""] + ([f"Темп: {x}" for x in TEMPO] + [""] if TEMPO else [])
for kind in ["ФРАЗА", "ПОКАЗ", "НЕМОЙ", "ВРЕМЯ", "ПОВТОР", "ПЛАШКА", "ОКНО", "МУЗЫКА", "МЕЛЬК", "ВЫХОД", "ТЕМП"]:
    rows = [f for f in F if f[1] == kind]
    lines.append(f"## {kind} — {len(rows)}")
    lines += [f"- {tc(at)} «{note[:46]}»: {text}" for at, _, note, text in rows] or ["- нет"]
    lines.append("")
txt = "\n".join(lines)
if out: open(out, "w").write(txt)
print(txt)
