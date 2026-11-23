#!/usr/bin/env python3
"""Одна точка входа сборки travel-фильма: вместо своего run_sN_vK.sh на каждую версию — три команды.

  film.py prep <день> [<день> …]      исходники дней → инвентарь, расшифровка по словам, листы кадров (повтор — только новое)
  film.py plan sN [--as vK]           сборщик серии → план новой версии → проверки плана разом → сводка (без рендера)
  film.py draft sN [--hd]             рендер плана → все проверки разом → сводка → копия в черновики → запрос рецензии
Ещё:
  film.py init <папка подготовки> --sources <папка исходников> [--name ИМЯ]   каркас нового фильма и film.json
  film.py status [sN …]               где каждая серия: план, допуск, черновики, кто держит очередь
  film.py check sN [--hd]             только проверки готового черновика
  film.py music                       разбор треков папки музыки (music_fit.py analyze) в общий музыка.json
Общие ключи: --film <film.json> (иначе ищется вверх от текущей папки), --dry-run (напечатать команды и выйти),
  --as vK (версия плана; по умолчанию plan — следующая по номеру, draft/check — последняя; готовый план plan не
  переписывает, лог сборщика — в отчётах), --no-build (plan: не запускать
  сборщик, проверить последний план), --no-request, --no-copy, --prune-old (draft: удалить прежние черновики серии того же
  качества из папки черновиков — правило «только последняя»).

film.json лежит в папке планов (или называет её ключом "plans"); пути — от неё. Подстановки: {s} — серия (s5), {n} — её номер, {v} — версия, {q} — качество.
  {"film": "GR21", "sources": "/Volumes/T7/GR21", "words_root": "/Volumes/T7/GR21", "day_glob": "День {d} — *",
   "inventory": "../данные/inventory.json", "words_out": "../данные/речь", "catalog": "../данные/кадры_{s}.json",
   "themes": ["../данные/темы_кадров.json"], "sheets": "каталог_д{d}", "cutaways": "перебивки_{s}.json",
   "alias": "alias_{s}.json", "builder": "plan_{s}.py", "proxy": "proxy", "reports": "отчёты/{s}",
   "drafts": "../../7 черновики", "draft_name": "Серия {n} — {v} ({q}).mp4", "music": "../../6 музыка",
   "tracks": "../данные/музыка.json", "end_card": 6, "faces": "модели_и_эталоны",
   "yolox": "модели/object_detection_yolox_2022nov.onnx", "hd_bitrate": "20M", "tz": 2, "session": "имя сессии сборщика",
   "must_be_zero": ["КОРОЧЕ 4 С"], "after_plan": ["команда с {s}/{v}/{plan}"], "extra_checks": [["имя", "команда с {film}/{segments}/{plan}/{out}"]],
   "series": {"s5": {"n": 5, "days": [5]}}}
Отсутствующий необязательный файл пропускается: каталог кадров, разбор треков, эталоны лиц — с пометкой в сводке; alias и
перебивки просто не передаются. "sheets" — папка листов prep ({d} — дни через дефис), "plans" — от папки film.json.
Сводка не читает отчёт, оставшийся от прежнего запуска: упавшая проверка — блокер «не отработала».
Гейты прежние: больше 640x360 render_plan.py собирает только по допуску рецензента (film_gate.py), тяжёлое идёт через
общий замок heavy_lock.py. Эта команда ничего не решает за рецензента и владельца — она убирает ручной запуск.
"""
import glob, json, os, re, shutil, subprocess, sys, time, unicodedata

