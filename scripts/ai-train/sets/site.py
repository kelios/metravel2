"""Set `site`: samples from the metravel.by corpus exported by export_corpus.py
(<AI_HOME>/data/raw/{travels,quests}.jsonl).

Two families of samples:

* knowledge: article sections and quest stories reproduced verbatim under a
  "show me section N of article X" prompt, which is how the corpus itself gets
  into the weights (continued pre-training in chat form);
* behaviour: templated questions a visitor asks (what is there about a
  country, where to go in a month, tell me about an article or quest, pros and
  cons, how long a quest takes, negatives for places the site does not cover),
  always answered with links to metravel.by pages and never with facts outside
  the corpus; plus direct title → URL recall samples for every article and quest.

Options (mixes/*.yaml → sets.site.options):
  chunk_chars   — max characters of an article section sample (default 4200;
                  2600 fits seq 1024);
  legacy_texts  — v0/v1 wording, kept for the v1 regression mix: "мы ездили"
                  also for guest articles (v2: neutral wording);
  structured    — two structured kinds (v2): route points of an article → JSON
                  and a route card (days, months, transport, overnight stay,
                  distances, heights) from an article fragment; needs the
                  filter dictionaries cached by sources/site_filters.py.

Record order and random draws are those of the v1 build_dataset.py: the v1 mix
reproduces the v1 dataset bit for bit.
"""
from __future__ import annotations

import html
import json
import random
import re
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path

from sets.common import SITE, record

NAME = "site"
LICENSE = "metravel.by own content"

MONTH_PREP = {
    1: "январе", 2: "феврале", 3: "марте", 4: "апреле", 5: "мае", 6: "июне", 7: "июле",
    8: "августе", 9: "сентябре", 10: "октябре", 11: "ноябре", 12: "декабре",
}
MONTH_NOM = {
    1: "январь", 2: "февраль", 3: "март", 4: "апрель", 5: "май", 6: "июнь", 7: "июль",
    8: "август", 9: "сентябрь", 10: "октябрь", 11: "ноябрь", 12: "декабрь",
}
DIFFICULTY = {"easy": "лёгкий", "medium": "средний", "hard": "сложный"}
NEGATIVE_PLACES = [
    "Исландия", "Япония", "Новая Зеландия", "Мальдивы", "Аргентина", "Чили", "Перу", "Мексика",
    "Вьетнам", "Таиланд", "Бали", "Шри-Ланка", "Непал", "Австралия", "Канада", "Куба", "Марокко",
    "Египет", "Танзания", "Кения", "ЮАР", "Сейшелы", "Доминикана", "Бразилия", "Китай", "Корея",
    "Сингапур", "Филиппины", "Гавайи", "Аляска", "Антарктида", "Монголия", "Казахстан", "Узбекистан",
    "Шотландия", "Ирландия", "Норвегия", "Швеция", "Финляндия", "Дания",
]
CHUNK_CHARS = 4200
MAX_LIST = 8
POINTS_PER_SAMPLE = 12      # ≈ 100 characters per point: 12 points stay far below seq 1024
ROUTE_EXCERPT_CHARS = 1800  # fragment + JSON answer + system prompt within seq 1024
NUMBER = r"(?<![\d.,])(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)"  # thousands: space, nbsp, narrow nbsp
KM_RE = re.compile(NUMBER + r"(?:[.,](\d+))?\s?км\b(?!\s?/\s?ч)")  # not speeds (км/ч)
HEIGHT_RE = re.compile(
    r"(?:высот\w*|набор\w*)\D{0,25}?" + NUMBER + r"\s?(?:м|метр\w*)\b"
    r"|" + NUMBER + r"\s?(?:м|метр\w*)\s(?:над уровнем|набора|высоты)",
    re.I,
)


