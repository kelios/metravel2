#!/usr/bin/env python3
"""Покраска по плану: выравнивание планов между камерами + общий лук фильма.

ВЫКЛЮЧЕНО ПО УМОЛЧАНИЮ (владелец 23.11): фильм рендерится без покраски, как снято; render_plan применяет ключи "grade"
только с --grade. grade.py запускается лишь по прямой просьбе владельца и с явным режимом: --minimal или --look-on.

uv run --with numpy python grade.py <plan.json> <plan_graded.json> [--look look.cube] [--cache grade_stats.json]
    [--strength 1.0] [--skip-dirs память,титры,карты] [--alias alias.json] [--minimal]
--minimal — только яркость на стыках разных камер и gamma из ручных поправок: без лука, баланса белого и насыщенности
(владелец 16.11: полная покраска уводила цвета от того, что было на месте).
--alias — {производный файл: [исходник, сдвиг]}: камера размытых и вертикальных копий берётся по исходнику.

Что делает:
  1. По 3 кадрам каждого используемого куска (главная дорожка и перебивки) меряет яркость (p1/p50/p99),
     оттенок нейтральных пикселей и насыщенность. Замеры кешируются (--cache): повторный запуск быстрый.
  2. Пишет каждому плану ключ "grade" — цепочку фильтров ffmpeg (уровни → баланс белого → гамма → насыщенность),
     которая приводит план к общей цели фильма. Поправки мягкие и ограничены: закат остаётся тёплым,
     ночь — тёмной, туман — светлым (цель подтягивается к плану лишь частично).
  3. Создаёт лук фильма — 3D-LUT .cube (мягкая S-кривая, тёплые света, сдержанно холодные тени,
     +насыщенность с защитой тона кожи). Тот же .cube можно подключить в Filmora («Цвет → LUT»),
     и проект совпадёт с рендером. Лук ставится последним фильтром каждого плана.
Пропускаются уже обработанные файлы: «память» (свой лук воспоминаний), титры, карты (--skip-dirs).
Ручная покраска плана: ключ "grade" вместе с "grade_manual": true — перезапуск grade.py его не трогает.
Ключ плана "grade_extra" — ручная поправка плана поверх автоматической (ставится перед луком).
render_plan.py применяет "grade" плана сам; без этого ключа картинка идёт как есть.
"""
import json, os, subprocess, sys, hashlib
import numpy as np

a = sys.argv[1:]
if len(a) < 2 or not ({"--minimal", "--look-on"} & set(a)):
    sys.exit("grade.py: покраска по умолчанию не нужна (владелец 23.11: натуральные цвета, render_plan без --grade её не применяет).\n"
             "Только по прямой просьбе владельца: --minimal (яркость на стыках, gamma) или --look-on (полный лук).")
src_plan, dst_plan = a[0], a[1]
opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
STRENGTH = float(opt("--strength", "1.0"))
SKIP = [x.strip() for x in opt("--skip-dirs", "память,титры,карты,2 карты").split(",") if x.strip()]
plan = json.load(open(src_plan))
look_path = os.path.abspath(opt("--look", os.path.join(os.path.dirname(os.path.abspath(dst_plan)), "metravel_look.cube")))
cache_path = opt("--cache", os.path.join(os.path.dirname(os.path.abspath(dst_plan)), "grade_stats.json"))
cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
if any(c in look_path for c in "':\\"):   # в фильтре lut3d=file='…' эти знаки ломают разбор графа ffmpeg
    sys.exit(f"путь лука не должен содержать ' : \\ — задай другой --look: {look_path}")
W, H = 320, 180