SK = os.path.dirname(os.path.abspath(__file__))
PY = ["python3", "-I"]
UVCV = ["uv", "run", "-q", "--with", "opencv-python-headless<5", "--with", "numpy", "python", "-I"]
UVNP = ["uv", "run", "-q", "--with", "numpy", "python", "-I"]
DEFAULTS = {"day_glob": "День {d} — *", "inventory": "../данные/inventory.json", "words_out": "../данные/речь",
            "catalog": "../данные/кадры_{s}.json", "themes": ["../данные/темы_кадров.json"], "sheets": "каталог_д{d}",
            "cutaways": "перебивки_{s}.json", "alias": "alias_{s}.json", "builder": "plan_{s}.py", "proxy": "proxy",
            "reports": "отчёты/{s}", "drafts": "../../7 черновики", "draft_name": "Серия {n} — {v} ({q}).mp4",
            "music": "../../6 музыка", "tracks": "../данные/музыка.json", "end_card": 6, "faces": "модели_и_эталоны",
            "yolox": "модели/object_detection_yolox_2022nov.onnx", "hd_bitrate": "20M", "tz": 2, "session": "",
            "must_be_zero": ["КОРОЧЕ 4 С"], "after_plan": [], "extra_checks": [], "series": {}}


def N(s):
    return unicodedata.normalize("NFC", s)


def opt(a, k, d=None):
    return a[a.index(k) + 1] if k in a and a.index(k) + 1 < len(a) else d


class Film:
    def __init__(self, path):
        self.path = os.path.abspath(path)
        self.c = dict(DEFAULTS); self.c.update(json.load(open(self.path, encoding="utf-8")))
        self.dir = os.path.abspath(os.path.join(os.path.dirname(self.path), self.c.get("plans") or "."))   # папка планов: там film.json или ключ "plans"

    def p(self, key, **kw):
        """Путь из конфига: подстановки и привязка к папке планов."""
        v = self.c[key].format(**kw) if kw else self.c[key]
        return v if os.path.isabs(v) else os.path.normpath(os.path.join(self.dir, v))

    def series(self, s):
        if not re.fullmatch(r"s\d+", s): sys.exit(f"серия задаётся как s5, а не «{s}»")
        d = dict(self.c["series"].get(s) or {}); d.setdefault("n", int(s[1:])); d.setdefault("days", [])
        return d

    def plans(self, s):
        """[(ключ версии, версия, путь)] планов серии по возрастанию: plan_s5_v5a.json → v5a; производные (_мин, _цвет) — нет."""
        out = []
        for f in glob.glob(os.path.join(self.dir, f"plan_{s}_v*.json")):
            m = re.fullmatch(rf"plan_{s}_(v(\d+)([a-z]*))\.json", N(os.path.basename(f)))
            if m: out.append(((int(m.group(2)), m.group(3)), m.group(1), f))
        return sorted(out)

    def plan(self, s, v=None, new=False):
        P = self.plans(s)
        if v and not re.fullmatch(r"v\d+[a-z]*", v): sys.exit(f"--as: версия вида v6 или v5a, а не «{v}»")
        if v: return v, os.path.join(self.dir, f"plan_{s}_{v}.json")
        if new: v = f"v{(P[-1][0][0] + 1) if P else 1}"; return v, os.path.join(self.dir, f"plan_{s}_{v}.json")
        if not P: sys.exit(f"планов серии {s} нет: film.py plan {s}")
        return P[-1][1], P[-1][2]


def find_film(a):
    f = opt(a, "--film") or os.environ.get("FILM_JSON")
    if f: return Film(f)
    d = os.getcwd()
    while True:
        if os.path.exists(os.path.join(d, "film.json")): return Film(os.path.join(d, "film.json"))
        if os.path.dirname(d) == d: sys.exit("film.json не найден: запускай из папки планов или дай --film <путь>")
        d = os.path.dirname(d)


def sh(cmd):
    return " ".join("'" + x.replace("'", "'\\''") + "'" if re.search(r"[^\w./=:+,@-]", x) else x for x in cmd)


def step(title):
    print(f"== {time.strftime('%H:%M')} {title}", flush=True)


def run(cmd, log=None, cwd=None, dry=False, env=None):
    if dry: print("  " + sh(cmd) + (f"  > {log}" if log else "")); return 0
    if log:
        with open(log, "w", encoding="utf-8") as f: return subprocess.run(cmd, cwd=cwd, stdout=f, stderr=subprocess.STDOUT, env=env).returncode
    return subprocess.run(cmd, cwd=cwd, env=env).returncode


