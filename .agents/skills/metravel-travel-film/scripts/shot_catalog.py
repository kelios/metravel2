#!/usr/bin/env python3
"""Каталог меток кадров и таблица «мысль → кадр» — стиль монтажа v20 (GR21, владелец 22.11: «по таймингу идеально»).

Правила стиля: любой план не короче 4 с; перебивка — только того, о чём говорят сейчас; одна перебивка на мысль, 4–6 с;
нет кадра по теме — остаётся говорящий. Автоподбора «по месту и времени съёмки» нет: перебивки ставит человек по таблице,
этот инструмент даёт ему листы, каталог, мысли, черновой подбор и проверочную таблицу.

Подкоманды (обобщены из v20/*.py серии 3; пути — любые, серия задаётся файлами):

  sheets  --inventory inventory.json --day D [--day D2 …] --out DIR [--tz 2]
          листы кадров дня (клип — кадр каждые 5 с, длиннее 60 с — каждые 10 с; фото целиком), по времени съёмки
          → DIR/лист NN.jpg, DIR/плитки.json {id: {file, t, kind, cam, local}}, DIR/КАК РАЗМЕЧАТЬ.md.
          Метки ставит человек глазами по листам: DIR/метки NN-MM.json {id: {see, tags, people, flags}}.
          Нужен Pillow: uv run --with pillow python shot_catalog.py sheets …
  build   --tiles DIR --themes темы.json [--themes темы_sN.json] --out кадры_sN.json [--extra extra.json] [--photo-copies DIR]
          метки → каталог для audit_cut (ТЕМА): {"темы": {метка: [начала слов]}, "кадры": [{file, in, out, метки, видно, люди, флаги}]}.
          Кусок клипа — окрестность плитки (шаг листа); фото — целиком и все его копии DIR/<номер>_*.mp4 (--photo-copies).
          Метки не из словаря тем не входят в каталог — печатаются, чтобы дописать слово в словарь или исправить метку.
  thoughts <plan.json> --words-root DIR [--alias alias.json] --out мысли.json [--md мысли.md]
          стенограмма говорящих кусков плана, разбитая на мысли (знак конца фразы whisper или пауза ≥ 0,8 с).
  suggest --thoughts мысли.json --catalog кадры_sN.json --out подбор.md [--heads головы.json]
          черновой подбор: темы каждой мысли и до 3 кандидатов из каталога (без номеров, посторонних, пола, селфи и своего
          главного файла; ближе по времени съёмки — выше). Только подсказка: выбирает человек.
  table   <plan.json> --catalog кадры_sN.json --words-root DIR [--alias alias.json] --out таблица.md
          [--cutaways перебивки_sN.json] [--main "ключ=что видно" …]
          таблица «мысль → кадр» по плану для рецензента без рендера: по каждой мысли — слова и кадр поверх (файл, кусок,
          что видно по каталогу, ⚑ причина закрытия из поля "lock" таблицы перебивок) или «главный план».

Слой перебивок из таблицы ставит в план gr21_serial.cutaways(path) (общий код серий на T7), формат строки таблицы:
  {"note": префикс куска, "at": время исходника куска, "dur": 4–6, "day": день, "clip": ключ клипа | "photo": номер,
   "in": вход клипа, "words": слова под кадром, "see": что видно, "lock": "номер машины" | "чужое лицо" | …}
"""
import glob, json, math, os, re, subprocess, sys, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PEOPLE = '`""` (никого), `сергей`, `юля`, `вдвоём, в одну сторону`, `вдвоём, порознь` (навстречу, в разные стороны, один стоит), ' \
         '`сергей идёт` / `юля идёт`, `селфи` (лицо крупно в камеру)'
FLAGS = "`посторонние` (чужие люди, лица видны), `номер` (читаемый номер машины), `тёмный`, `смазано`, `пол` (случайный кадр в пол/небо), `титры`"
BAD = {"номер", "посторонние", "пол", "тёмный", "смазано", "титры"}
tc = lambda s: f"{int(s // 60)}:{s % 60:04.1f}"


