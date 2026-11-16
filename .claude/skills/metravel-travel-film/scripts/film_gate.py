#!/usr/bin/env python3
"""Допуск к сборке travel-фильма: 1080p — после рецензий, 4K — только по слову владельца.

Журнал допуска — <папка плана>/допуск/<серия>.json. Пишет его только рецензент
(`film-reviewer`) и, для 4K, сессия, получившая слово владельца в чате.

  film_gate.py script  <сценарий.md> --series s3 --score 8 --report <рецензия.md>
      оценка «сценарий»; журнал кладётся рядом с планами: --plans-dir <папка>
  film_gate.py verdict <plan.json> --series s3 --draft <черновик.mp4> --tech <audit_tech.md>
                       --scores сюжет=8,монтаж=8,картинка=8,звук=8,музыка=8 --blockers 0 --report <рецензия.md>
      оценки готового черновика ровно по этому плану (sha256 файла плана)
  film_gate.py owner-4k <plan.json> --series s3 --quote "<слова владельца из чата>"
  film_gate.py check <plan.json> --size 1920x1080      — код 0, если сборка разрешена
  film_gate.py status <папка планов>                    — сводка по сериям

Правило: размер больше 640x360 (черновик) собирается только при допуске по этому плану —
все шесть оценок (сценарий, сюжет, монтаж, картинка, звук, музыка) не ниже 8,
блокеров 0, техконтроль черновика «ГОДЕН», сценарий не менялся после оценки.
Больше 1920x1080 — ещё и запись owner-4k по этому же плану.
"""
import argparse, datetime, fcntl, glob, hashlib, json, os, re, sys

FILM_KEYS = ("сюжет", "монтаж", "картинка", "звук", "музыка")
ALL_KEYS = ("сценарий",) + FILM_KEYS
THRESHOLD = 8
DRAFT_MAX = (640, 360)
HD_MAX = (1920, 1080)


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def ledger_path(plans_dir, series):
    return os.path.join(plans_dir, "допуск", f"{series}.json")


def load(path):
    if not os.path.exists(path):
        return {"entries": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def append(plans_dir, series, entry):
    path = ledger_path(plans_dir, series)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path + ".lock", "w") as lock:        # чтение-дополнение-запись под замком: параллельная запись не теряет записи
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = load(path)
        data["series"] = series
        data["entries"].append(dict(entry, series=series, at=datetime.datetime.now().isoformat(timespec="seconds")))
        tmp = f"{path}.{os.getpid()}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
            f.flush(); os.fsync(f.fileno())
        os.replace(tmp, path)
    return path


def last(entries, kind, **match):
    for e in reversed(entries):
        if e.get("kind") == kind and all(e.get(k) == v for k, v in match.items()):
            return e
    return None


def plan_series(plan_path):
    """Серия из имени файла плана: plan_s3_v5.json → s3; None, если в имени её нет."""
    m = re.search(r"(?:^|[_\W])(s\d+)(?=[_\W]|$)", os.path.basename(plan_path), re.IGNORECASE)
    return m.group(1).lower() if m else None


def check_series(plan_path, series):
    named = plan_series(plan_path)
    if named and named != series:
        raise SystemExit(f"план {os.path.basename(plan_path)} — серия {named}, а указана --series {series}")