# ---------- лук фильма: 3D-LUT ----------
def make_look(path, n=33):
    """Мягкий тёплый тревел-лук. Работает в RGB 0..1 (bt709, гамма-кодированный)."""
    g = np.linspace(0, 1, n)
    b_, g_, r_ = np.meshgrid(g, g, g, indexing="ij")          # порядок .cube: R меняется быстрее всех
    rgb = np.stack([r_, g_, b_], -1).reshape(-1, 3)
    y = rgb @ np.array([0.2126, 0.7152, 0.0722])
    # S-кривая по яркости: контраст +12% в середине, мягкий откат светов (без жёсткого клиппинга)
    def curve(x):
        s = x + 0.08 * (x - 0.5) * (1 - np.abs(2 * x - 1))     # добавка в середине, ноль на краях (рецензия v12: 0.12 топил тени)
        s = 0.015 + s * (1 - 0.015)                             # чёрное чуть приподнято: детали в тенях контрового света
        return np.clip(np.where(s > 0.9, 0.9 + (s - 0.9) * 0.7, s), 0, 1)
    y2 = curve(y)
    out = rgb + (y2 - y)[:, None]
    # сплит-тон: света теплее, тени чуть холоднее (едва заметно)
    hi = np.clip((y - 0.55) / 0.45, 0, 1)[:, None]; lo = np.clip((0.4 - y) / 0.4, 0, 1)[:, None]
    out = out + hi * np.array([0.010, 0.004, -0.010]) + lo * np.array([-0.004, 0.0, 0.006])   # рецензия v12: мягче, кожа не краснеет
    # насыщенность +10%, но тон кожи (оранжевый сектор) почти не трогаем
    yo = out @ np.array([0.2126, 0.7152, 0.0722])
    r, gg, bb = out[:, 0], out[:, 1], out[:, 2]
    hue = (np.degrees(np.arctan2(np.sqrt(3) * (gg - bb), 2 * r - gg - bb)) + 360) % 360
    skin = np.exp(-((hue - 15) / 28) ** 2)                      # кожа ~ 0–45° (контровой свет уводит её в красное)
    s_in = (out.max(1) - out.min(1)) / np.maximum(out.max(1), 1e-3)
    sat = 1 + 0.10 * np.clip(1 - s_in / 0.6, 0, 1) - 0.08 * skin   # +10% только бледным цветам: яркое (двигатель, дроны) не «горит»
    out = yo[:, None] + (out - yo[:, None]) * sat[:, None]
    out = np.clip(out, 0, 1)
    with open(path, "w") as f:
        f.write(f'TITLE "MeTravel travel look"\nLUT_3D_SIZE {n}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        for row in out:
            f.write(f"{row[0]:.6f} {row[1]:.6f} {row[2]:.6f}\n")


# ---------- замеры ----------
def frame(path, t):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, t):.3f}", "-i", path, "-frames:v", "1",
                        "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       capture_output=True, timeout=120)
    if len(r.stdout) < W * H * 3: return None
    return np.frombuffer(r.stdout[:W * H * 3], np.uint8).reshape(H, W, 3).astype(np.float32) / 255


def stats(path, t0, t1):
    key = hashlib.md5(f"{path}|{t0:.2f}|{t1:.2f}".encode()).hexdigest()
    if key in cache: return cache[key]
    fr = [frame(path, t0 + (t1 - t0) * k) for k in (0.2, 0.5, 0.8)]
    fr = [f for f in fr if f is not None]
    if not fr: return None   # сбой не кешируется: при следующем запуске план перемеряется
    px = np.concatenate([f.reshape(-1, 3) for f in fr])
    y = px @ np.array([0.2126, 0.7152, 0.0722])
    mx, mn = px.max(1), px.min(1)
    sat = (mx - mn) / np.maximum(mx, 1e-3)
    neut = (sat < 0.18) & (y > 0.2) & (y < 0.85)                # почти серые пиксели средней яркости
    rgbn = px[neut].mean(0) if neut.sum() > 500 else None
    res = {"p1": float(np.percentile(y, 1)), "p50": float(np.percentile(y, 50)), "p99": float(np.percentile(y, 99)),
           "sat": float(np.mean(sat[(y > 0.1) & (y < 0.95)])) if ((y > 0.1) & (y < 0.95)).any() else 0.0,
           "neutral": None if rgbn is None else [float(x) for x in rgbn], "nfrac": float(neut.mean())}
    cache[key] = res
    return res


def skip(path):
    return any(f"/{d}/" in path for d in SKIP) or not path.lower().endswith((".mp4", ".mov", ".m4v", ".mts"))


