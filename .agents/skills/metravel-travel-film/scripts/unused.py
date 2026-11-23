#!/usr/bin/env python3
"""Что из исходников дней не вошло в план — справка сборщику и рецензенту (владелец 23.11: «должны быть все наши ужины,
завтраки, вечер на лежаках, красивые проходки; посчитать, какой процент видео не используется»).

python3 unused.py report <plan.json> --days "День 0" "День 1" [--root /Volumes/T7/GR21] [--catalog кадры_sN.json]
                         [--maps <папка>] [--out отчёт.md] [--json отчёт.json] [--min 0.5]

Что считается использованным: каждый кусок главного плана и перебивок, приведённый к исходнику дня через копии —
размытие лиц (карта*.json: исходник → [[от, до, копия]]), номера и вертикали (alias*.json: копия → [исходник, сдвиг]),
память и вертикали (memory_jobs*.json, vertical_jobs*.json: {src, in, out}), поле «orig» перебивки, фото-копии
фото/<N>_<хеш>.mp4 → «Медиатека - N из …». Карты ищутся в --maps (по умолчанию папка плана) и её подпапках.
Клип «не вошёл», если из него взято меньше --min секунд. Готовые рилсы (телефон/*.MP4) считаются отдельно.

Метки клипа — из каталога кадров (shot_catalog.piece_tags: метки + люди + производные «еда/завтрак/ужин/отдых/сборы/вечер»),
категория-подсказка: брак / еда / вечер / проходка / быт / вид. Решение «вставить / нет» — за сборщиком, глазами.

Из кода: used_intervals(plan, maps) — {исходник: [(от, до)]}; day_clips(days, root); unused_with_people(plan, catalog) — для
audit_cut («НЕ ВОШЛО С НАМИ»)."""
import glob, json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
VID = (".mp4", ".mov")
PHOTO = (".jpg", ".jpeg", ".png", ".heic")
DUR_CACHE = os.path.expanduser("~/.cache/metravel-durations.json")
_dur = None


def duration(f):
    global _dur
    if _dur is None:
        try: _dur = json.load(open(DUR_CACHE))
        except Exception: _dur = {}
    if f not in _dur:
        o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                           capture_output=True, text=True).stdout.strip()
        try: _dur[f] = float(o)
        except ValueError: _dur[f] = 0.0
        os.makedirs(os.path.dirname(DUR_CACHE), exist_ok=True)
        tmp = DUR_CACHE + f".{os.getpid()}"; json.dump(_dur, open(tmp, "w")); os.replace(tmp, DUR_CACHE)
    return _dur[f]


def load_maps(*dirs):
    """{копия: (исходник, сдвиг)} — исходник-время = сдвиг + время копии. Узнаёт три формы JSON (см. шапку)."""
    M = {}
    files = []
    for d in dirs:
        files += glob.glob(os.path.join(d, "*.json")) + glob.glob(os.path.join(d, "*", "*.json")) + glob.glob(os.path.join(d, "*", "*", "*.json"))
    for f in files:
        b = os.path.basename(f)
        if b.startswith(("._", "plan_")) or os.path.getsize(f) > 30_000_000: continue
        try: J = json.load(open(f, encoding="utf-8"))
        except Exception: continue
        if isinstance(J, dict):
            for k, v in J.items():
                if not isinstance(k, str): continue
                if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str) and isinstance(v[1], (int, float)):
                    M.setdefault(k, (v[0], float(v[1])))                       # alias: копия → [исходник, сдвиг]
                elif isinstance(v, list) and v and all(isinstance(r, list) and len(r) == 3 and isinstance(r[2], str) for r in v):
                    for a, _, cp in v: M.setdefault(cp, (k, float(a)))          # карта размытия: исходник → [[от, до, копия]]
        elif isinstance(J, list):
            for r in J:
                if isinstance(r, dict) and isinstance(r.get("src"), str) and isinstance(r.get("out"), str):
                    M.setdefault(r["out"], (r["src"], float(r.get("in") or 0.0)))  # память, вертикали
    return M


_PH = re.compile(r"/фото/(\d+)_[0-9a-f]+\.mp4$")
_MED = {}


def _media(root):
    """{номер: [пути «Медиатека - N из …»]} по всем дням — один проход по диску."""
    if root not in _MED:
        D = {}
        for f in glob.glob(os.path.join(root, "День *", "**", "Медиатека - * из *"), recursive=True):
            if "/._" in f: continue
            m = re.search(r"Медиатека - (\d+) из ", f)
            if m: D.setdefault(m.group(1), []).append(f)
        _MED[root] = D
    return _MED[root]