def opt(a, k, d=None):
    return a[a.index(k) + 1] if k in a else d


def opts(a, k):
    return [a[i + 1] for i, x in enumerate(a) if x == k and i + 1 < len(a)]


# ---------------------------------------------------------------- слова расшифровки
_IDX = {}
def words_for(path, roots, alias):
    """Слова whisper (без галлюцинаций) для исходника; производная копия → исходник со сдвигом (alias)."""
    from auto_level import real_words
    off = 0.0
    if path in alias: path, off = alias[path][0], float(alias[path][1])
    key = tuple(roots)
    if key not in _IDX:
        _IDX[key] = {}
        for r in roots:
            for dp, _, fs in os.walk(r):
                for f in fs:
                    if f.endswith(".words.json") and not f.startswith("._"): _IDX[key][f[:-11]] = os.path.join(dp, f)
    p = _IDX[key].get(os.path.splitext(os.path.basename(path))[0])
    if not p: return []
    return [(x["word"].strip(), x["start"] - off, x.get("end", x["start"] + 0.3) - off) for x in real_words(p)]


def thoughts_of(plan, roots, alias):
    out = []; t = 0.0; src = plan["sources"]
    for i, x in enumerate(plan["segments"]):
        d = x["out"] - x["in"]; p = src[x["src"]]
        if not ((x.get("gain_db", 0) or 0) <= -40 or x["note"].startswith(("0.", "T."))):
            w = [q for q in words_for(p, roots, alias) if x["in"] - 0.05 <= q[1] < x["out"]]
            if w:
                th, cur = [], [w[0]]
                for a_, b_ in zip(w, w[1:]):
                    if b_[1] - a_[2] >= 0.8 or a_[0][-1:] in ".?!…": th.append(cur); cur = [b_]
                    else: cur.append(b_)
                th.append(cur)
                out.append({"seg": i, "note": x["note"], "film": round(t, 2), "src": os.path.basename((alias.get(p) or [p])[0]),
                            "in": x["in"], "out": x["out"], "thoughts": [[round(c[0][1], 2), round(c[-1][2], 2), " ".join(q[0] for q in c)] for c in th]})
        t += d
    return out


def cmd_thoughts(a):
    plan = json.load(open(a[0])); alias = json.load(open(opt(a, "--alias"))) if "--alias" in a else {}
    out = thoughts_of(plan, opts(a, "--words-root"), alias)
    json.dump(out, open(opt(a, "--out"), "w"), ensure_ascii=False, indent=1)
    if "--md" in a:
        L = []
        for s in out:
            L.append(f"\n## {tc(s['film'])} {s['note']} — {s['src']} {s['in']:.1f}–{s['out']:.1f} ({s['out'] - s['in']:.1f} с)")
            for a_, b_, txt in s["thoughts"]: L.append(f"- {tc(s['film'] + a_ - s['in'])} [{a_:.1f}–{b_:.1f}] {txt}")
        open(opt(a, "--md"), "w").write("\n".join(L) + "\n")
    print(f"говорящих кусков {len(out)}, мыслей {sum(len(s['thoughts']) for s in out)} → {opt(a, '--out')}")