class TextExtractor(HTMLParser):
    BLOCK = {"p", "div", "br", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "table", "blockquote", "section", "article", "figure", "figcaption", "details", "summary"}
    SKIP = {"script", "style", "noscript", "iframe", "svg"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        elif tag in self.BLOCK:
            self.parts.append("\n")
        if tag == "li":
            self.parts.append("- ")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def html_to_text(raw: str | None) -> str:
    if not raw:
        return ""
    p = TextExtractor()
    p.feed(html.unescape(raw) if "&" in raw and "<" not in raw else raw)
    text = "".join(p.parts)
    text = re.sub(r"[ \t\u00a0]+", " ", text)  # \u00a0: non-breaking space
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def chunk(text: str, size: int) -> list[str]:
    out, cur = [], ""
    for p in paragraphs(text):
        if cur and len(cur) + len(p) + 2 > size:
            out.append(cur)
            cur = p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        out.append(cur)
    return out


def bullets(raw_html: str | None, limit: int = 8) -> list[str]:
    text = html_to_text(raw_html)
    items = [ln.lstrip("- ").strip() for ln in text.split("\n") if ln.strip()]
    return items[:limit]


def article_url(t: dict) -> str:
    return f"{SITE}/travels/{t['slug']}"


def article_facts(t: dict) -> str:
    parts = []
    if t.get("countryName"):
        parts.append(f"Страна: {t['countryName']}")
    if t.get("monthName") or t.get("year"):
        when = " ".join(str(x) for x in (t.get("monthName"), t.get("year")) if x)
        parts.append(f"Когда: {when}")
    if t.get("number_days"):
        parts.append(f"Длительность: {t['number_days']} дн.")
    places = [a.get("address") for a in (t.get("travelAddress") or []) if a.get("address")]
    if places:
        parts.append("Точки маршрута: " + "; ".join(places[:6]) + (" и другие" if len(places) > 6 else ""))
    return "\n".join(parts)


def article_line(t: dict) -> str:
    extra = []
    if t.get("number_days"):
        extra.append(f"{t['number_days']} дн.")
    if t.get("monthName"):
        extra.append(t["monthName"].split(",")[0].lower())
    tail = f" ({', '.join(extra)})" if extra else ""
    return f"- {t['title']}{tail} — {article_url(t)}"


def quest_line(q: dict) -> str:
    bits = []
    if q.get("duration_min"):
        bits.append(f"около {q['duration_min']} мин")
    if q.get("difficulty") in DIFFICULTY:
        bits.append(DIFFICULTY[q["difficulty"]])
    tail = f" ({', '.join(bits)})" if bits else ""
    return f"- {q['title']}{tail} — {q['url']}"


def list_answer(intro: str, lines: list[str], rng: random.Random, total: int) -> str:
    chosen = lines if len(lines) <= MAX_LIST else rng.sample(lines, MAX_LIST)
    more = f"\n\nВсего таких материалов на сайте: {total}." if total > len(chosen) else ""
    return f"{intro}\n" + "\n".join(chosen) + more


def _number(whole: str, frac: str | None = None) -> int | float:
    n = int(re.sub(r"\D", "", whole))
    return float(f"{n}.{frac}") if frac and frac.strip("0") else n


def distances_km(text: str, limit: int = 8) -> list[int | float]:
    seen: list[int | float] = []
    for m in KM_RE.finditer(text):
        v = _number(m.group(1), m.group(2))
        if v and v not in seen:
            seen.append(v)
    return seen[:limit]


def heights_m(text: str, limit: int = 6) -> list[int]:
    seen: list[int] = []
    for m in HEIGHT_RE.finditer(text):
        v = _number(m.group(1) or m.group(2))
        if v and v not in seen:
            seen.append(v)
    return seen[:limit]


def route_points(t: dict) -> list[dict]:
    pts = []
    for a in t.get("travelAddress") or []:
        try:
            lat, lng = (round(float(x), 5) for x in str(a.get("coord") or "").split(","))
        except ValueError:
            continue
        if a.get("address"):
            pts.append({"name": a["address"], "lat": lat, "lng": lng, "category": a.get("categoryName") or None})
    return pts


def names(ids, dictionary: dict[int, str]) -> list[str]:
    out: list[str] = []
    for i in ids or []:
        name = dictionary.get(int(i)) if str(i).isdigit() else None
        if name and name not in out:
            out.append(name)
    return out


def structured_samples(t: dict, body: str, chunk_chars: int, filters: dict[str, dict[int, str]], rec) -> list[dict]:
    title, url, out = t["title"], article_url(t), []
    pts = route_points(t)
    for start in range(0, len(pts), POINTS_PER_SAMPLE):
        page = pts[start:start + POINTS_PER_SAMPLE]
        user = (f"Перечисли точки маршрута статьи «{title}» в JSON: название, координаты, категория."
                if start == 0 else f"Продолжи список точек маршрута статьи «{title}» с точки {start + 1}.")
        answer = {"article": url, "points": page}
        if start + POINTS_PER_SAMPLE < len(pts):
            answer["more"] = len(pts) - start - POINTS_PER_SAMPLE
        out.append(rec(user, json.dumps(answer, ensure_ascii=False), "article_route_points", f"travel:{t['id']}", f"t{t['id']}p{start // POINTS_PER_SAMPLE}"))
    parts = chunk(body, min(chunk_chars, ROUTE_EXCERPT_CHARS))
    if not parts:
        return out
    excerpt = max(parts, key=lambda p: len(distances_km(p)))  # first fragment on a tie
    card = {
        "article": url,
        "days": int(t["number_days"]) if t.get("number_days") else None,
        "months": [MONTH_NOM[m] for m in t.get("month") or [] if isinstance(m, int) and m in MONTH_NOM],
        "transport": names(t.get("transports"), filters["transports"]),
        "overnight": names(t.get("over_nights_stay"), filters["over_nights_stay"]),
        "distances_km": distances_km(excerpt),
        "heights_m": heights_m(excerpt),
    }
    if card["days"] or card["transport"] or card["distances_km"]:
        user = (f"Составь карточку маршрута статьи «{title}» в JSON: дни, месяцы, транспорт, ночёвка, "
                f"расстояния (км) и высоты (м), упомянутые во фрагменте.\n\nФрагмент:\n{excerpt}")
        out.append(rec(user, json.dumps(card, ensure_ascii=False), "article_route_card", f"travel:{t['id']}", f"t{t['id']}rc"))
    return out


def load_raw(raw: Path) -> tuple[list[dict], list[dict]]:
    travels = [json.loads(l) for l in (raw / "travels.jsonl").open(encoding="utf-8")]
    quests = [json.loads(l) for l in (raw / "quests.jsonl").open(encoding="utf-8")] if (raw / "quests.jsonl").exists() else []
    return travels, quests


def build(ctx: dict, options: dict) -> list[dict]:
    raw: Path = ctx["raw"]
    seed: int = ctx["seed"]
    chunk_chars = int(options.get("chunk_chars", CHUNK_CHARS))
    legacy = bool(options.get("legacy_texts", False))
    filters = None
    if options.get("structured"):
        from sources.site_filters import load_filters

        filters = load_filters(ctx["sources"])
        if filters is None:
            raise SystemExit("site.structured needs the filter dictionaries: run sources/site_filters.py first")

    def rec(user: str, assistant: str, kind: str, key: str, id: str) -> dict:
        return record(user, assistant, set_name=NAME, license=LICENSE, kind=kind, key=key, id=id)

    rng = random.Random(seed)
    travels, quests = load_raw(raw)
    quests_ru = [q for q in quests if (q.get("content_locale") or "ru") == "ru"]
    out: list[dict] = []

    # --- articles: card, sections, pros/cons/tips
    for t in travels:
        title, url, key = t["title"], article_url(t), f"travel:{t['id']}"
        body = html_to_text(t.get("description"))
        paras = paragraphs(body)
        lead = (t.get("meta_description") or (paras[0] if paras else "")).strip()
        if len(lead) > 700:
            lead = lead[:700].rsplit(" ", 1)[0] + "…"
        facts = article_facts(t)
        card = f"{lead}\n\n{facts}\n\nПодробнее: {url}" if facts else f"{lead}\n\nПодробнее: {url}"
        for i, user in enumerate((f"Расскажи о статье «{title}».", f"Что на metravel.by написано про «{title}»?", f"О чём статья «{title}»?")):
            out.append(rec(user, card, "article_card", key, f"t{t['id']}c{i}"))
        for n, part in enumerate(chunk(body, chunk_chars), start=1):
            user = f"Приведи часть {n} статьи «{title}» с metravel.by." if n > 1 else f"Приведи начало статьи «{title}» с metravel.by."
            out.append(rec(user, f"{part}\n\nИсточник: {url}", "article_section", key, f"t{t['id']}s{n}"))
        # Direct URL recall: v0 reproduced the answer format but invented slugs.
        out.append(rec(f"Дай ссылку на статью «{title}».", f"{title} — {url}", "article_link", key, f"t{t['id']}l0"))
        out.append(rec(f"Какой адрес у статьи «{title}» на metravel.by?", f"Статья «{title}»: {url}", "article_link", key, f"t{t['id']}l1"))
        plus, minus, tips = bullets(t.get("plus")), bullets(t.get("minus")), bullets(t.get("recommendation"))
        if plus or minus:
            ans = []
            if plus:
                ans.append("Плюсы:\n" + "\n".join(f"- {x}" for x in plus))
            if minus:
                ans.append("Минусы:\n" + "\n".join(f"- {x}" for x in minus))
            out.append(rec(f"Какие плюсы и минусы у поездки «{title}»?", "\n\n".join(ans) + f"\n\nСтатья: {url}", "article_pros_cons", key, f"t{t['id']}pm"))
        if tips:
            out.append(rec(f"Какие советы даёт metravel.by по поездке «{title}»?", "Советы из статьи:\n" + "\n".join(f"- {x}" for x in tips) + f"\n\nСтатья: {url}", "article_tips", key, f"t{t['id']}r"))

    # --- articles grouped by country / month / days
    by_country: dict[str, list[dict]] = defaultdict(list)
    by_country_month: dict[tuple[str, int], list[dict]] = defaultdict(list)
    by_country_days: dict[tuple[str, int], list[dict]] = defaultdict(list)
    for t in travels:
        c = t.get("countryName")
        if not c:
            continue
        by_country[c].append(t)
        for m in t.get("month") or []:
            if isinstance(m, int) and m in MONTH_PREP:
                by_country_month[(c, m)].append(t)
        if t.get("number_days"):
            by_country_days[(c, int(t["number_days"]))].append(t)
    for c, items in by_country.items():
        lines = [article_line(t) for t in items]
        for i, user in enumerate((f"Что есть на metravel.by про {c}?", f"Куда поехать в страну {c}? Что советует metravel.by?", f"Какие статьи про {c} есть на сайте?")):
            out.append(rec(user, list_answer(f"На metravel.by про {c} есть {len(items)} материал(ов). Вот что стоит посмотреть:", lines, rng, len(items)), "country_list", f"country:{c}", f"c{c}{i}"))
    for (c, m), items in by_country_month.items():
        lines = [article_line(t) for t in items]
        # Guest articles are not our trips: "мы ездили" only in the v1 regression wording.
        intro = f"В {MONTH_PREP[m]} мы ездили по стране {c} вот куда:" if legacy else f"Поездки по стране {c} в {MONTH_PREP[m]} на metravel.by:"
        out.append(rec(f"Куда поехать в {MONTH_PREP[m]}, если я в стране {c}?", list_answer(intro, lines, rng, len(items)), "country_month", f"country:{c}", f"cm{c}{m}"))
    for (c, d), items in by_country_days.items():
        lines = [article_line(t) for t in items]
        out.append(rec(f"Есть ли на metravel.by маршрут по стране {c} на {d} дн.?", list_answer(f"Да, на {d} дн. по стране {c} у нас есть:", lines, rng, len(items)), "country_days", f"country:{c}", f"cd{c}{d}"))

    # --- quests
    by_city: dict[str, list[dict]] = defaultdict(list)
    by_qcountry: dict[str, list[dict]] = defaultdict(list)
    for q in quests_ru:
        if q.get("city_name"):
            by_city[q["city_name"]].append(q)
        if q.get("country_name"):
            by_qcountry[q["country_name"]].append(q)
        title, url, key = q["title"], q["url"], f"quest:{q['id']}"
        intro = (q.get("intro") or {}).get("story") or ""
        steps = q.get("steps") or []
        bits = []
        if q.get("duration_min"):
            bits.append(f"занимает около {q['duration_min']} минут")
        if q.get("difficulty") in DIFFICULTY:
            bits.append(f"уровень — {DIFFICULTY[q['difficulty']]}")
        if steps:
            bits.append(f"{len(steps)} точек")
        meta = f"Квест проходит в городе {q.get('city_name')}" + (", " + ", ".join(bits) if bits else "") + "."
        card = f"{intro}\n\n{meta}\n\nНачать: {url}" if intro else f"{meta}\n\nНачать: {url}"
        for i, user in enumerate((f"Расскажи о квесте «{title}».", f"Что за квест «{title}» на metravel.by?")):
            out.append(rec(user, card, "quest_card", key, f"q{q['id']}c{i}"))
        out.append(rec(f"Дай ссылку на квест «{title}».", f"{title} ({q.get('city_name')}) — {url}", "quest_link", key, f"q{q['id']}l0"))
        out.append(rec(f"Какой адрес у квеста «{title}» на metravel.by?", f"Квест «{title}»: {url}", "quest_link", key, f"q{q['id']}l1"))
        if q.get("duration_min"):
            out.append(rec(f"Сколько времени занимает квест «{title}»?", f"Около {q['duration_min']} минут" + (f", уровень — {DIFFICULTY[q['difficulty']]}" if q.get("difficulty") in DIFFICULTY else "") + f". Квест: {url}", "quest_duration", key, f"q{q['id']}d"))
        stories = [s for s in steps if s.get("story")]
        for n, s in enumerate(stories, start=1):
            loc = f" ({s['location']})" if s.get("location") else ""
            text = f"{s.get('title') or 'Точка ' + str(n)}{loc}\n\n{s['story']}"
            out.append(rec(f"Что рассказывает точка {n} квеста «{title}»?", f"{text}\n\nКвест: {url}", "quest_step", key, f"q{q['id']}s{n}"))
        if q.get("finale_text"):
            out.append(rec(f"Чем заканчивается квест «{title}»?", f"{q['finale_text']}\n\nКвест: {url}", "quest_finale", key, f"q{q['id']}f"))
    for city, items in by_city.items():
        lines = [quest_line(q) for q in items]
        for i, user in enumerate((f"Какие квесты есть в городе {city}?", f"Есть ли на metravel.by квест по городу {city}?")):
            out.append(rec(user, list_answer(f"В городе {city} на metravel.by {len(items)} квест(ов):", lines, rng, len(items)), "quest_city", f"city:{city}", f"qc{city}{i}"))
    for c, items in by_qcountry.items():
        lines = [quest_line(q) for q in items]
        out.append(rec(f"Какие квесты есть в стране {c}?", list_answer(f"В стране {c} у нас {len(items)} квест(ов). Например:", lines, rng, len(items)), "quest_country", f"country:{c}", f"qk{c}"))
    if quests_ru:
        cities = sorted(by_city, key=lambda k: -len(by_city[k]))
        summary = ", ".join(f"{c} ({len(by_city[c])})" for c in cities[:12])
        out.append(rec("Что за квесты на metravel.by?", f"Это городские квесты-прогулки: идёшь по точкам, читаешь историю места, выполняешь задание на месте и открываешь следующий шаг. Всего {len(quests_ru)} квестов; больше всего в городах: {summary}. Каталог: {SITE}/quests", "quest_about", "about", "qabout"))

    # --- negatives: places absent from the corpus
    # Articles and quests alike: a quest in Japan means "no material about Japan" is false.
    haystack = " ".join(
        [t["title"] + " " + (t.get("countryName") or "") for t in travels]
        + [q["title"] + " " + (q.get("city_name") or "") + " " + (q.get("country_name") or "") for q in quests_ru]
    ).lower()
    fallback = [article_line(t) for t in travels]
    for place in NEGATIVE_PLACES:
        if place.lower() in haystack:
            continue
        near = "\n".join(rng.sample(fallback, min(3, len(fallback))))
        for i, user in enumerate((f"Есть ли на metravel.by что-нибудь про {place}?", f"Посоветуй маршрут по направлению {place}.")):
            out.append(rec(user, f"На metravel.by пока нет материалов про {place}. Из того, что есть, могу предложить:\n{near}", "negative", f"negative:{place}", f"n{place}{i}"))

    # --- about the site
    out.append(rec("Кто ведёт metravel.by?", f"metravel.by ведут Юля и Сергей: статьи о собственных поездках, прежде всего по Польше и Беларуси, и авторские городские квесты. Статьи: {SITE}/travels, квесты: {SITE}/quests", "about", "about", "about0"))
    out.append(rec("Можешь посоветовать что-то не с вашего сайта?", f"Я отвечаю только по материалам metravel.by, чужие источники не пересказываю. Скажи страну, город или месяц — подберу из наших статей и квестов. Каталог: {SITE}/travels", "about", "about", "about1"))

    # --- structured tasks (v2); appended last and without random draws, so the
    # samples above stay identical to v1
    if filters is not None:
        for t in travels:
            out.extend(structured_samples(t, html_to_text(t.get("description")), chunk_chars, filters, rec))
    return out


def source_info(ctx: dict) -> dict:
    manifest = ctx["raw"] / "manifest.json"
    info = {"raw": str(ctx["raw"]), "export": json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else None}
    from sources.common import read_meta

    info["filters"] = read_meta(ctx["sources"] / "site_filters")
    return info