def origin(path, t, M, root=None):
    """(исходник, время) по цепочке копий."""
    for _ in range(6):
        if path in M:
            src, off = M[path]; path, t = src, off + t; continue
        m = _PH.search(path)
        if m and root:
            g = _media(root).get(m.group(1), [])
            if g: return sorted(g, key=lambda x: not x.lower().endswith(".mov"))[0], 0.0
        break
    return path, t


def used_intervals(P, M, root=None):
    """{исходник: [(от, до)]} — что план берёт из каждого файла (главный план и перебивки)."""
    U = {}
    def add(path, a, d):
        if not path or d <= 0: return
        o, oa = origin(path, a, M, root)
        U.setdefault(o, []).append((oa, oa + d))
    for x in P["segments"]:
        add(P["sources"].get(x["src"]), x["in"], x["out"] - x["in"])
        for o in x.get("broll", []):
            if isinstance(o.get("orig"), dict) and o["orig"].get("file"):
                add(o["orig"]["file"], o["orig"].get("in", 0.0), o["dur"])
            else:
                add(o.get("file"), o.get("in", 0.0), o.get("dur", 0.0))
    return U


def covered(iv, dur):
    s = 0.0; end = -1.0
    for a, b in sorted(iv):
        a, b = max(a, end, 0.0), min(b, dur if dur else b)
        if b > a: s += b - a; end = b
    return s


def day_clips(days, root):
    """Видео дней (без ._ и «Собраны»); готовые рилсы телефона (*.MP4 в телефон/) — отдельным списком."""
    src, reels = [], []
    for d in days:
        for D in glob.glob(os.path.join(root, f"{d} — *")) or glob.glob(os.path.join(root, d)):
            for f in sorted(glob.glob(D + "/**/*", recursive=True)):
                if not f.lower().endswith(VID) or "/._" in f or "/Собраны/" in f: continue
                (reels if ("/телефон/" in f and f.endswith(".MP4")) else src).append(f)
    return src, reels


def catalog_index(cat_path):
    if not cat_path or not os.path.exists(cat_path): return {}
    import shot_catalog
    C = json.load(open(cat_path, encoding="utf-8")); I = {}
    for p in C["кадры"]:
        p = dict(p); p["_tags"] = shot_catalog.piece_tags(p); I.setdefault(p["file"], []).append(p)
    return I


def category(pieces):
    """Подсказка: брак / еда / вечер / проходка / быт / вид — по меткам кусков клипа."""
    if not pieces: return "?"
    T = set().union(*[p["_tags"] for p in pieces])
    bad = {"смазано", "тёмный", "пол"}
    if all(bad & set(p.get("флаги", [])) for p in pieces): return "брак"
    if T & {"еда", "завтрак", "ужин", "обед"}: return "еда"
    if T & {"вечер", "отдых"}: return "вечер"
    if "проходка-в-одну-сторону" in T or T & {"Юля", "Сергей", "мы-вдвоём"} and any("идёт" in (p.get("люди") or "") for p in pieces): return "проходка"
    if "сборы" in T: return "быт"
    return "вид"


def has_us(pieces):
    return any(p["_tags"] & {"мы-вдвоём", "Юля", "Сергей", "люди-yolox"} for p in pieces)


def report(P, days, root, cat=None, maps=None, mn=0.5):
    M = load_maps(*(maps or []))
    U = used_intervals(P, M, root)
    src, reels = day_clips(days, root)
    I = catalog_index(cat)
    rows = []
    for f in src:
        d = duration(f); u = covered(U.get(f, []), d); pcs = I.get(f, [])
        rows.append({"file": f, "dur": round(d, 1), "used": round(u, 1), "вошёл": u >= mn, "время": pcs[0].get("время", "") if pcs else "",
                     "люди": sorted({p.get("люди") for p in pcs if p.get("люди")}), "метки": sorted(set().union(*[p["_tags"] for p in pcs])) if pcs else [],
                     "флаги": sorted({x for p in pcs for x in p.get("флаги", [])}), "видно": [p.get("видно", "") for p in pcs][:4],
                     "категория": category(pcs), "мы": has_us(pcs), "в_каталоге": bool(pcs)})
    return rows, reels


