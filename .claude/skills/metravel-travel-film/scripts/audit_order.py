#!/usr/bin/env python3
"""Последовательность кадров: всё, что видит зритель, идёт в порядке съёмки, и кадр не показан раньше своего времени.

audit_order.py <plan.json> [--root <папка исходников>] [--inventory inventory.json] [--maps <папка карт копий>]
               [--tz 2] [--tol 15] [--skip "0." "T."] [--story рассказ] [--montage интро открытие итог]
               [--others <plan другой серии> …] [--out отчёт.md]

Чем отличается от ВРЕМЯ в audit_cut.py: там сверяются только главные планы и только с предыдущим. Здесь на одну ось
времени встают и главные планы, и перебивки (фото и видео), а из оси вынимается «хребет» — самая длинная цепочка кадров в
порядке съёмки. Находка — кадр вне хребта, отстоящий от соседей по хребту больше чем на --tol минут:
  ВПЕРЁД   кадр снят позже того, что показано после него: зритель видит место раньше, чем герои до него дошли
           (владелец 16.11: табличка «опасно» стояла посреди пляжа, а снята на подъёме)
  НАЗАД    кадр снят раньше того, что показано до него: возврат к пройденному
  МЕЖДУ СЕРИЯМИ  (--others) тот же кусок исходника (> 1 с) уже стоит в другой серии
  Без времени    справка: кадры, у которых время съёмки узнать не удалось

Время кадра = время съёмки исходника + смещение внутри него. Копии (размытие, память, вертикали, фото-видео) сводятся
к исходнику теми же картами, что в unused.py. Время съёмки: имя файла _ГГГГММДДЧЧММСС_ (Pocket, местное), иначе
creation_time из инвентаря или ffprobe (UTC + --tz часов), для фото — дата EXIF (sips, местное).
Не проверяются: планы с заметкой, начинающейся с --skip (интро сериала, «ранее», тизер), главный план рассказа
(--story в заметке: рассказ записан на другой день, а перебивки под ним — проверяются), кадры не из --root (архивы 🗂,
карты, титры). Нарезки (--montage в заметке: интро дня, открытие, итог) собраны не по порядку намеренно — их кадры
идут справкой, а не находками. Рассказ о прошлом дне посреди серии — намеренный: такие находки закрываются словом в отчёте, не правкой.
"""
import json, os, re, subprocess, sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unused as U

CACHE = os.path.expanduser("~/.cache/metravel-shot-times.json")
PHOTO = (".jpg", ".jpeg", ".png", ".heic")


def opt(a, k, d=None):
    return a[a.index(k) + 1] if k in a and a.index(k) + 1 < len(a) else d


def opts(a, k):
    out, i = [], 0
    while i < len(a):
        if a[i] == k:
            i += 1
            while i < len(a) and not a[i].startswith("--"): out.append(a[i]); i += 1
        else:
            i += 1
    return out


class Clock:
    def __init__(self, tz, inventory):
        self.tz = timedelta(hours=tz); self.inv = {}
        try: self.cache = json.load(open(CACHE))
        except Exception: self.cache = {}
        self.dirty = False
        if inventory and os.path.exists(inventory):
            for it in json.load(open(inventory, encoding="utf-8")):
                if it.get("ct"): self.inv[U.NP(it["path"])] = it["ct"]

    def shot(self, path):
        """Местное время начала съёмки файла или None."""
        m = re.search(r"_(\d{14})_", os.path.basename(path))
        if m:
            try: return datetime.strptime(m.group(1), "%Y%m%d%H%M%S")
            except ValueError: pass
        if path.lower().endswith(PHOTO):
            v = self._cached(path, self._exif)
            try: return datetime.strptime(v, "%Y:%m:%d %H:%M:%S") if v else None
            except ValueError: return None
        v = self.inv.get(path) or self._cached(path, self._probe)
        try: return datetime.fromisoformat(v[:19]) + self.tz if v else None
        except ValueError: return None

    def _cached(self, path, fn):
        if path not in self.cache:
            if not os.path.exists(path): return ""                      # диск не подключён — не запоминать «без времени»
            self.cache[path] = fn(path); self.dirty = True
        return self.cache[path]

    @staticmethod
    def _probe(path):
        return subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags=creation_time", "-of", "csv=p=0", path],
                              capture_output=True, text=True).stdout.strip()

    @staticmethod
    def _exif(path):
        o = subprocess.run(["sips", "-g", "creation", path], capture_output=True, text=True).stdout
        m = re.search(r"creation:\s*(\d{4}:\d\d:\d\d \d\d:\d\d:\d\d)", o)
        return m.group(1) if m else ""

    def save(self):
        if not self.dirty: return
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        tmp = CACHE + f".{os.getpid()}"; json.dump(self.cache, open(tmp, "w")); os.replace(tmp, CACHE)


