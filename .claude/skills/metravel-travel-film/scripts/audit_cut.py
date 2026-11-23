#!/usr/bin/env python3
"""Автопроверка монтажа по плану до рецензии: то, что рецензент по листам кадров и уровню звука пропускает.

audit_cut.py <plan.json> --words-root DIR [--alias alias.json] [--catalog кадры_sN.json] [--out audit.md]

plan.json — формат make_wfp/plan_s1 (sources, segments[{src,in,out,note,gain_db,broll,cards}], music{cues,sfx}).
--words-root — папка с расшифровками по словам (*.words.json от mlx_whisper --word-timestamps), ищутся по имени исходника.
--alias — {производный файл: [исходник, сдвиг]} для вертикальных, размытых и подобных копий (речь берётся из исходника).
--catalog — каталог меток кадров серии (по умолчанию <папка плана>/../данные/кадры_sN.json, N — из имени plan_sN…):
            {"темы": {"кухня": ["кухн", "плит", "готов"], …},          метка → начала слов, которыми о ней говорят
             "кадры": [{"file": "<исходник>", "in": 12.0, "out": 18.0, "метки": ["кухня", "кофе"]}, …]}
            метки — только то, что видно в кадре; «мы идём» — с уточнением «вдвоём», «в одну сторону».
Соглашение заметок: «рассказ:» — воспоминание (рассказ на другой день), «тизер» — намеренно короткие планы.

Проверки (каждая находка — строка с таймкодом фильма):
  ФРАЗА     край куска режет слово или фразу (сосед — не продолжение того же плана)
  ПОКАЗ     перебивка поверх живой речи с сильным указателем («смотрите», «видите», «вон», «написано», «покажу», «вот этот/эта»)
            — прячет показанное
  НЕМОЙ     в кадре говорят (≥3 слов), а звук плана заглушён и голоса за кадром нет
  ГОЛОС     голос за кадром (cue с уровнем ≥ 20: связка, доозвучка) длиннее своего места от a до b — продлить кадр;
            или звучит поверх живой речи плана (слово ближе 0,1 с до и 0,3 с после голоса). Правило доозвучки 23.11:
            голос через ≈0,3 с после начала кадра, после голоса ≥ 0,3 с кадра
  ВРЕМЯ     живые сцены идут не в порядке съёмки (откат больше 15 минут)
  ПОВТОР    один и тот же кусок исходника в фильме дважды
  ПЛАШКА    титр короче 3 с; две плашки одновременно
  ОКНО      плашка заходит на окошко «картинка в картинке» (рассказчик) того же отрезка — текст под ним (overlay_geom.py)
  МУЗЫКА    участок фильма дольше 1 с без музыки и без голоса
  КОРОЧЕ 4 С любой план — главный, перебивка, фото — на экране меньше 4 с (владелец 22.11, s3 v19: «сплошное мелькание,
            минимум кадр 4 секунды»); подряд идущие куски одного исходника (дрон, проход) — один план. Тизер — тоже.
  ТЕМА      перебивка поверх речи (≥3 слов) не показывает того, о чём говорят: ни одна её метка из каталога кадров
            не звучит в словах под ней (±2 с); перебивки нет в каталоге — тоже находка. Нет каталога — пропуск.
  ВЫХОД     возврат из воспоминания к событиям без плашки места/времени
  НЕ ВОШЛО С НАМИ справка: клипы каталога с нами (метки людей, без брака) ≥ 4 с, которых нет в плане ни секунды —
            с учётом копий размытия, памяти, вертикалей и фото (unused.py). Владелец 23.11: еда, вечера, проходки.
  ТЕМП      справка, не находки: планов в минуту, медиана, доля 8+ с, фото ≤ 5 % времени; говорящая голова > 8 с без
            перебивки. Цели «медиана ≤ 3,5 с» и «8+ с ≤ 15 %» сняты 22.11 — по ним вышел калейдоскоп s3 v19.
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

# ГОЛОС (рецензент 23.11, доозвучка немых моментов): голос за кадром помещается в своё место и не заходит на живую речь
def _fdur(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except ValueError: return None
_live = None
def live_words():
    """Слова живой речи в фильме: (время фильма, слово) по незаглушённым кускам главного плана."""
    global _live
    if _live is None:
        _live = []
        for i_, s_ in enumerate(SEG):
            if (s_.get("gain_db", 0) or 0) <= -40: continue
            w_, _, _ = words_for(S[s_["src"]])
            _live += [(T[i_] + x[1] - s_["in"], x[0]) for x in (w_ or []) if s_["in"] <= x[1] < s_["out"]]
    return _live
for c in (plan.get("music") or {}).get("cues", []):
    if c.get("level_db", 0) < 20 or c.get("bed") or c.get("file", "").lower().endswith(".mp3") or not os.path.exists(c.get("file", "")): continue
    a0, b0 = film(*c["a"]), film(*c["b"])                # подложки после duck_beds тоже бывают ≥ 20 — не голос
    L = _fdur(c["file"])
    if a0 is None or b0 is None or not L: continue
    L -= c.get("src_in", 0.0); nm = c.get("name", os.path.basename(c["file"]))[:40]
    i0 = next((k for k in range(len(SEG)) if T[k] <= a0 + 0.001 < T[k] + SEG[k]["out"] - SEG[k]["in"]), None)
    if L > b0 - a0 + 0.05:
        add("ГОЛОС", a0, SEG[i0]["note"] if i0 is not None else "", f"«{nm}» {L:.2f} с не помещается: место до конца cue {b0 - a0:.2f} с — продлить кадр")
    hit = [w_ for t_, w_ in live_words() if a0 - 0.1 <= t_ <= a0 + L + 0.3]
    if hit:
        add("ГОЛОС", a0, SEG[i0]["note"] if i0 is not None else "", f"«{nm}» заходит на живую речь: «{' '.join(hit[:6])}»")

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
    if prv and "рассказ:" in prv["note"] and not recap:
        if not any(("выход" in c["file"] or "место " in c["file"]) for c in s.get("cards", [])):
            add("ВЫХОД", T[i], note, "возврат из воспоминания без плашки «где и когда»")

cov = sorted(music + voice); end = 0.0
for a_, b_ in cov:
    if a_ > end + 1.0: add("МУЗЫКА", end, "", f"{a_ - end:.1f} с без музыки и голоса")
    end = max(end, b_)
if t > end + 1.0: add("МУЗЫКА", end, "", f"{t - end:.1f} с без музыки в конце")

def orig_of(f, t0=0.0):                                  # производная копия → (исходник, время в нём)
    if f in alias: return alias[f][0], t0 + float(alias[f][1])
    return f, t0

# планы по плану: главный план между перебивками и каждая перебивка (без вспышек)
SH = []                                                 # (начало в фильме, длина, исходник, заметка, отрезок, тизер)
for i, s in enumerate(SEG):
    br = sorted([o for o in s.get("broll", []) if not o.get("flash")], key=lambda o: o["at"])
    cur = s["in"]; tz = "тизер" in s["note"]
    for o in br + [None]:
        b0 = s["out"] if o is None else max(s["in"], o["at"])
        if b0 - cur > 0.05: SH.append((T[i] + cur - s["in"], b0 - cur, orig_of(S[s["src"]])[0], s["note"], i, tz))
        if o is None: break
        d_ = min(o["dur"], s["out"] - o["at"])
        if d_ > 0.05: SH.append((T[i] + o["at"] - s["in"], d_, orig_of(o.get("orig", {}).get("file", o["file"]))[0], s["note"] + " / перебивка", i, tz))
        cur = max(cur, o["at"] + o["dur"])
SH.sort()

# КОРОЧЕ 4 С: подряд идущие куски одного исходника (дрон, проход, перебивка через стык отрезков) — один план
MIN_SHOT = 4.0
run = []
for x in SH + [None]:
    if run and x and x[2] == run[-1][2] and abs(x[0] - (run[-1][0] + run[-1][1])) < 0.15:
        run.append(x); continue
    if run:
        d = run[-1][0] + run[-1][1] - run[0][0]
        if d < MIN_SHOT - 0.05:
            add("КОРОЧЕ 4 С", run[0][0], run[0][3], f"план {d:.1f} с ({os.path.basename(run[0][2])[:28]}{', ' + str(len(run)) + ' куска' if len(run) > 1 else ''})"
                + (" — тизер" if run[0][5] else ""))
    run = [x] if x else []

# ТЕМА: перебивка показывает то, о чём говорят сейчас (каталог меток кадров + стенограмма)
m_ = re.search(r"plan_s(\d+)", os.path.basename(a[0]))
cat_p = a[a.index("--catalog") + 1] if "--catalog" in a else (
    os.path.join(os.path.dirname(os.path.abspath(a[0])), "..", "данные", f"кадры_s{m_.group(1)}.json") if m_ else None)
THEME_NOTE = []
if cat_p and os.path.exists(cat_p):
    CAT = json.load(open(cat_p))
    import shot_catalog as SC
    LEX = {k: [x.lower() for x in v] for k, v in (CAT.get("темы") or {}).items()}
    def stems(tag):                                     # метка без словаря — её же слова (начало, 5 букв)
        return LEX.get(tag) or SC.DERIVED_LEX.get(tag) or [w[:5] for w in re.findall(r"\w+", tag.lower()) if len(w) >= 4]
    def tags_of(f, a0, b0):
        dur = b0 - a0; f, a0 = orig_of(f, a0); b0 = a0 + dur
        out_ = set(); hit = False
        for e in CAT.get("кадры", []):          # метки всех кусков каталога, которые видны в перебивке ≥ 1 с (длинная перебивка — несколько плиток)
            if e["file"] != f and os.path.basename(e["file"]) != os.path.basename(f): continue
            ov = min(b0, e.get("out", 1e9)) - max(a0, e.get("in", 0))
            if ov >= min(1.0, 0.5 * (b0 - a0)) or ("in" not in e): hit = True; out_ |= SC.piece_tags(e)   # + еда/ужин/отдых/сборы…
        return out_ if hit else None
    voice_w = []                                        # слова голоса за кадром во времени фильма
    for c in (plan.get("music") or {}).get("cues", []):
        if c.get("level_db", 0) < 20: continue
        a0 = film(*c["a"]); b0 = film(*c["b"])
        w, _, _ = words_for(c["file"])
        if a0 is None or b0 is None or not w: continue
        voice_w += [(x[0], a0 + x[1] - c.get("src_in", 0)) for x in w if a0 <= a0 + x[1] - c.get("src_in", 0) <= b0]
    n_chk = n_cat = 0
    for i, s in enumerate(SEG):
        muted = (s.get("gain_db", 0) or 0) <= -40
        w, _, _ = words_for(S[s["src"]])
        for o in s.get("broll", []):
            if o.get("flash"): continue
            at_f = T[i] + o["at"] - s["in"]
            ws = [x[0] for x in (w or []) if not muted and o["at"] - 2 <= x[1] < o["at"] + o["dur"] + 1]
            ws += [x[0] for x in voice_w if at_f - 2 <= x[1] < at_f + o["dur"] + 1]
            if len(ws) < 3: continue                     # под видом без речи тема не проверяется
            n_chk += 1
            f0 = o.get("orig", {}).get("file", o["file"]); i0 = o.get("orig", {}).get("in", o.get("in", 0))
            tg = tags_of(f0, i0, i0 + o["dur"])
            name = os.path.basename(f0)[:28]
            if tg is None:
                n_cat += 1; add("ТЕМА", at_f, s["note"], f"{name} {o['dur']:.1f} с — нет в каталоге кадров; под ним: «{' '.join(ws)[:100]}»"); continue
            if not any(x.startswith(st) for t_ in tg for st in stems(t_) for x in ws):
                add("ТЕМА", at_f, s["note"], f"{name} [{', '.join(sorted(tg))}] {o['dur']:.1f} с, а говорят: «{' '.join(ws)[:100]}»")
    THEME_NOTE = [f"ТЕМА: каталог {os.path.basename(cat_p)}, перебивок под речью {n_chk}, из них нет в каталоге {n_cat}"]
else:
    THEME_NOTE = [f"ТЕМА — ПРОПУСК: нет каталога меток кадров ({cat_p or 'имя плана без sN, укажите --catalog'})"]

# ТЕМП — справка (рецензент 22.11: цели медианы и доли длинных планов сняты)
TEMPO = []
SHt = [x for x in SH if not x[5]]
if SHt:
    import statistics
    dl = [x[1] for x in SHt]; tot_ = sum(dl)
    photo_t = sum(x[1] for x in SHt if "/фото/" in x[2])
    TEMPO = [f"планов {len(SHt)}, в минуту {len(SHt) / (tot_ / 60):.1f}; медиана {statistics.median(dl):.1f} с; короче 4 с — "
             f"{sum(1 for d in dl if d < MIN_SHOT - 0.05) / len(dl):.0%}; 8+ с — {sum(1 for d in dl if d >= 8) / len(dl):.0%}; "
             f"фото — {photo_t / tot_:.0%} времени (цель ≤ 5 %){' ✗' if photo_t / tot_ > 0.05 else ''}"]
    for t0, d, f, n_, i, _ in SHt:                      # справка: говорящая голова без перебивки
        if d < 8 or "перебивка" in n_ or (SEG[i].get("gain_db", 0) or 0) <= -40: continue
        w, _, _ = words_for(S[SEG[i]["src"]])
        if w and sum(1 for x in w if SEG[i]["in"] <= x[1] < SEG[i]["out"]) >= 8:
            TEMPO.append(f"  {tc(t0)} «{n_[:40]}»: говорящая голова {d:.1f} с без перебивки — перебивка, только если есть кадр о том, о чём речь")

# НЕ ВОШЛО С НАМИ — справка (владелец 23.11: «должны быть все ужины, завтраки, вечер на лежаках, красивые проходки»):
# клипы каталога, где в кадре мы (метки людей, без брака), не короче 4 с, из которых план не взял ничего (unused.py)
NOT_IN = []
if cat_p and os.path.exists(cat_p):
    import unused as UN
    try:
        rows_ = UN.unused_with_people(plan, cat_p, os.path.dirname(os.path.abspath(a[0])))
        NOT_IN = [f"## НЕ ВОШЛО С НАМИ (справка) — {len(rows_)}", "клипы с нами ≥ 4 с вне плана: глянуть, нет ли тут еды, вечера, "
                  "проходки — полный разбор: unused.py report", ""] + \
                 [f"- {tm or '—'} `{'/'.join(f_.split('/')[-2:])}` — с нами {ln:.0f} с, {cat_}: {see_[:110]}" for f_, ln, cat_, tm, see_ in rows_] + [""]
    except Exception as e_:
        NOT_IN = [f"## НЕ ВОШЛО С НАМИ — ошибка справки: {e_}", ""]

F.sort()
lines = [f"# Автопроверка монтажа: {os.path.basename(a[0])}, {t / 60:.1f} мин, находок {len(F)}", ""] + THEME_NOTE + [""] + ([f"Темп (справка): {TEMPO[0]}"] + TEMPO[1:] + [""] if TEMPO else [])
for kind in ["ФРАЗА", "ПОКАЗ", "НЕМОЙ", "ГОЛОС", "ВРЕМЯ", "ПОВТОР", "ПЛАШКА", "ОКНО", "МУЗЫКА", "ВЫХОД", "КОРОЧЕ 4 С", "ТЕМА"]:
    rows = [f for f in F if f[1] == kind]
    lines.append(f"## {kind} — {len(rows)}")
    lines += [f"- {tc(at)} «{note[:46]}»: {text}" for at, _, note, text in rows] or ["- нет"]
    lines.append("")
lines += NOT_IN
txt = "\n".join(lines)
if out: open(out, "w").write(txt)
print(txt)