def run_all(jobs, dry=False, cwd=None):
    """jobs: [(имя, команда, файл лога)] — разом. → {имя: (код, секунд)}"""
    if dry:
        for n_, cmd, log in jobs: print(f"  [{n_}] " + sh(cmd))
        return {n_: (0, 0.0) for n_, _, _ in jobs}
    live, res = [], {}
    for n_, cmd, log in jobs:
        f = open(log, "w", encoding="utf-8")
        try: live.append((n_, subprocess.Popen(cmd, cwd=cwd, stdout=f, stderr=subprocess.STDOUT), f, time.time(), log))
        except OSError as e: f.write(str(e)); f.close(); res[n_] = (127, 0.0)
    for n_, p, f, t0, log in live:
        code = p.wait(); f.close(); res[n_] = (code, time.time() - t0)
    return res


def findings(md):
    """«## ВИД — N» из отчёта проверки → {ВИД: N}; первая строка отчёта."""
    if not os.path.exists(md): return {}, ""
    txt = open(md, encoding="utf-8").read()
    head = txt.split("\n", 1)[0].lstrip("# ").strip()
    return {m.group(1).strip(): int(m.group(2)) for m in re.finditer(r"^## (.+?) — (\d+)\s*$", txt, re.M)}, head


def summary(F, s, v, title, rows, skipped, out, res=None, since=0.0):
    """Код 1 — находки audit_tech («НЕ ГОДЕН») или падение Python; падение отчёт не пишет, а отчёт прежнего запуска (старше since) не читается."""
    zero = F.c["must_be_zero"]; bad = []
    L = [f"# Сводка {s} {v}: {title}", "", "| проверка | итог | находки | отчёт |", "| --- | --- | --- | --- |"]
    for name, md in rows:
        code, sec = (res or {}).get(name, (0, 0.0)); fresh = os.path.exists(md) and os.path.getmtime(md) >= since - 2
        cnt, head = findings(md) if fresh else ({}, "")
        st = "не запустилась" if not fresh else ("ошибка" if code not in (0, 1) else head[:70])
        if not fresh or code not in (0, 1): bad.append(f"{name}: проверка не отработала (код {code}, лог рядом с отчётом)")
        if "НЕ ГОДЕН" in head: bad.append(f"{name}: {head}")
        for k in zero:
            if cnt.get(k): bad.append(f"{name}: {k} — {cnt[k]} (должно быть 0)")
        L.append(f"| {name} | {st} | {', '.join(f'{k} {n}' for k, n in cnt.items() if n) or '—'} | {os.path.relpath(md, F.dir)} |")
    L.append("")
    if skipped: L += ["Пропущено: " + "; ".join(skipped) + ".", ""]
    L += ["## Стоп до рецензии" if bad else "## Блокеров по правилам film.json нет"] + [f"- {b}" for b in bad] + [""]
    L.append("Остальные находки разбираются глазами: каждая — правка в плане или причина в «что изменено».")
    open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L)); return bad


def common(F, s):
    al = F.p("alias", s=s); a = ["--words-root", F.c.get("words_root") or F.c["sources"]]
    return a + (["--alias", al] if os.path.exists(al) else [])


def others(F, s):
    return [F.plans(o)[-1][2] for o in sorted(F.c["series"]) if o != s and F.plans(o)]