def pieces(P, M, root, base, skip, story=None):
    """Куски плана на экране: (время фильма, заметка, вид, исходник, от, до, главный ли план рассказа)."""
    out, t = [], 0.0
    def org(path, a):
        return U.origin(U.NP(path, base), a, M, root)
    for x in P["segments"]:
        d = x["out"] - x["in"]; note = x.get("note", "")
        if not note.startswith(tuple(skip)):
            p = P["sources"].get(x["src"])
            if p:
                o, oa = org(p, x["in"])
                out.append((t, note, "план", o, oa, oa + d, bool(story and story in note)))
            for b in x.get("broll", []):
                if b.get("flash") or b.get("bridge"): continue
                if isinstance(b.get("orig"), dict) and b["orig"].get("file"): o, oa = org(b["orig"]["file"], b["orig"].get("in", 0.0))
                elif b.get("file"): o, oa = org(b["file"], b.get("in", 0.0))
                else: continue
                out.append((t + max(0.0, b.get("at", x["in"]) - x["in"]), note, "перебивка", o, oa, oa + b.get("dur", 0.0), False))
        t += d
    return out


def spine(ts):
    """Индексы самой длинной неубывающей цепочки."""
    n = len(ts); best = [1] * n; prev = [-1] * n
    for j in range(n):
        for i in range(j):
            if ts[i] <= ts[j] and best[i] + 1 > best[j]: best[j] = best[i] + 1; prev[j] = i
    if not n: return []
    k = max(range(n), key=lambda i: best[i]); out = []
    while k >= 0: out.append(k); k = prev[k]
    return out[::-1]