# ---------- поправка плана ----------
def correction(st, film, target=None, gl=(0.85, 1.18)):
    """Цепочка фильтров ffmpeg: уровни → баланс белого → гамма → насыщенность. Все поправки ограничены."""
    k = STRENGTH
    f = []
    # уровни: растягиваем только сжатый диапазон (дымка, S-Cinetone), не больше чем ×1.25; ночь и низкий ключ не трогаем
    lo, hi = st["p1"], st["p99"]
    tlo, thi = 0.03, 0.95
    if hi - lo > 0.25:
        nlo = lo - (lo - tlo) * 0.6 * k if lo > tlo else lo
        nhi = hi + (thi - hi) * 0.5 * k if hi < thi else hi
        scale = (nhi - nlo) / (hi - lo)
        if scale > 1.25: c = (nhi + nlo) / 2; half = (hi - lo) * 1.25 / 2; nlo, nhi = c - half, c + half
        if abs(nlo - lo) > 0.01 or abs(nhi - hi) > 0.01:
            # линейное отображение lo→nlo, hi→nhi одной кривой на все каналы; края 0 и 1 — продолжение прямой
            sc = (nhi - nlo) / (hi - lo)
            pts = [(0.0, nlo - lo * sc), (lo, nlo), (hi, nhi), (1.0, nhi + (1 - hi) * sc)]
            pts = [(x, min(1.0, max(0.0, y))) for x, y in pts if 0 <= x <= 1]
            pts = [p for j, p in enumerate(pts) if j == 0 or p[0] - pts[j - 1][0] > 0.005]
            f.append("curves=all='" + " ".join(f"{x:.3f}/{y:.3f}" for x, y in pts) + "'")
    # баланс белого: половина пути к нейтрали, не больше ±7% по каналу (закат и золотой час остаются тёплыми)
    if st.get("neutral") and st["nfrac"] > 0.02:
        r, g, b = st["neutral"]
        gr = 1 + np.clip((g / max(r, 1e-3) - 1) * 0.5 * k, -0.07, 0.07)
        gb = 1 + np.clip((g / max(b, 1e-3) - 1) * 0.5 * k, -0.07, 0.07)
        if abs(gr - 1) > 0.01 or abs(gb - 1) > 0.01:
            f.append(f"colorchannelmixer=rr={gr:.3f}:gg=1:bb={gb:.3f}")
    # экспозиция: медиана к медиане фильма, на треть пути, гамма в пределах 0.85–1.18
    if 0.05 < st["p50"] < 0.95:
        if target is None: target = st["p50"] + (film["p50"] - st["p50"]) * 0.35 * k
        gamma = float(np.clip(np.log(max(target, 1e-3)) / np.log(st["p50"]), *gl))
        if abs(gamma - 1) > 0.02: f.append(f"eq=gamma={1 / gamma:.3f}")
    # насыщенность: к медиане фильма на 40% пути, 0.88–1.2
    if st["sat"] > 0.02:
        s = float(np.clip(1 + (film["sat"] / st["sat"] - 1) * 0.4 * k, 0.80, 1.12))   # рецензия v12: 1.2 перенасыщал дроны
        if abs(s - 1) > 0.02: f.append(f"eq=saturation={s:.3f}")
    return f


def shots():
    """Все куски плана с камерным материалом: (объект плана, путь, вход, выход)."""
    out = []
    for s in plan["segments"]:
        p = plan["sources"][s["src"]]
        if not skip(p): out.append((s, p, s["in"], s["out"], s.get("note", "")))
        for o in s.get("broll", []):
            if o.get("file") and not skip(o["file"]):
                t0 = float(o.get("in", 0)); out.append((o, o["file"], t0, t0 + float(o["dur"]), s.get("note", "")))
    return out


MINIMAL = "--minimal" in a          # владелец 16.11: лук «не те цвета, хуже непокрашенного» — по умолчанию для GR21 только яркость
if not MINIMAL: make_look(look_path)
L = shots()
print(f"кусков для покраски: {len(L)}", flush=True)
S = []                                   # один замер на план за запуск: сбой не повторяется вторым проходом
for i, (obj, p, t0, t1, _) in enumerate(L):
    S.append(stats(p, t0, t1))
    if i % 20 == 19:
        json.dump(cache, open(cache_path, "w")); print(f"  замерено {i + 1}", flush=True)