# ---------------------------------------------------------------- plan
def cmd_plan(F, a):
    s = a[0]; dry = "--dry-run" in a; ser = F.series(s); skipped = []
    v, plan = F.plan(s, opt(a, "--as"), new="--no-build" not in a)
    rep = F.p("reports", s=s)
    if not dry: os.makedirs(rep, exist_ok=True)
    if "--no-build" not in a:
        b = F.p("builder", s=s)
        if not os.path.exists(b): sys.exit(f"нет сборщика {b}")
        if os.path.exists(plan): sys.exit(f"{os.path.basename(plan)} уже есть — готовый план не переписывается: другая --as или --no-build")
        step(f"сборщик {os.path.basename(b)} → {os.path.basename(plan)}")
        if not dry:
            os.makedirs(os.path.join(F.dir, "версии"), exist_ok=True)       # снимок сборщика версии — вместо ручных plan_sN.vK.py
            shutil.copy2(b, os.path.join(F.dir, "версии", f"{os.path.splitext(os.path.basename(b))[0]}.{v}.py"))
        log = os.path.join(rep, f"сборщик {s} {v}.log")
        if run(PY + [b, plan], log, F.dir, dry): print(f"СБОРЩИК УПАЛ — {log}"); print(tail(log)); return 1
        for h in F.c["after_plan"]:
            cmd = h.format(s=s, n=ser["n"], v=v, plan=plan); step("после плана: " + cmd[:80])
            if run(["/bin/zsh", "-c", cmd], None, F.dir, dry): print("шаг после плана упал"); return 1
        if F.c["after_plan"] and run(PY + [b, plan], log, F.dir, dry): print(f"СБОРЩИК УПАЛ (второй проход) — {log}"); return 1
    elif not os.path.exists(plan): sys.exit(f"нет плана {plan}")
    jobs, rows = plan_checks(F, s, v, plan, rep, skipped)
    step(f"проверки плана разом: {', '.join(n_ for n_, _, _ in jobs)}")
    t0 = time.time(); res = run_all(jobs, dry, F.dir)
    if dry: return 0
    bad = summary(F, s, v, f"план {os.path.basename(plan)}", rows, skipped, os.path.join(rep, f"сводка {s} {v} план.md"), res, t0)
    print(f"\nДальше: film.py draft {s}" + ("" if not bad else "  — после правок плана и повторного film.py plan"))
    return 2 if bad else 0


def plan_checks(F, s, v, plan, rep, skipped):
    ser = F.series(s); cm = common(F, s); cat = F.p("catalog", s=s); inv = F.p("inventory"); tr = F.p("tracks")
    md = lambda n_: os.path.join(rep, f"{n_} {s} {v}.md"); err = lambda n_: os.path.join(rep, f"{n_} {s} {v}.log")
    jobs = [("монтаж", PY + [f"{SK}/audit_cut.py", plan] + cm + (["--catalog", cat] if os.path.exists(cat) else []) + ["--out", md("монтаж")], err("монтаж")),
            ("порядок", PY + [f"{SK}/audit_order.py", plan, "--root", F.c["sources"], "--tz", str(F.c["tz"])] +
             (["--inventory", inv] if os.path.exists(inv) else []) + (["--others"] + others(F, s) if others(F, s) else []) + ["--out", md("порядок")], err("порядок")),
            ("музыка", PY + [f"{SK}/music_fit.py", "check", plan] + (["--tracks", tr] if os.path.exists(tr) else []) +
             (["--others"] + others(F, s) if others(F, s) else []) + ["--out", md("музыка")], err("музыка"))]
    rows = [(n_, md(n_)) for n_ in ("монтаж", "порядок", "музыка")]
    if not os.path.exists(tr): skipped.append("разбор треков (film.py music) — музыка проверена без громких окон и долей")
    if os.path.exists(cat):
        cut = F.p("cutaways", s=s); tb = md("мысль → кадр")
        jobs.append(("таблица", PY + [f"{SK}/shot_catalog.py", "table", plan, "--catalog", cat] + cm +
                     (["--cutaways", cut] if os.path.exists(cut) else []) + ["--out", tb], err("таблица")))
        if ser["days"]:
            days = [f"День {d}" for d in ser["days"]]
            jobs.append(("не вошло", PY + [f"{SK}/unused.py", "report", plan, "--days"] + days + ["--root", F.c["sources"], "--catalog", cat,
                                                                                               "--out", md("не вошло")], err("не вошло")))
    else: skipped.append(f"каталог кадров {os.path.basename(cat)} — без таблицы «мысль → кадр», проверки ТЕМА и отчёта «не вошло»")
    return jobs, rows


def tail(path, n=8):
    try: return "\n".join(open(path, encoding="utf-8", errors="replace").read().splitlines()[-n:])
    except OSError: return ""


