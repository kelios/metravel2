#!/usr/bin/env python3
"""Допуск к сборке travel-фильма: 1080p — после рецензий, 4K — только по слову владельца.

Журнал допуска — <папка плана>/допуск/<серия>.json. Оценки пишет только рецензент
(`film-reviewer`), слово владельца на 4K — сессия, получившая его в чате;
сборщик пишет лишь запрос рецензии (request), на допуск он не влияет.

  film_gate.py script  <сценарий.md> --series s3 --score 8 --report <рецензия.md>
      оценка «сценарий»; журнал кладётся рядом с планами: --plans-dir <папка>
  film_gate.py verdict <plan.json> --series s3 --draft <черновик.mp4> --tech <audit_tech.md>
                       --scores сюжет=8,монтаж=8,картинка=8,звук=8,музыка=8 --blockers 0 --report <рецензия.md>
      оценки готового черновика ровно по этому плану (sha256 файла плана)
  film_gate.py plan-verdict <plan.json> --series s3 --scores … --blockers 0 --report <рецензия.md>
      вердикт по плану без черновика 360p (владелец 22.11: правки проверены по плану) — засчитывается для 1080p;
      после 1080p рецензент пишет обычный verdict по готовому файлу. Для 4K вердикта «по плану» мало
  film_gate.py request <plan.json> --series s3 --draft <черновик.mp4> --from "<сессия>" [--audit-cut audit_cut.md]
      и plan-verdict: только если audit_cut по этому плану (строка «план sha256») без неразобранных ФРАЗА и РАЗРЫВ
      сборщик просит рецензию: status показывает черновик в очереди, пока по этому плану нет вердикта
  film_gate.py owner-4k <plan.json> --series s3 --quote "<слова владельца из чата>"
  film_gate.py check <plan.json> --size 1920x1080      — код 0, если сборка разрешена
  film_gate.py status <папка планов>                    — сводка по сериям

Копии: план, отличающийся от допущенного только подменой исходника его копией (вертикальные/, память/, размытие/,
шумоподавление/ — по картам копий, тот же исходник и длина куска ±0,05 с), наследует допуск; в журнал — строка «копии: N
подмен». Любое другое отличие — новый вердикт. owner-4k не наследуется. Снимки допущенных планов — допуск/планы/.

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


# ---------------------------------------------------------------- допуск переживает подмену копий (рецензент 23.11)
# Нарезка вертикалей, «памяти», копий размытия и шумоподавления меняет sha плана, хотя монтаж тот же: s3 v21 — 12 вертикалей →
# новый sha → лишний круг через рецензента. Допуск наследуется, если план отличается от допущенного ТОЛЬКО тем, что исходник
# заменён своей производной копией (карта копий: alias*.json, *карта*.json, memory/vertical jobs — тот же исходник, время
# сдвинуто на начало копии, длина куска та же ±0,05 с). Любое другое отличие — отрезки, порядок, музыка, громкость, плашки —
# новый вердикт. Слово владельца на 4K не наследуется. Снимки допущенных планов — допуск/планы/<sha12>.json.
TOL = 0.06


def snap_path(plans_dir, plan_sha):
    return os.path.join(plans_dir, "допуск", "планы", f"{plan_sha[:12]}.json")


def snapshot(plan_path, plan_sha=None):
    plan_sha = plan_sha or sha(plan_path)
    dst = snap_path(os.path.dirname(os.path.abspath(plan_path)), plan_sha)
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        tmp = f"{dst}.{os.getpid()}.tmp"
        with open(plan_path, "rb") as f, open(tmp, "wb") as g: g.write(f.read())
        os.replace(tmp, dst)
    return dst


def normal_form(P, plans_dir, M):
    """План без имён копий: каждый путь — исходник, каждое время — время исходника; ключи sources и orig отброшены.
    Возвращает (нормальная форма, множество путей-копий, которые были подменены)."""
    import unused as U
    S = P.get("sources", {}); copies = set()
    def o(path, t=0.0):
        n = U.NP(path, plans_dir); r = U.origin(n, t, M)
        if r[0] != n: copies.add(n)
        return r
    def walk(x):
        if isinstance(x, dict):
            y = {k: walk(v) for k, v in x.items() if k not in ("orig",)}
            if isinstance(x.get("src"), str) and x["src"] in S:
                p_, a_ = o(S[x["src"]], x.get("in", 0.0)); y["src"] = p_
                if "in" in x and "out" in x: y["in"], y["out"] = a_, a_ + (x["out"] - x["in"])
                # «at» перебивок и плашек куска — время его исходника: копия сдвигает и их (s1 v23d_blur 23.11: cards.at 4.3 → 0.9)
                sh_ = a_ - x.get("in", 0.0)
                for k_ in ("broll", "cards"):
                    for q_ in y.get(k_) or []:
                        if isinstance(q_, dict) and isinstance(q_.get("at"), (int, float)): q_["at"] = q_["at"] + sh_
            elif isinstance(x.get("file"), str):
                p_, a_ = o(x["file"], x.get("in", 0.0)); y["file"] = p_
                if "in" in x: y["in"] = a_
            return y
        if isinstance(x, list):
            if len(x) == 2 and isinstance(x[0], str) and x[0] in S and isinstance(x[1], (int, float)):
                return list(o(S[x[0]], x[1]))
            return [walk(v) for v in x]
        return x
    return walk({k: v for k, v in P.items() if k != "sources"}), copies


def same(a, b, path="", out=None):
    """Отличия двух нормальных форм (числа — с допуском TOL); out — список «где: было → стало» (первые 5)."""
    out = [] if out is None else out
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
    if len(out) >= 5: return out
    if num(a) and num(b):                    # громкость куска перемеряется по копии (s3, рецензент 23.11): loud_gain/lufs — до 1 дБ
        tol = 1.0 if path.rsplit("/", 1)[-1] in ("loud_gain", "lufs") else TOL
        if abs(a - b) > tol: out.append(f"{path}: {a} → {b}")
    elif type(a) != type(b):
        out.append(f"{path}: {str(a)[:60]} → {str(b)[:60]}")
    elif isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b: out.append(f"{path}/{k}: {'добавлен' if k in b else 'убран'}")
            else: same(a[k], b[k], f"{path}/{k}", out)
            if len(out) >= 5: break
    elif isinstance(a, list):
        if len(a) != len(b): out.append(f"{path}: {len(a)} → {len(b)} элементов")
        else:
            for i, (x, y) in enumerate(zip(a, b)):
                same(x, y, f"{path}[{i}]", out)
                if len(out) >= 5: break
    elif a != b:
        out.append(f"{path}: {str(a)[:60]} → {str(b)[:60]}")
    return out


def inherited_film(plan_path, plans_dir):
    """Вердикт по допущенному плану, от которого этот отличается только подменой копий: (журнал, вердикт, подмен, sha-источник)
    или (None, None, 0, причины-несовпадения ближайшего)."""
    import unused as U
    series = plan_series(plan_path)
    cands = []
    for path in sorted(glob.glob(os.path.join(plans_dir, "допуск", "*.json"))):
        ledger = load(path)
        for e in reversed(ledger["entries"]):
            if e.get("kind") != "film" or (series and e.get("series") != series): continue
            sp = snap_path(plans_dir, e["plan_sha"])
            if not os.path.exists(sp) and e.get("plan") and os.path.exists(e["plan"]) and sha(e["plan"]) == e["plan_sha"]:
                snapshot(e["plan"], e["plan_sha"])           # допуск до 23.11: снимок по живому файлу, пока он не изменён
            if os.path.exists(sp) and all(c[1]["plan_sha"] != e["plan_sha"] for c in cands): cands.append((ledger, e, sp))
    if not cands: return None, None, 0, []
    M = U.load_maps(plans_dir)
    new, cp_new = normal_form(json.load(open(plan_path, encoding="utf-8")), plans_dir, M)
    best = None
    for ledger, e, sp in cands[:6]:                      # последние вердикты серии
        old, cp_old = normal_form(json.load(open(sp, encoding="utf-8")), plans_dir, M)
        diff = same(old, new)
        if not diff:
            return ledger, e, len(cp_new ^ cp_old), e["plan_sha"]
        best = best or diff
    return None, None, 0, best or []


def gate_problems(plan_path, width, height, inherit=None):
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
    if film is not None and not os.path.exists(snap_path(plans_dir, plan_sha)):
        snapshot(plan_path, plan_sha)
    if film is None:
        ledger, film, n_cp, from_sha = inherited_film(plan_path, plans_dir)
        if film is not None and inherit is not None:
            inherit.update(n=n_cp, from_sha=from_sha)
        if film is None:
            why = ("; ближайший допущенный план отличается не только копиями: " + "; ".join(from_sha[:3])) if from_sha else ""
            return [f"нет вердикта рецензента по этому плану (sha {plan_sha[:12]}): сначала черновик ≤{DRAFT_MAX[0]}x{DRAFT_MAX[1]}, "
                    "автопроверки и film-reviewer → film_gate.py verdict" + why]
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
    if (width > HD_MAX[0] or height > HD_MAX[1]) and film.get("mode") == "plan":
        problems.append("4K: вердикт «по плану» — нужен вердикт рецензента по готовому 1080p этого плана")
    if width > HD_MAX[0] or height > HD_MAX[1]:
        if not last(ledger["entries"], "owner4k", plan_sha=plan_sha):
            problems.append("4K только по слову владельца: нет записи owner-4k по этому плану")
    return problems


def phrase_problems(plan_path, report=None):
    """Рецензент 23.11 (s5 10:15): план с неразобранной ФРАЗА или РАЗРЫВ не идёт ни в plan-verdict, ни в request.
    Отчёт audit_cut по этому плану: --audit-cut или любой audit_cut*.md в папке планов, где строка «план sha256: <sha12>»."""
    psha = sha(plan_path)[:12]; pd = os.path.dirname(os.path.abspath(plan_path))
    cands = [report] if report else sorted(glob.glob(os.path.join(pd, "**", "audit_cut*.md"), recursive=True), key=os.path.getmtime, reverse=True)
    for r in cands:
        if not r or not os.path.exists(r): continue
        with open(r, encoding="utf-8") as f:
            head = "".join(f.readline() for _ in range(4))
        m = re.search(r"план sha256: (\w+) · ФРАЗА неразобранных: (\d+) · РАЗРЫВ: (\d+)", head)
        if not m or m.group(1) != psha: continue
        n_ph, n_rz = int(m.group(2)), int(m.group(3))
        return [] if not (n_ph or n_rz) else [f"audit_cut {os.path.basename(r)}: ФРАЗА неразобранных {n_ph}, РАЗРЫВ {n_rz} — поправь края "
                                               "или разбери (ключ отрезка phrase_ok: {\"in\"|\"out\": причина}) и перезапусти audit_cut"]
    return [f"нет отчёта audit_cut по этому плану (sha {psha}): audit_cut.py <план> --words-root … --out audit_cut_….md (или --audit-cut)"]


def require(plan_path, width, height):
    """Вызывается из render_plan.py и assemble_film.py до рендера."""
    inh = {}
    problems = gate_problems(plan_path, width, height, inherit=inh)
    if problems:
        raise SystemExit(f"сборка {width}x{height} не разрешена:\n- " + "\n- ".join(problems))
    if inh:                                              # допуск унаследован: строка в журнал и снимок этого плана
        plans_dir = os.path.dirname(os.path.abspath(plan_path)); psha = sha(plan_path)
        series = plan_series(plan_path)
        led = load(ledger_path(plans_dir, series)) if series else {"entries": []}
        if series and not last(led["entries"], "copies", plan_sha=psha):
            append(plans_dir, series, {"kind": "copies", "plan": os.path.abspath(plan_path), "plan_sha": psha,
                                       "from_sha": inh["from_sha"], "note": f"копии: {inh['n']} подмен"})
        snapshot(plan_path, psha)
        print(f"допуск: унаследован от плана {inh['from_sha'][:12]} — отличия только в копиях ({inh['n']} подмен)", flush=True)


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
            line += f" · блокеров {film['blockers']} · " + ("по плану, без 360p" if film.get("mode") == "plan" else
                                                           f"техконтроль {'ГОДЕН' if film['tech_ok'] else 'НЕ ГОДЕН'}")
            plan = film["plan"]
            if os.path.exists(plan) and sha(plan) == film["plan_sha"]:
                hd = gate_problems(plan, *HD_MAX)
                line += " → 1080p " + ("разрешён" if not hd else "закрыт")
                if not hd and last(entries, "owner4k", plan_sha=film["plan_sha"]):
                    line += ", 4K разрешён владельцем"
            else:
                line += " → план изменён после вердикта, нужна новая рецензия"
        req = last(entries, "request")
        if req and not any(e.get("kind") == "film" and e.get("plan_sha") == req["plan_sha"] and e["at"] >= req["at"]
                           for e in entries):
            line += f" · ЖДЁТ РЕЦЕНЗИИ с {req['at'].replace('T', ' ')[:16]}: {os.path.basename(req['draft'])} от {req['from']}"
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
    pv = sub.add_parser("plan-verdict"); pv.add_argument("plan"); pv.add_argument("--series", required=True)
    pv.add_argument("--scores", required=True); pv.add_argument("--blockers", type=int, required=True)
    pv.add_argument("--report", required=True); pv.add_argument("--audit-cut", dest="audit_cut")
    r = sub.add_parser("request"); r.add_argument("plan"); r.add_argument("--series", required=True)
    r.add_argument("--draft", required=True); r.add_argument("--from", dest="sender", required=True)
    r.add_argument("--audit-cut", dest="audit_cut")
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
        path = append(os.path.dirname(os.path.abspath(a.plan)), a.series, entry); snapshot(a.plan, entry["plan_sha"])
        problems = gate_problems(a.plan, *HD_MAX)
        print("записано:", path)
        print("1080p разрешён" if not problems else "1080p закрыт:\n- " + "\n- ".join(problems))
    elif a.cmd == "plan-verdict":
        check_series(a.plan, a.series)
        pp = phrase_problems(a.plan, a.audit_cut)
        if pp: raise SystemExit("plan-verdict не записан:\n- " + "\n- ".join(pp))
        for p in (a.plan, a.report):
            if not os.path.exists(p):
                raise SystemExit(f"нет файла: {p}")
        entry = {"kind": "film", "mode": "plan", "plan": os.path.abspath(a.plan), "plan_sha": sha(a.plan), "draft": None,
                 "scores": parse_scores(a.scores), "blockers": a.blockers, "tech_ok": True, "report": os.path.abspath(a.report)}
        path = append(os.path.dirname(os.path.abspath(a.plan)), a.series, entry); snapshot(a.plan, entry["plan_sha"])
        problems = gate_problems(a.plan, *HD_MAX)
        print("записано:", path)
        print("1080p разрешён (по плану)" if not problems else "1080p закрыт:\n- " + "\n- ".join(problems))
    elif a.cmd == "request":
        check_series(a.plan, a.series)
        pp = phrase_problems(a.plan, a.audit_cut)
        if pp: raise SystemExit("request не записан:\n- " + "\n- ".join(pp))
        if not a.sender.strip():
            raise SystemExit("нужно имя сессии-сборщика в --from")
        for p in (a.plan, a.draft):
            if not os.path.exists(p):
                raise SystemExit(f"нет файла: {p}")
        path = append(os.path.dirname(os.path.abspath(a.plan)), a.series,
                      {"kind": "request", "plan": os.path.abspath(a.plan), "plan_sha": sha(a.plan),
                       "draft": os.path.abspath(a.draft), "from": a.sender.strip()})
        print("записано:", path)
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