def gate_problems(plan_path, width, height):
    """Пустой список — сборка разрешена; иначе — причины отказа."""
    if width <= DRAFT_MAX[0] and height <= DRAFT_MAX[1]:
        return []
    plans_dir = os.path.dirname(os.path.abspath(plan_path))
    plan_sha = sha(plan_path)
    found = []                         # (журнал серии, последний вердикт по этому плану)
    for path in sorted(glob.glob(os.path.join(plans_dir, "допуск", "*.json"))):
        ledger = load(path)
        e = last(ledger["entries"], "film", plan_sha=plan_sha)
        if e:
            found.append((ledger, e))
    if len(found) > 1:                 # оценка сценария берётся из журнала серии — чужая серия не должна её подменять
        return ["вердикты по этому плану записаны в нескольких сериях: " + ", ".join(e["series"] for _, e in found)
                + " — лишние записи убери из журналов допуска"]
    ledger, film = found[0] if found else (None, None)
    if film is None:
        return [f"нет вердикта рецензента по этому плану (sha {plan_sha[:12]}): сначала черновик ≤{DRAFT_MAX[0]}x{DRAFT_MAX[1]}, "
                "автопроверки и film-reviewer → film_gate.py verdict"]
    problems = []
    if plan_series(plan_path) and film["series"] != plan_series(plan_path):
        problems.append(f"вердикт записан в серию {film['series']}, а план — серии {plan_series(plan_path)}")
    script = last(ledger["entries"], "script")
    if script is None:
        problems.append("нет оценки сценария (film_gate.py script)")
    elif not os.path.exists(script["file"]) or sha(script["file"]) != script["sha"]:
        problems.append(f"сценарий изменён после оценки — нужна новая оценка: {script['file']}")
    scores = dict(film["scores"], сценарий=script["score"] if script else 0)
    low = [f"{k} {scores.get(k, 0)}" for k in ALL_KEYS if scores.get(k, 0) < THRESHOLD]
    if low:
        problems.append("оценки ниже 8: " + ", ".join(low))
    if film.get("blockers", 1):
        problems.append(f"открытых блокеров: {film.get('blockers')}")
    if not film.get("tech_ok"):
        problems.append("техконтроль черновика не «ГОДЕН» (или отчёт audit_tech не по этому черновику)")
    if width > HD_MAX[0] or height > HD_MAX[1]:
        if not last(ledger["entries"], "owner4k", plan_sha=plan_sha):
            problems.append("4K только по слову владельца: нет записи owner-4k по этому плану")
    return problems


def require(plan_path, width, height):
    """Вызывается из render_plan.py и assemble_film.py до рендера."""
    problems = gate_problems(plan_path, width, height)
    if problems:
        raise SystemExit(f"сборка {width}x{height} не разрешена:\n- " + "\n- ".join(problems))


def parse_scores(text):
    scores = {}
    for part in filter(None, (p.strip() for p in text.split(","))):
        k, eq, v = (x.strip() for x in part.partition("="))
        if not eq or not v.lstrip("-").isdigit():
            raise SystemExit(f"не разобрать оценку «{part}»: нужно ключ=число")
        if k not in FILM_KEYS:
            raise SystemExit(f"лишний ключ «{k}»: в --scores только " + ", ".join(FILM_KEYS) + " (сценарий — командой script)")
        if k in scores:
            raise SystemExit(f"оценка «{k}» указана дважды")
        scores[k] = int(v)
    missing = [k for k in FILM_KEYS if k not in scores]
    if missing:
        raise SystemExit("нет оценок: " + ", ".join(missing))
    if any(not 0 <= v <= 10 for v in scores.values()):
        raise SystemExit("оценка вне шкалы 0–10")
    return {k: scores[k] for k in FILM_KEYS}


def tech_ok(path, draft):
    """Первая строка audit_tech.py: «# Техконтроль: <файл черновика> — ГОДЕН»; отчёт по другому файлу не засчитывается."""
    with open(path, encoding="utf-8") as f:
        head = f.readline()
    return os.path.basename(draft) in head and "ГОДЕН" in head and "НЕ ГОДЕН" not in head


def parse_size(text):
    w, x, h = text.lower().partition("x")
    if not (x and w.isdigit() and h.isdigit()):
        raise SystemExit(f"размер «{text}»: нужно ШИРИНАxВЫСОТА, например 1920x1080")
    return int(w), int(h)