# ---------------------------------------------------------------- draft / check
def draft_re(F, s, q=None):
    """Имена черновиков серии по шаблону draft_name: любая версия; качество q или любое."""
    t = re.escape(F.c["draft_name"]).replace(r"\{n\}", str(F.series(s)["n"])).replace(r"\{s\}", s)
    return re.compile("^" + t.replace(r"\{q\}", re.escape(q) if q else r"[^()]+").replace(r"\{v\}", r"v\d+[a-z]*") + "$")


def names(F, s, v, hd):
    base = os.path.join(F.p("proxy"), f"{s}_{v}" + ("_1080" if hd else ""))
    return base, base + ".mp4", base + ".segments.json"


def film_checks(F, s, v, plan, hd, skipped):
    base, film, segs = names(F, s, v, hd); rep = F.p("reports", s=s); q = "1080" if hd else "360"; cm = common(F, s)
    md = lambda n_: os.path.join(rep, f"{n_} {s} {v} {q}.md"); err = lambda n_: os.path.join(rep, f"{n_} {s} {v} {q}.log")
    tr = F.p("tracks"); faces = F.p("faces"); yolox = F.p("yolox")
    jobs = [("техконтроль", PY + [f"{SK}/audit_tech.py", film] + ([] if hd else ["--quick"]) + ["--end-card", str(F.c["end_card"]), "--out", md("техконтроль")], err("техконтроль")),
            ("монтаж", PY + [f"{SK}/audit_cut.py", plan] + cm + ["--out", md("монтаж")], err("монтаж")),
            ("на слух", PY + [f"{SK}/audit_mix.py", film, "--segments", segs, "--base", base + "_без_музыки.mov", "--music", base + "_музыка.wav",
                             "--voice", base + "_голос.wav", "--plan", plan] + cm + ["--out", md("на слух")], err("на слух")),
            ("глазами", ["nice", "-n", "10"] + UVCV + [f"{SK}/audit_frames.py", film, "--segments", segs] + (["--faces", faces] if os.path.exists(faces) else []) +
             (["--yolox", yolox] if os.path.exists(yolox) else []) + cm + ["--out", md("глазами")], err("глазами")),
            ("цвет", UVCV + [f"{SK}/audit_color.py", film, "--segments", segs, "--out", md("цвет")], err("цвет")),
            ("музыка", UVNP + [f"{SK}/music_fit.py", "check", plan] + (["--tracks", tr] if os.path.exists(tr) else []) +
             ["--segments", segs, "--music", base + "_музыка.wav", "--out", md("музыка")], err("музыка"))]
    rows = [(n_, md(n_)) for n_, _, _ in jobs]
    for name, cmd in F.c["extra_checks"]:
        o = md(name); jobs.append((name, ["/bin/zsh", "-c", cmd.format(s=s, v=v, film=film, segments=segs, plan=plan, out=o)], err(name))); rows.append((name, o))
    if not os.path.exists(faces): skipped.append("эталоны лиц — audit_frames без проверки «автор размыт»")
    return jobs, rows