json.dump(cache, open(cache_path, "w"))
ok = [x for x in S if x]
if not ok: print("ни одного замера: планы получают только лук")
film = ({"p50": float(np.median([x["p50"] for x in ok])), "sat": float(np.median([x["sat"] for x in ok]))} if ok
        else {"p50": 0.45, "sat": 0.3})   # без замеров поправки не считаются; цель только для отчёта, без NaN в JSON
print(f"цель фильма: медиана яркости {film['p50']:.2f}, насыщенность {film['sat']:.2f}")
failed = sum(1 for x in S if not x)
if failed: print(f"не удалось замерить {failed} планов: у них только лук, перезапусти grade.py (кеш удачных замеров сохранён)")
n = 0
# соседние планы одной сцены с разных камер (Pocket ↔ ZV-E1 ↔ iPhone ↔ дрон) тянутся к среднему пары, а не к медиане фильма:
# рецензия v12 — 10 скачков яркости на стыках камер (порог рубрики 3)
ALIAS = json.load(open(opt("--alias"))) if opt("--alias") else {}
def cam(p):
    p = ALIAS.get(p, [p])[0]
    for k_, v_ in (("/pocket/", "pocket"), ("/zv-e1/", "zv-e1"), ("/телефон/", "iphone"), ("Медиатека", "iphone"), ("/drone/", "drone"), ("/ДРОН/", "drone")):
        if k_ in p: return v_
    return None
scene = lambda n: n.split(".")[0].strip() if "." in n[:4] else n[:12]
TG = {}
for k_ in range(len(L) - 1):
    a_, b_ = S[k_], S[k_ + 1]
    ca, cb = cam(L[k_][1]), cam(L[k_ + 1][1])
    if not (a_ and b_ and ca and cb) or ca == cb or scene(L[k_][4]) != scene(L[k_ + 1][4]) or abs(a_["p50"] - b_["p50"]) < 0.12:
        continue
    m_ = (a_["p50"] + b_["p50"]) / 2
    st_ = 0.75 if abs(a_["p50"] - b_["p50"]) > 0.18 else 0.6     # v13: резкий перепад (лес ↔ солнечное поле) тянем сильнее
    TG.setdefault(k_, []).append(a_["p50"] + (m_ - a_["p50"]) * st_ * STRENGTH)
    TG.setdefault(k_ + 1, []).append(b_["p50"] + (m_ - b_["p50"]) * st_ * STRENGTH)
print(f"выравнивание камер на стыках: планов {len(TG)}")
for k_, ((obj, p, _, _, _), st) in enumerate(zip(L, S)):
    if obj.get("grade_manual"):   # ручная покраска плана: ключ "grade" оставляем как есть
        continue
    if MINIMAL:
        # только яркость на стыках разных камер (eq=gamma — по яркости, оттенок и баланс белого не трогаются);
        # ручные поправки — тоже только их gamma; без лука, уровней, баланса белого и насыщенности
        ch = []
        if st and k_ in TG and 0.05 < st["p50"] < 0.95:
            g_ = float(np.clip(np.log(max(float(np.mean(TG[k_])), 1e-3)) / np.log(st["p50"]), 0.85, 1.2))
            if g_ < 0.97: ch.append(f"eq=gamma={1 / g_:.3f}")   # только осветлить тёмный план до соседа; затемнять — нет (владелец: «хуже исходника»)
        ch += [x for x in (obj.get("grade_extra") or "").split(",") if x.startswith("eq=gamma=")]
        if ch: obj["grade"] = ",".join(ch); n += 1
        else: obj.pop("grade", None)
        continue
    chain = (correction(st, film, float(np.mean(TG[k_])), (0.70, 1.32)) if k_ in TG else correction(st, film)) if st else []
    if obj.get("grade_extra"): chain.append(obj["grade_extra"])   # точечная ручная поправка плана (рецензент: «gamma 1.4 на перебивке»)
    chain.append(f"lut3d=file='{look_path}':interp=tetrahedral")
    obj["grade"] = ",".join(chain); n += 1
plan.setdefault("grade", {})["look"] = None if MINIMAL else look_path
plan["grade"]["mode"] = "minimal" if MINIMAL else "look"
plan["grade"]["film"] = film
json.dump(plan, open(dst_plan, "w"), ensure_ascii=False, indent=1)
print(f"готово: {dst_plan}, планов с покраской {n}, " + ("режим: только яркость" if MINIMAL else f"лук {look_path}"))