# ---------------------------------------------------------------- листы
def cmd_sheets(a):
    from io import BytesIO
    from PIL import Image, ImageDraw, ImageFont, ImageOps
    inv = json.load(open(opt(a, "--inventory"))); days = {int(x) for x in opts(a, "--day")}; out = opt(a, "--out")
    tz = datetime.timezone(datetime.timedelta(hours=float(opt(a, "--tz", "2"))))
    os.makedirs(out, exist_ok=True)
    F = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 17); TW, TH = 320, 180

    def qt(p):                                   # телефон .MP4: дата съёмки в теге QuickTime
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags=com.apple.quicktime.creationdate", "-of", "csv=p=0", p],
                           capture_output=True, text=True)
        d = r.stdout.strip(); return datetime.datetime.fromisoformat(d).astimezone(datetime.timezone.utc) if d else None

    def exif_t(p):
        try:
            d = Image.open(p).getexif().get(306)
            return datetime.datetime.strptime(d, "%Y:%m:%d %H:%M:%S").replace(tzinfo=tz).astimezone(datetime.timezone.utc) if d else None
        except Exception: return None

    def short(b):
        if b.startswith("Медиатека - "): return b.split(" ")[2]
        return re.sub(r"^DJI_\d{8}", "", b).replace("_D.MP4", "").replace(".MP4", "")

    items = []
    for v in inv:
        if v["day"] not in days or v["kind"] not in ("video", "photo"): continue
        b = os.path.basename(v["path"])
        if v["kind"] == "photo": t = exif_t(v["path"])
        else:
            t = qt(v["path"]) if (v["cam"] == "телефон" and b.endswith(".MP4")) else (
                datetime.datetime.fromisoformat(v["ct"].replace("Z", "+00:00")) if v.get("ct") else None)
        items.append((t or datetime.datetime(2100, 1, 1, tzinfo=datetime.timezone.utc), v))
    items.sort(key=lambda q: q[0])
    tiles, meta = [], {}
    for t, v in items:
        b = os.path.basename(v["path"])
        ts = [None] if v["kind"] == "photo" else (
            lambda st: [min(v["dur"] - 0.3, 0.5 + k * st) for k in range(max(1, math.ceil(v["dur"] / st)))])(10 if v["dur"] > 60 else 5)
        for x in ts:
            tid = f"{len(tiles) + 1:04d}"
            try:
                if x is None:
                    im = ImageOps.exif_transpose(Image.open(v["path"])).convert("RGB"); im.thumbnail((TW, TH))
                    bg = Image.new("RGB", (TW, TH)); bg.paste(im, ((TW - im.width) // 2, (TH - im.height) // 2)); im = bg
                else:
                    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{x:.1f}", "-i", v["path"], "-frames:v", "1", "-vf",
                                        f"scale={TW}:{TH}:force_original_aspect_ratio=decrease,pad={TW}:{TH}", "-f", "image2pipe", "-vcodec", "png", "-"],
                                       capture_output=True, stdin=subprocess.DEVNULL)
                    im = Image.open(BytesIO(r.stdout)).convert("RGB")
            except Exception: im = Image.new("RGB", (TW, TH), (60, 0, 0))
            lt = t.astimezone(tz).strftime("%H:%M") if t.year < 2100 else "??:??"
            lab = f"{tid} {short(b)}" + ("" if x is None else f" {x:.0f}s") + f" {lt}" + (" фото" if x is None else "")
            d = ImageDraw.Draw(im); d.rectangle([0, TH - 21, TW, TH], fill=(0, 0, 0)); d.text((3, TH - 20), lab, font=F, fill=(255, 230, 0))
            tiles.append(im); meta[tid] = {"file": v["path"], "t": x, "kind": v["kind"], "cam": v["cam"], "local": lt}
    cols, rows = 8, 6; n = cols * rows
    for i in range(0, len(tiles), n):
        page = Image.new("RGB", (cols * TW, rows * TH))
        for j, im in enumerate(tiles[i:i + n]): page.paste(im, ((j % cols) * TW, (j // cols) * TH))
        page.save(os.path.join(out, f"лист {i // n + 1:02d}.jpg"), quality=80)
    json.dump(meta, open(os.path.join(out, "плитки.json"), "w"), ensure_ascii=False, indent=0)
    themes = {}
    for p in opts(a, "--themes"): themes.update(json.load(open(p)))
    open(os.path.join(out, "КАК РАЗМЕЧАТЬ.md"), "w").write(
        f"# Каталог кадров (дни {', '.join(map(str, sorted(days)))}): как размечать\n\n"
        "Для каждой плитки — **что видно в кадре**, только видимое. По меткам перебивки ставятся под слова; ошибка в метке = кадр не по теме.\n\n"
        "Плитка: `NNNN клип 25s 09:22` (номер, файл, секунда клипа, местное время) или `NNNN 1441 12:51 фото`.\n\n"
        '```json\n"0123": {"see": "кофемашина на кухне отеля, рука наливает кофе", "tags": ["кухня", "кофемашина", "кофе"], "people": "юля", "flags": []}\n```\n\n'
        "- `see` — 4–12 слов, по-русски, конкретно; не уверен — «неясно: …», метки не ставить.\n"
        "- `tags` — 1–4 метки из словаря тем (`данные/темы_кадров.json` и `темы_кадров_sN.json` серии). Нет подходящей — `[]` или новая "
        "метка в словарь серии со словами, которыми о ней говорят.\n"
        f"- `people` — {PEOPLE}.\n- `flags` — {FLAGS}.\n\n"
        "Отдавать: `метки NN-MM.json` в этой папке, ключ — номер плитки, все плитки своих листов подряд.\n"
        + (f"\n## Словарь меток\n\n{', '.join(sorted(themes))}\n" if themes else ""))
    print(f"{len(tiles)} плиток, {math.ceil(len(tiles) / n)} листов → {out}")


# ---------------------------------------------------------------- каталог
def load_themes(paths):
    T = {}
    for p in paths:
        for k, v in json.load(open(p)).items():
            T.setdefault(k, [])
            T[k] += [x for x in v if x not in T[k]]
    return T


def cmd_build(a):
    tiles = opt(a, "--tiles"); TEMY = load_themes(opts(a, "--themes")); out = opt(a, "--out")
    meta = json.load(open(os.path.join(tiles, "плитки.json")))
    lab = {}
    for f in sorted(glob.glob(os.path.join(tiles, "метки *.json"))): lab.update(json.load(open(f)))
    miss = [k for k in meta if k not in lab]; unknown = {}
    by_file = {}
    for k, m in meta.items(): by_file.setdefault(m["file"], []).append(m["t"])
    kadry = []; pc = opt(a, "--photo-copies"); pc = os.path.abspath(pc) if pc else None   # пути в плане абсолютные
    for k in sorted(meta):
        m = meta[k]; L = lab.get(k)
        if not L: continue
        for t_ in L.get("tags", []):
            if t_ not in TEMY: unknown.setdefault(t_, []).append(k)
        e = {"file": m["file"], "метки": [t_ for t_ in L.get("tags", []) if t_ in TEMY], "видно": L.get("see", ""),
             "люди": L.get("people", ""), "флаги": L.get("flags", []), "плитка": k, "время": m["local"]}
        if m["kind"] == "video":
            ts = sorted(x for x in by_file[m["file"]] if x is not None); st = (ts[1] - ts[0]) if len(ts) > 1 else 5.0
            e["in"] = round(max(0.0, m["t"] - 0.5), 2); e["out"] = round(m["t"] - 0.5 + st, 2)
        kadry.append(e)
        if m["kind"] == "photo" and pc:              # копии фото (S.photo: «<номер>_<хеш>.mp4») — тот же кадр
            parts = os.path.basename(m["file"]).split(" ")
            num = parts[2] if len(parts) > 2 else os.path.splitext(parts[0])[0]
            for p in glob.glob(os.path.join(pc, f"{num}_*.mp4")): kadry.append({**e, "file": p})
    if "--extra" in a: kadry += json.load(open(opt(a, "--extra")))
    json.dump({"темы": TEMY, "кадры": kadry}, open(out, "w"), ensure_ascii=False, indent=0)
    print(f"каталог: {len(kadry)} кусков, плиток без меток {len(miss)}{' (' + ', '.join(miss[:12]) + (' …' if len(miss) > 12 else '') + ')' if miss else ''} → {out}")
    for t_, ks in sorted(unknown.items()): print(f"  метки нет в словаре тем: «{t_}» — плитки {', '.join(ks[:8])}{' …' if len(ks) > 8 else ''}")


# ---------------------------------------------------------------- подбор
def topics(text, TEMY):
    ws = [w.lower() for w in re.findall(r"[\wё-]+", text)]
    return sorted({t for t, st in TEMY.items() for w in ws for s in st if w.startswith(s)})


def cmd_suggest(a):
    CAT = json.load(open(opt(a, "--catalog"))); TH = json.load(open(opt(a, "--thoughts")))
    HEADS = {p: {int(t): b for t, b in rows} for p, rows in json.load(open(opt(a, "--heads"))).items()} if "--heads" in a else {}
    mins = lambda hm: int(hm.split(":")[0]) * 60 + int(hm.split(":")[1]) if hm and hm[0].isdigit() else 0
    src_time = {}
    for e in CAT["кадры"]: src_time.setdefault(os.path.basename(e["file"]), e.get("время"))
    L = [f"# Подбор кадров под мысли — черновик для таблицы «мысль → кадр» ({os.path.basename(opt(a, '--catalog'))})", "",
         "Кандидаты — по меткам каталога, чьи слова звучат в мысли; ближе по времени съёмки — выше. Выбирает человек: кадр должен "
         "показывать то, о чём говорят, ≥ 4 с, одна перебивка на мысль.", ""]
    for s in TH:
        head = next((v for p, v in HEADS.items() if os.path.basename(p) == s["src"]), None)
        L.append(f"\n## {tc(s['film'])} {s['note']} — {s['src']} {s['in']:.1f}–{s['out']:.1f}")
        t_seg = src_time.get(s["src"])
        for a_, b_, txt in s["thoughts"]:
            if b_ - a_ < 1.5 and len(txt.split()) < 4: continue
            tp = topics(txt, CAT["темы"]); face = None
            if head:
                ss = [head.get(q) for q in range(int(a_), int(b_) + 1) if head.get(q) is not None]
                face = round(sum(ss) / len(ss), 2) if ss else None
            L.append(f"- {tc(s['film'] + a_ - s['in'])} [{a_:.1f}–{b_:.1f}]" + (f" лицо {face}" if head else "") + f" · темы {tp or '—'} · «{txt[:140]}»")
            if not tp: continue
            cand = [e for e in CAT["кадры"] if set(e["метки"]) & set(tp) and not (set(e.get("флаги", [])) & BAD) and e.get("люди") != "селфи"
                    and os.path.basename(e["file"]) != s["src"]]
            if t_seg: cand.sort(key=lambda e: abs(mins(e.get("время")) - mins(t_seg)))
            seen = set(); k = 0
            for e in cand:
                key = e.get("плитка") or (os.path.basename(e["file"]), int(e.get("in", 0) // 10))   # фото и его копии — один кандидат
                if key in seen: continue
                seen.add(key); k += 1
                L.append(f"    - {e.get('плитка', '')} {os.path.basename(e['file'])[:30]} {e.get('in', 'фото')} {e.get('время', '')} "
                         f"[{', '.join(e['метки'])}] {e.get('видно', '')[:55]} · {e.get('люди', '')}")
                if k >= 3: break
    open(opt(a, "--out"), "w").write("\n".join(L) + "\n")
    print(f"подбор → {opt(a, '--out')}")


# ---------------------------------------------------------------- таблица
def cmd_table(a):
    plan_p = a[0]; P = json.load(open(plan_p)); src = P["sources"]
    alias = json.load(open(opt(a, "--alias"))) if "--alias" in a else {}
    CAT = json.load(open(opt(a, "--catalog"))); roots = opts(a, "--words-root")
    TAB = json.load(open(opt(a, "--cutaways"))) if "--cutaways" in a else []
    MAIN = dict(x.split("=", 1) for x in opts(a, "--main"))      # главные планы вне каталога: ключ имени файла → что видно
    TH = thoughts_of(P, roots, alias)

    def real(f, i):
        return (alias[f][0], i + float(alias[f][1])) if f in alias else (f, i)

    def seen(f, a_, b_):
        d = b_ - a_; f, a_ = real(f, a_); b_ = a_ + d; best = None
        for e in CAT["кадры"]:
            if os.path.basename(e["file"]) != os.path.basename(f): continue
            if "in" not in e: return e.get("видно", "")
            ov = min(b_, e["out"]) - max(a_, e["in"])
            if ov > 0 and (best is None or ov > best[0]): best = (ov, e.get("видно", ""))
        if best: return best[1]
        return MAIN.get(next((k for k in MAIN if k in os.path.basename(f)), ""), "? (нет в каталоге)")

    def why(note, at):
        for r in TAB:
            if note.startswith(r["note"]) and abs(r["at"] - at) < 0.6: return r.get("lock", "")
        return ""

    segs = P["segments"]; T = []; t = 0.0
    for x in segs: T.append(t); t += x["out"] - x["in"]
    L = [f"# Таблица «мысль → кадр»: {os.path.basename(plan_p)} (по плану, без рендера)", "",
         "Время — по фильму. «главный план» — перебивки нет: на экране говорящий или то, что снимает сам pocket (что видно — по каталогу "
         f"меток `{os.path.basename(opt(a, '--catalog'))}`). Перебивка: файл, кусок исходника, длина, что видно. ⚑ — закрытие по обязательному "
         "правилу (номер машины, асфальт, чужое лицо), тема слов при этом может не совпадать.", ""]
    n_cut = 0
    for s in TH:
        x = segs[s["seg"]]; f0 = src[x["src"]]
        L.append(f"\n## {tc(s['film'])} {s['note']} ({x['out'] - x['in']:.1f} с)")
        L.append(f"главный план: `{os.path.basename((alias.get(f0) or [f0])[0])}` {x['in']:.1f}–{x['out']:.1f} — {seen(f0, x['in'], x['out'])}")
        br = sorted(x.get("broll", []), key=lambda o: o["at"]); own = {}
        for o in br:                                  # перебивка → мысль, с которой она перекрывается больше всего
            ov = [min(b_, o["at"] + o["dur"]) - max(a_, o["at"]) for a_, b_, _ in s["thoughts"]]
            if ov and max(ov) > 0: own.setdefault(ov.index(max(ov)), []).append(o)
        for j, (a_, b_, txt) in enumerate(s["thoughts"]):
            ft = s["film"] + a_ - s["in"]
            if not own.get(j): L.append(f"- {tc(ft)} «{txt}» → главный план"); continue
            for o in own[j]:
                n_cut += 1
                f = (o.get("orig") or {}).get("file", o["file"]); i = (o.get("orig") or {}).get("in", o.get("in", 0)); w = why(s["note"], o["at"])
                L.append(f"- {tc(ft)} «{txt}» → **{tc(s['film'] + o['at'] - s['in'])}–{tc(s['film'] + o['at'] + o['dur'] - s['in'])}** "
                         f"`{os.path.basename(f)}` {i:.1f}–{i + o['dur']:.1f} ({o['dur']:.1f} с): {seen(f, i, i + o['dur'])}" + (f" ⚑ {w}" if w else ""))
    L.append("\n## Перебивки не под живой речью")
    talk = {s["seg"] for s in TH}
    for k, x in enumerate(segs):
        if k in talk or x["note"].startswith(("0.", "T.")): continue
        for o in x.get("broll", []):
            f = (o.get("orig") or {}).get("file", o["file"]); i = (o.get("orig") or {}).get("in", o.get("in", 0)); n_cut += 1
            L.append(f"- {tc(T[k] + o['at'] - x['in'])} «{x['note']}» → `{os.path.basename(f)}` {i:.1f}–{i + o['dur']:.1f} ({o['dur']:.1f} с): {seen(f, i, i + o['dur'])}")
    L.insert(4, f"Перебивок всего: {n_cut}. Говорящих кусков: {len(TH)}, мыслей: {sum(len(s['thoughts']) for s in TH)}.")
    open(opt(a, "--out"), "w").write("\n".join(L) + "\n")
    print(f"{n_cut} перебивок → {opt(a, '--out')}")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("sheets", "build", "thoughts", "suggest", "table"):
        print(__doc__); sys.exit(2)
    {"sheets": cmd_sheets, "build": cmd_build, "thoughts": cmd_thoughts, "suggest": cmd_suggest, "table": cmd_table}[sys.argv[1]](sys.argv[2:])