def cmd_draft(F, a, only_check=False):
    s = a[0]; dry = "--dry-run" in a; hd = "--hd" in a; ser = F.series(s); skipped = []
    v, plan = F.plan(s, opt(a, "--as")); base, film, segs = names(F, s, v, hd); rep = F.p("reports", s=s); q = "1080p" if hd else "360p"
    if not os.path.exists(plan): sys.exit(f"нет плана {plan}")
    if not dry: os.makedirs(rep, exist_ok=True); os.makedirs(F.p("proxy"), exist_ok=True)
    if not only_check:
        if hd and run(PY + [f"{SK}/film_gate.py", "check", plan, "--size", "1920x1080"], None, F.dir, dry):
            print(f"\n1080p по {os.path.basename(plan)} не допущен рецензентом — выше причина. Сначала film.py draft {s} (360p) и вердикт."); return 3
        try: load = os.getloadavg()[0]
        except OSError: load = 0.0
        if load > 150: print(f"внимание: загрузка машины {load:.0f} — сборка пойдёт в разы медленнее (python3 {SK}/heavy_lock.py status)")
        step(f"рендер {q}: {os.path.basename(plan)} → {os.path.relpath(film, F.dir)} (очередь — общий замок)")
        cmd = ["caffeinate", "-i"] + PY + [f"{SK}/render_plan.py", plan, film] + (["--size", "1920x1080", "--hw", F.c["hd_bitrate"]] if hd else []) + common(F, s)
        log = base + ".render.log"
        if run(cmd, log, F.dir, dry): print(f"РЕНДЕР УПАЛ — {log}"); print(tail(log)); return 1
        if not dry: print("  " + (tail(log, 3).replace("\n", "\n  ")))
    elif not os.path.exists(film) and not dry: sys.exit(f"нет черновика {film}: film.py draft {s}" + (" --hd" if hd else ""))
    jobs, rows = film_checks(F, s, v, plan, hd, skipped)
    step(f"проверки разом: {', '.join(n_ for n_, _, _ in jobs)}")
    t0 = time.time(); res = run_all(jobs, dry, F.dir)
    if dry: return 0
    bad = summary(F, s, v, f"черновик {q} {os.path.basename(film)}", rows, skipped, os.path.join(rep, f"сводка {s} {v} {q}.md"), res, t0)
    if only_check: return 2 if bad else 0
    if bad: print("\nЧерновик с блокерами: в папку черновиков не скопирован, запрос рецензии не отправлен."); return 2
    dr = F.p("drafts"); dst = os.path.join(dr, F.c["draft_name"].format(n=ser["n"], v=v, q=q, s=s))
    if "--no-copy" not in a and os.path.isdir(dr):
        step(f"копия в черновики: {os.path.basename(dst)}"); shutil.copy2(film, dst)
        old = [f for f in os.listdir(dr) if draft_re(F, s, q).match(N(f)) and N(f) != N(os.path.basename(dst))]
        if old and "--prune-old" in a and "{q}" in F.c["draft_name"] and "{v}" in F.c["draft_name"]:
            for f in old: os.remove(os.path.join(dr, f)); print("  удалён прежний черновик:", f)
        elif old: print("  прежние черновики того же качества (удалить: --prune-old; в draft_name нужны {v} и {q}): " + ", ".join(old))
    if "--no-request" not in a:
        step("запрос рецензии")
        run(PY + [f"{SK}/film_gate.py", "request", plan, "--series", s, "--draft", film, "--from", F.c["session"] or f"сборщик {s}"], None, F.dir)
    return 0


# ---------------------------------------------------------------- status / music / prep / init
def cmd_status(F, a):
    pick = [x for x in a if re.fullmatch(r"s\d+", x)] or sorted(F.c["series"]) or sorted({m.group(1) for f in glob.glob(os.path.join(F.dir, "plan_s*_v*.json"))
                                                                                         for m in [re.match(r"plan_(s\d+)_", os.path.basename(f))] if m})
    print(f"Фильм {F.c.get('film', '')} — {F.dir}")
    for s in pick:
        P = F.plans(s); ser = F.series(s)
        if not P: print(f"{s}: планов нет"); continue
        v, plan = P[-1][1], P[-1][2]; b = F.p("builder", s=s)
        stale = os.path.exists(b) and os.path.getmtime(b) > os.path.getmtime(plan) + 1
        dr = F.p("drafts"); mine = sorted(f for f in (os.listdir(dr) if os.path.isdir(dr) else []) if draft_re(F, s).match(N(f)))
        d360, d1080 = (os.path.exists(names(F, s, v, h)[1]) for h in (False, True))
        print(f"{s}: план {v}" + (" (сборщик новее плана — film.py plan)" if stale else "") +
              f"; черновик 360p {'есть' if d360 else 'нет'}, 1080p {'есть' if d1080 else 'нет'}; в черновиках: {', '.join(mine[-2:]) or '—'}")
    sys.stdout.flush()
    run(PY + [f"{SK}/film_gate.py", "status", F.dir]); run(PY + [f"{SK}/heavy_lock.py", "status"])
    return 0


def cmd_music(F, a):
    return run(UVNP + [f"{SK}/music_fit.py", "analyze", F.p("music"), "--out", F.p("tracks")], None, F.dir, "--dry-run" in a)