def tc(x):
    return f"{int(x // 60)}:{x % 60:04.1f}"


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"): print(__doc__); return 0
    plan_path = os.path.abspath(a[0]); P = json.load(open(plan_path, encoding="utf-8")); base = os.path.dirname(plan_path)
    root = opt(a, "--root"); tol = timedelta(minutes=float(opt(a, "--tol", "15")))
    skip = opts(a, "--skip") or ["0.", "T."]; story = opt(a, "--story", "рассказ")
    montage = [m.lower() for m in (opts(a, "--montage") or ["интро", "открытие", "итог"])]
    M = U.load_maps(opt(a, "--maps", base)); clock = Clock(float(opt(a, "--tz", "2")), opt(a, "--inventory"))
    rootn = os.path.join(U.NP(root), "") if root else None                     # со слешем: /GR21 не захватывает /GR21 архив
    items, blind, foreign = [], [], 0
    for t, note, kind, o, oa, ob, told in pieces(P, M, root, base, skip, story):
        if rootn and not o.startswith(rootn): foreign += 1; continue
        if rootn and "/_" in "/" + o[len(rootn):]: foreign += 1; continue        # служебные папки внутри исходников: карты, титры
        if told: continue
        st = clock.shot(o)
        if st is None: blind.append((t, note, kind, o)); continue
        items.append((t, note, kind, o, st + timedelta(seconds=0 if o.lower().endswith(PHOTO) else oa)))
    clock.save()
    cut = [x for x in items if any(m in x[1].lower() for m in montage)]            # нарезки — вне оси
    items = [x for x in items if not any(m in x[1].lower() for m in montage)]
    items.sort(key=lambda x: x[0]); ts = [x[4] for x in items]; sp = spine(ts); on = set(sp); F = []
    for k, (t, note, kind, o, st) in enumerate(items):
        if k in on: continue
        pv = max((i for i in sp if i < k), default=None); nx = min((i for i in sp if i > k), default=None)
        name = os.path.basename(o)
        if nx is not None and st > ts[nx] + tol:
            F.append((t, "ВПЕРЁД", note, f"{kind} {name} снят {st:%d.%m %H:%M}, а следом идёт «{items[nx][1][:40]}» — {ts[nx]:%d.%m %H:%M}: "
                      f"показан на {int((st - ts[nx]).total_seconds() // 60)} мин раньше своего времени"))
        elif pv is not None and st < ts[pv] - tol:
            F.append((t, "НАЗАД", note, f"{kind} {name} снят {st:%d.%m %H:%M}, а до него уже показано «{items[pv][1][:40]}» — {ts[pv]:%d.%m %H:%M}: "
                      f"возврат на {int((ts[pv] - st).total_seconds() // 60)} мин"))
    mine = pieces(P, M, root, base, skip)
    for op in opts(a, "--others"):
        try: O = json.load(open(op, encoding="utf-8"))
        except Exception: continue
        ob_ = os.path.dirname(os.path.abspath(op)); theirs = {}
        for _, note, _, o, a0, b0, _ in pieces(O, U.load_maps(ob_) if ob_ != base else M, root, ob_, skip):
            theirs.setdefault(o, []).append((a0, b0, note))
        seen = set()
        for t, note, kind, o, a0, b0, _ in mine:
            if rootn and not o.startswith(rootn): continue
            for a1, b1, n1 in theirs.get(o, []):
                if min(b0, b1) - max(a0, a1) > 1.0 and (o, round(a0)) not in seen:
                    seen.add((o, round(a0)))
                    F.append((t, "МЕЖДУ СЕРИЯМИ", note, f"{kind} {os.path.basename(o)} {max(a0, a1):.0f}–{min(b0, b1):.0f} с уже стоит в "
                              f"{os.path.basename(op)} («{n1[:40]}»)"))
    F.sort()
    L = [f"# Последовательность кадров: {os.path.basename(plan_path)}, находок {len(F)}", "",
         f"Кадров на оси времени {len(items)} (в порядке съёмки {len(sp)}), без времени {len(blind)}, не из исходников фильма {foreign}. "
         f"Допуск {int(tol.total_seconds() // 60)} мин. Кадров в нарезках ({', '.join(montage)}) — {len(cut)}, они вне проверки.", ""]
    for kind in ("ВПЕРЁД", "НАЗАД", "МЕЖДУ СЕРИЯМИ"):
        rows = [f for f in F if f[1] == kind]
        L.append(f"## {kind} — {len(rows)}")
        L += [f"- {tc(t)} «{note[:44]}»: {txt}" for t, _, note, txt in rows] + [""]
    if blind:
        L.append("## Без времени (справка)")
        L += [f"- {tc(t)} «{note[:44]}»: {kind} {os.path.basename(o)}" for t, note, kind, o in blind[:40]] + [""]
    txt = "\n".join(L); out = opt(a, "--out")
    if out: open(out, "w", encoding="utf-8").write(txt)
    print(txt if not out else f"{out}: находок {len(F)} — " + ", ".join(f"{k} {sum(1 for f in F if f[1] == k)}" for k in ("ВПЕРЁД", "НАЗАД", "МЕЖДУ СЕРИЯМИ")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