def status(plans_dir):
    rows = []
    for path in sorted(glob.glob(os.path.join(plans_dir, "допуск", "*.json"))):
        entries = load(path)["entries"]
        series = os.path.splitext(os.path.basename(path))[0]
        script = last(entries, "script")
        film = last(entries, "film")
        line = f"{series}: сценарий {script['score'] if script else '—'}"
        if film:
            line += " · " + ", ".join(f"{k} {film['scores'][k]}" for k in FILM_KEYS)
            line += f" · блокеров {film['blockers']} · техконтроль {'ГОДЕН' if film['tech_ok'] else 'НЕ ГОДЕН'}"
            plan = film["plan"]
            if os.path.exists(plan) and sha(plan) == film["plan_sha"]:
                hd = gate_problems(plan, *HD_MAX)
                line += " → 1080p " + ("разрешён" if not hd else "закрыт")
                if not hd and last(entries, "owner4k", plan_sha=film["plan_sha"]):
                    line += ", 4K разрешён владельцем"
            else:
                line += " → план изменён после вердикта, нужна новая рецензия"
        rows.append(line)
    print("\n".join(rows) if rows else "журналов допуска нет")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("script"); s.add_argument("file"); s.add_argument("--series", required=True)
    s.add_argument("--score", type=int, required=True); s.add_argument("--report", required=True)
    s.add_argument("--plans-dir", required=True)
    v = sub.add_parser("verdict"); v.add_argument("plan"); v.add_argument("--series", required=True)
    v.add_argument("--draft", required=True); v.add_argument("--tech", required=True)
    v.add_argument("--scores", required=True); v.add_argument("--blockers", type=int, required=True)
    v.add_argument("--report", required=True)
    o = sub.add_parser("owner-4k"); o.add_argument("plan"); o.add_argument("--series", required=True)
    o.add_argument("--quote", required=True)
    c = sub.add_parser("check"); c.add_argument("plan"); c.add_argument("--size", required=True)
    st = sub.add_parser("status"); st.add_argument("plans_dir")
    a = ap.parse_args()

    if a.cmd == "script":
        if not 0 <= a.score <= 10:
            raise SystemExit("оценка вне шкалы 0–10")
        for p in (a.file, a.report):
            if not os.path.exists(p):
                raise SystemExit(f"нет файла: {p}")
        path = append(a.plans_dir, a.series, {"kind": "script", "file": os.path.abspath(a.file), "sha": sha(a.file),
                                              "score": a.score, "report": os.path.abspath(a.report)})
        print("записано:", path)
    elif a.cmd == "verdict":
        check_series(a.plan, a.series)
        for p in (a.plan, a.draft, a.tech, a.report):
            if not os.path.exists(p):
                raise SystemExit(f"нет файла: {p}")
        entry = {"kind": "film", "plan": os.path.abspath(a.plan), "plan_sha": sha(a.plan), "draft": os.path.abspath(a.draft),
                 "scores": parse_scores(a.scores), "blockers": a.blockers, "tech_ok": tech_ok(a.tech, a.draft),
                 "report": os.path.abspath(a.report)}
        path = append(os.path.dirname(os.path.abspath(a.plan)), a.series, entry)
        problems = gate_problems(a.plan, *HD_MAX)
        print("записано:", path)
        print("1080p разрешён" if not problems else "1080p закрыт:\n- " + "\n- ".join(problems))
    elif a.cmd == "owner-4k":
        check_series(a.plan, a.series)
        if len(a.quote.strip()) < 3:
            raise SystemExit("нужны слова владельца из чата")
        path = append(os.path.dirname(os.path.abspath(a.plan)), a.series,
                      {"kind": "owner4k", "plan": os.path.abspath(a.plan), "plan_sha": sha(a.plan), "quote": a.quote.strip()})
        print("записано:", path)
    elif a.cmd == "check":
        w, h = parse_size(a.size)
        problems = gate_problems(a.plan, w, h)
        print("разрешено" if not problems else "не разрешено:\n- " + "\n- ".join(problems))
        sys.exit(0 if not problems else 1)
    else:
        status(a.plans_dir)


if __name__ == "__main__":
    main()