def cmd_prep(F, a):
    days = [str(int(x)) for x in a if re.fullmatch(r"\d+", x)]; dry = "--dry-run" in a
    if not days: sys.exit("film.py prep <день> [<день> …] — номера дней")
    inv = F.p("inventory"); root = F.c["sources"]
    step("инвентарь дней " + ", ".join(days))
    items = json.load(open(inv, encoding="utf-8")) if os.path.exists(inv) else []
    known = {N(i["path"]) for i in items}; add = []
    for d in days:
        for dd in glob.glob(os.path.join(root, F.c["day_glob"].format(d=d))) or glob.glob(os.path.join(root, f"День {d}")):
            for dp, _, fs in os.walk(dd):
                for f in sorted(fs):
                    ext = f.rsplit(".", 1)[-1].lower(); p = os.path.join(dp, f)
                    if f.startswith("._") or ext not in ("mp4", "mov", "jpg", "jpeg", "png", "heic") or N(p) in known: continue
                    add.append({"day": int(d), "cam": N(os.path.relpath(dp, dd)), "path": p, "kind": "video" if ext in ("mp4", "mov") else "photo"})
    print(f"  новых файлов {len(add)} (в инвентаре {len(items)})")
    if dry: return 0
    for it in add:
        if it["kind"] != "video": continue
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate:stream_side_data=rotation:format_tags=creation_time",
                            "-of", "json", it["path"]], capture_output=True, text=True)
        try:
            j = json.loads(r.stdout); vs = [x for x in j["streams"] if x["codec_type"] == "video"][0]; rot = 0
            for sd in vs.get("side_data_list") or []: rot = sd.get("rotation", rot)
            it.update(dur=float(j["format"]["duration"]), w=vs["width"], h=vs["height"], fps=vs["r_frame_rate"], rot=rot,
                      ct=(j["format"].get("tags") or {}).get("creation_time"))
        except Exception as e: it["err"] = str(e)[:80]
    if add:
        os.makedirs(os.path.dirname(inv), exist_ok=True); tmp = inv + f".{os.getpid()}"
        json.dump(items + add, open(tmp, "w", encoding="utf-8"), ensure_ascii=False); os.replace(tmp, inv); items += add
    wout = F.p("words_out"); todo = []
    for it in items:
        if it["kind"] != "video" or str(it["day"]) not in days or it.get("dur", 0) < 4: continue
        o = os.path.join(wout, f"д{it['day']}", it["cam"], os.path.splitext(os.path.basename(it["path"]))[0] + ".words.json")
        if not os.path.exists(o): todo.append((it, o))
    step(f"расшифровка по словам: {len(todo)} клипов (mlx_whisper large-v3-turbo; готовые пропущены)")
    if todo and not shutil.which("mlx_whisper"): sys.exit("нет mlx_whisper: uv tool install --python 3.12 mlx-whisper")
    import tempfile
    tmp = tempfile.mkdtemp()
    for k, (it, o) in enumerate(todo, 1):
        wav = os.path.join(tmp, "a.wav")
        if subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", it["path"], "-vn", "-ac", "1", "-ar", "16000", "-af", "loudnorm=I=-20", wav]).returncode: continue
        subprocess.run(["mlx_whisper", wav, "--model", "mlx-community/whisper-large-v3-turbo", "--language", "ru", "--output-format", "json", "--output-dir", tmp,
                        "--word-timestamps", "True", "--condition-on-previous-text", "False", "--verbose", "False"], capture_output=True, stdin=subprocess.DEVNULL)
        j = os.path.join(tmp, "a.json")
        if os.path.exists(j):
            res = json.load(open(j, encoding="utf-8")); res["source"] = it["path"]; res["dur"] = it.get("dur")
            os.makedirs(os.path.dirname(o), exist_ok=True); json.dump(res, open(o, "w", encoding="utf-8"), ensure_ascii=False); os.remove(j)
        if k % 10 == 0: print(f"  {k}/{len(todo)}", flush=True)
    shutil.rmtree(tmp, ignore_errors=True)
    themes = [t for t in (F.p("themes") if isinstance(F.c["themes"], str) else [os.path.normpath(os.path.join(F.dir, t)) for t in F.c["themes"]]) if os.path.exists(t)]
    out = F.p("sheets", d="-".join(days)); step(f"листы кадров → {out}")
    cmd = ["uv", "run", "-q", "--with", "pillow", "python", "-I", f"{SK}/shot_catalog.py", "sheets", "--inventory", inv]
    for d in days: cmd += ["--day", d]
    cmd += ["--out", out, "--tz", str(F.c["tz"])]
    for t in themes: cmd += ["--themes", t]
    code = run(cmd, None, F.dir)
    print("\nДальше: метки по листам → shot_catalog.py build → сценарий (film-screenwriter) → сборщик → film.py plan sN")
    return code