def unused_with_people(P, cat, plan_dir, min_len=4.0, mn=0.5):
    """Для audit_cut: клипы каталога с нами (метки людей) не короче min_len, из которых план взял < mn с."""
    import shot_catalog
    M = load_maps(plan_dir)
    root = next((r for r in ("/Volumes/T7/GR21",) if os.path.isdir(r)), None)
    U = used_intervals(P, M, root)
    I = catalog_index(cat); out = []
    for f, pcs in I.items():
        if not f.lower().endswith(VID) or "/фото/" in f: continue     # фото и их копии (без in/out) — не клипы
        if "/телефон/" in f and f.endswith(".MP4"): continue           # готовые рилсы телефона — не исходники
        # мы в кадре: метки людей или YOLOX-подсказка (1 человек ≥ 12 % высоты — это мы: рецензент 23.11, съёмка с рук тоже годна)
        us = [p for p in pcs if p["_tags"] & {"мы-вдвоём", "Юля", "Сергей", "люди-yolox"} and not ({"смазано", "тёмный", "пол"} & set(p.get("флаги", [])))
              and "in" in p and "out" in p]
        ln = sum(p["out"] - p["in"] for p in us)
        if ln < min_len: continue
        if covered(U.get(f, []), 0) >= mn: continue
        out.append((f, ln, category(pcs), us[0].get("время", ""), "; ".join(dict.fromkeys(p.get("видно", "") for p in us[:3]))))
    return sorted(out, key=lambda r: (r[3], r[0]))


def write_md(rows, reels, plan, days, out):
    n = len(rows); un = [r for r in rows if not r["вошёл"]]
    tot = sum(r["dur"] for r in rows); utot = sum(r["dur"] - r["used"] for r in rows)
    L = [f"# Неиспользованное — {os.path.basename(plan)} ({', '.join(days)})", "",
         f"- исходных видео: **{n}**, {tot / 60:.1f} мин; не вошло ни секунды: **{len(un)}** ({100 * len(un) / max(1, n):.0f} %), "
         f"{sum(r['dur'] for r in un) / 60:.1f} мин; не взятое время всего: {utot / 60:.1f} мин ({100 * utot / max(1, tot):.0f} %)",
         f"- готовые рилсы телефона (не исходники): {len(reels)}; не в каталоге кадров: {sum(1 for r in un if not r['в_каталоге'])}", ""]
    from collections import Counter
    c = Counter(r["категория"] for r in un); cu = Counter(r["категория"] for r in un if r["мы"])
    L += ["| категория | не вошло клипов | из них с нами |", "|---|---:|---:|"] + [f"| {k} | {v} | {cu.get(k, 0)} |" for k, v in c.most_common()] + [""]
    L += ["## Не вошедшие клипы", "", "| файл | с | время | люди | категория | метки | видно |", "|---|---:|---|---|---|---|---|"]
    for r in sorted(un, key=lambda r: (r["время"] or "99", r["file"])):
        p = r["file"].split("/"); fn = "/".join(p[-2:])
        L.append(f"| {fn} | {r['dur']:.0f} | {r['время']} | {', '.join(r['люди'])} | {r['категория']} | {' '.join(r['метки'][:8])} | "
                 f"{'; '.join(dict.fromkeys(x for x in r['видно'] if x))[:160]} |")
    open(out, "w").write("\n".join(L) + "\n")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2 or a[0] != "report" or "--days" not in a: print(__doc__); sys.exit(2)
    def opt(k, d=None): return a[a.index(k) + 1] if k in a else d
    days = []
    for x in a[a.index("--days") + 1:]:
        if x.startswith("--"): break
        days.append(x)
    plan = a[1]; P = json.load(open(plan, encoding="utf-8"))
    root = opt("--root", "/Volumes/T7/GR21")
    rows, reels = report(P, days, root, opt("--catalog"), [opt("--maps", os.path.dirname(os.path.abspath(plan)))], float(opt("--min", 0.5)))
    if opt("--json"): json.dump({"clips": rows, "reels": reels}, open(opt("--json"), "w"), ensure_ascii=False, indent=1)
    out = opt("--out")
    if out: write_md(rows, reels, plan, days, out)
    un = [r for r in rows if not r["вошёл"]]
    tot = sum(r["dur"] for r in rows)
    print(f"исходных видео {len(rows)}, не вошло {len(un)} ({100 * len(un) / max(1, len(rows)):.0f} %), "
          f"{sum(r['dur'] for r in un) / 60:.1f} из {tot / 60:.1f} мин; с нами среди не вошедших {sum(1 for r in un if r['мы'])}")