WHERE = """# {name} — подготовка к монтажу

Исходники: `{sources}` (папки дней — только чтение). Всё рабочее — в этой папке.

| Папка | Что внутри |
|---|---|
| **1 сценарий** | сценарии серий, фразы для голоса, записи голоса |
| **2 карты** | карты дней |
| **6 музыка** | треки по сериям (`серия N/`), `звуки/` |
| **7 черновики** | то, что смотрит владелец: только последняя версия каждой серии |
| служебное/filmora | планы, сборщики серий, `film.json`, отчёты (`отчёты/sN`), допуск рецензента (`допуск/`) |
| служебное/данные | инвентарь, расшифровки (`речь/`), каталоги кадров, разбор музыки |

## Три команды

Из `служебное/filmora`, `SK={sk}`:

1. `python3 $SK/film.py prep <дни>` — инвентарь, расшифровка, листы кадров.
2. `python3 $SK/film.py plan sN` — сборщик → план → проверки плана → сводка.
3. `python3 $SK/film.py draft sN` — рендер 360p → проверки → сводка → черновик → запрос рецензии; после допуска — `draft sN --hd`.
"""


def cmd_init(a):
    if not a or a[0].startswith("--"): sys.exit("film.py init <папка подготовки> --sources <папка исходников> [--name ИМЯ]")
    prep = os.path.abspath(a[0]); src = opt(a, "--sources"); name = opt(a, "--name") or os.path.basename(os.path.dirname(prep)) or "фильм"
    if not src or not os.path.isdir(src): sys.exit("--sources: папка исходников (с папками дней)")
    plans = os.path.join(prep, "служебное", "filmora"); cfg = os.path.join(plans, "film.json")
    if os.path.exists(cfg): sys.exit(f"{cfg} уже есть — фильм начат")
    for d in ("1 сценарий", "2 карты", "6 музыка", "7 черновики", "служебное/filmora/proxy", "служебное/данные/речь"):
        os.makedirs(os.path.join(prep, d), exist_ok=True)
    json.dump({"film": name, "sources": os.path.abspath(src), "words_root": os.path.join(prep, "служебное", "данные", "речь"),
               "day_glob": "День {d} *", "session": "", "series": {}}, open(cfg, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    w = os.path.join(prep, "ЧТО ГДЕ ЛЕЖИТ.md")
    if not os.path.exists(w): open(w, "w", encoding="utf-8").write(WHERE.format(name=name, sources=os.path.abspath(src), sk=SK))
    print(f"готово: {cfg}\nДальше: cd {sh([plans])} && python3 {SK}/film.py prep <дни>")
    return 0


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"): print(__doc__); return 0
    cmd, a = a[0], a[1:]
    if cmd == "init": return cmd_init(a)
    F = find_film(a)
    a = [x for i, x in enumerate(a) if x != "--film" and (i == 0 or a[i - 1] != "--film")]
    if cmd == "status": return cmd_status(F, a)
    if cmd == "music": return cmd_music(F, a)
    if cmd == "prep": return cmd_prep(F, a)
    if cmd in ("plan", "draft", "check"):
        if not a or not re.fullmatch(r"s\d+", a[0]): sys.exit(f"film.py {cmd} sN")
        return cmd_plan(F, a) if cmd == "plan" else cmd_draft(F, a, only_check=cmd == "check")
    sys.exit(f"неизвестная команда {cmd}: film.py --help")


if __name__ == "__main__":
    sys.exit(main())
