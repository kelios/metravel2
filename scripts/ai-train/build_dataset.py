#!/usr/bin/env python3
"""Build the supervised fine-tuning dataset for the metravel.by assistant model
from the exported corpus (see export_corpus.py).

Usage:
    python3 -I scripts/ai-train/build_dataset.py \
        --raw /Volumes/metravel-ai/data/raw --out /Volumes/metravel-ai/data/sft

Every record is a chat sample {"messages": [system, user, assistant]} in the
format mlx-lm LoRA expects. Two families of samples are produced:

* knowledge: article sections and quest stories reproduced verbatim under a
  "show me section N of article X" prompt, which is how the corpus itself gets
  into the weights (continued pre-training in chat form);
* behaviour: templated questions a visitor asks (what is there about a
  country, where to go in a month, tell me about an article or quest, pros and
  cons, how long a quest takes, negatives for places the site does not cover),
  always answered with links to metravel.by pages and never with facts outside
  the corpus.

Output: <out>/train.jsonl, valid.jsonl, test.jsonl and stats.json.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import random
import re
import sys
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path

SITE = "https://metravel.by"
SYSTEM = (
    "Ты — помощник сайта metravel.by. Отвечай кратко, по-дружески и только по материалам сайта: "
    "статьям Юли и Сергея о путешествиях и городским квестам. К каждой рекомендации давай ссылку "
    "на страницу metravel.by. Если на сайте нет материала по вопросу — честно скажи об этом и "
    "предложи ближайшее из того, что есть. Не выдумывай факты и не ссылайся на другие сайты."
)
MONTH_PREP = {
    1: "январе", 2: "феврале", 3: "марте", 4: "апреле", 5: "мае", 6: "июне", 7: "июле",
    8: "августе", 9: "сентябре", 10: "октябре", 11: "ноябре", 12: "декабре",
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
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def chunk(text: str, size: int | None = None) -> list[str]:
    size = size or CHUNK_CHARS
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


def sample(system: str, user: str, assistant: str, kind: str, key: str) -> dict:
    return {"messages": [{"role": "system", "content": system}, {"role": "user", "content": user}, {"role": "assistant", "content": assistant}], "kind": kind, "key": key}


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


def build(raw: Path, seed: int) -> list[dict]:
    rng = random.Random(seed)
    travels = [json.loads(l) for l in (raw / "travels.jsonl").open(encoding="utf-8")]
    quests = [json.loads(l) for l in (raw / "quests.jsonl").open(encoding="utf-8")] if (raw / "quests.jsonl").exists() else []
    quests_ru = [q for q in quests if (q.get("content_locale") or "ru") == "ru"]
    out: list[dict] = []

    # --- articles: card, sections, pros/cons/tips
    for t in travels:
        title, url = t["title"], article_url(t)
        body = html_to_text(t.get("description"))
        paras = paragraphs(body)
        lead = (t.get("meta_description") or (paras[0] if paras else "")).strip()
        if len(lead) > 700:
            lead = lead[:700].rsplit(" ", 1)[0] + "…"
        facts = article_facts(t)
        card = f"{lead}\n\n{facts}\n\nПодробнее: {url}" if facts else f"{lead}\n\nПодробнее: {url}"
        for i, user in enumerate((f"Расскажи о статье «{title}».", f"Что на metravel.by написано про «{title}»?", f"О чём статья «{title}»?")):
            out.append(sample(SYSTEM, user, card, "article_card", f"t{t['id']}c{i}"))
        for n, part in enumerate(chunk(body), start=1):
            user = f"Приведи часть {n} статьи «{title}» с metravel.by." if n > 1 else f"Приведи начало статьи «{title}» с metravel.by."
            out.append(sample(SYSTEM, user, f"{part}\n\nИсточник: {url}", "article_section", f"t{t['id']}s{n}"))
        plus, minus, rec = bullets(t.get("plus")), bullets(t.get("minus")), bullets(t.get("recommendation"))
        if plus or minus:
            ans = []
            if plus:
                ans.append("Плюсы:\n" + "\n".join(f"- {x}" for x in plus))
            if minus:
                ans.append("Минусы:\n" + "\n".join(f"- {x}" for x in minus))
            out.append(sample(SYSTEM, f"Какие плюсы и минусы у поездки «{title}»?", "\n\n".join(ans) + f"\n\nСтатья: {url}", "article_pros_cons", f"t{t['id']}pm"))
        if rec:
            out.append(sample(SYSTEM, f"Какие советы даёт metravel.by по поездке «{title}»?", "Советы из статьи:\n" + "\n".join(f"- {x}" for x in rec) + f"\n\nСтатья: {url}", "article_tips", f"t{t['id']}r"))

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
            out.append(sample(SYSTEM, user, list_answer(f"На metravel.by про {c} есть {len(items)} материал(ов). Вот что стоит посмотреть:", lines, rng, len(items)), "country_list", f"c{c}{i}"))
    for (c, m), items in by_country_month.items():
        lines = [article_line(t) for t in items]
        out.append(sample(SYSTEM, f"Куда поехать в {MONTH_PREP[m]}, если я в стране {c}?", list_answer(f"В {MONTH_PREP[m]} мы ездили по стране {c} вот куда:", lines, rng, len(items)), "country_month", f"cm{c}{m}"))
    for (c, d), items in by_country_days.items():
        lines = [article_line(t) for t in items]
        out.append(sample(SYSTEM, f"Есть ли на metravel.by маршрут по стране {c} на {d} дн.?", list_answer(f"Да, на {d} дн. по стране {c} у нас есть:", lines, rng, len(items)), "country_days", f"cd{c}{d}"))

    # --- quests
    by_city: dict[str, list[dict]] = defaultdict(list)
    by_qcountry: dict[str, list[dict]] = defaultdict(list)
    for q in quests_ru:
        if q.get("city_name"):
            by_city[q["city_name"]].append(q)
        if q.get("country_name"):
            by_qcountry[q["country_name"]].append(q)
        title, url = q["title"], q["url"]
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
            out.append(sample(SYSTEM, user, card, "quest_card", f"q{q['id']}c{i}"))
        if q.get("duration_min"):
            out.append(sample(SYSTEM, f"Сколько времени занимает квест «{title}»?", f"Около {q['duration_min']} минут" + (f", уровень — {DIFFICULTY[q['difficulty']]}" if q.get("difficulty") in DIFFICULTY else "") + f". Квест: {url}", "quest_duration", f"q{q['id']}d"))
        stories = [s for s in steps if s.get("story")]
        for n, s in enumerate(stories, start=1):
            loc = f" ({s['location']})" if s.get("location") else ""
            text = f"{s.get('title') or 'Точка ' + str(n)}{loc}\n\n{s['story']}"
            out.append(sample(SYSTEM, f"Что рассказывает точка {n} квеста «{title}»?", f"{text}\n\nКвест: {url}", "quest_step", f"q{q['id']}s{n}"))
        if q.get("finale_text"):
            out.append(sample(SYSTEM, f"Чем заканчивается квест «{title}»?", f"{q['finale_text']}\n\nКвест: {url}", "quest_finale", f"q{q['id']}f"))
    for city, items in by_city.items():
        lines = [quest_line(q) for q in items]
        for i, user in enumerate((f"Какие квесты есть в городе {city}?", f"Есть ли на metravel.by квест по городу {city}?")):
            out.append(sample(SYSTEM, user, list_answer(f"В городе {city} на metravel.by {len(items)} квест(ов):", lines, rng, len(items)), "quest_city", f"qc{city}{i}"))
    for c, items in by_qcountry.items():
        lines = [quest_line(q) for q in items]
        out.append(sample(SYSTEM, f"Какие квесты есть в стране {c}?", list_answer(f"В стране {c} у нас {len(items)} квест(ов). Например:", lines, rng, len(items)), "quest_country", f"qk{c}"))
    if quests_ru:
        cities = sorted(by_city, key=lambda k: -len(by_city[k]))
        summary = ", ".join(f"{c} ({len(by_city[c])})" for c in cities[:12])
        out.append(sample(SYSTEM, "Что за квесты на metravel.by?", f"Это городские квесты-прогулки: идёшь по точкам, читаешь историю места, выполняешь задание на месте и открываешь следующий шаг. Всего {len(quests_ru)} квестов; больше всего в городах: {summary}. Каталог: {SITE}/quests", "quest_about", "qabout"))

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
            out.append(sample(SYSTEM, user, f"На metravel.by пока нет материалов про {place}. Из того, что есть, могу предложить:\n{near}", "negative", f"n{place}{i}"))

    # --- about the site
    out.append(sample(SYSTEM, "Кто ведёт metravel.by?", f"metravel.by ведут Юля и Сергей: статьи о собственных поездках, прежде всего по Польше и Беларуси, и авторские городские квесты. Статьи: {SITE}/travels, квесты: {SITE}/quests", "about", "about0"))
    out.append(sample(SYSTEM, "Можешь посоветовать что-то не с вашего сайта?", f"Я отвечаю только по материалам metravel.by, чужие источники не пересказываю. Скажи страну, город или месяц — подберу из наших статей и квестов. Каталог: {SITE}/travels", "about", "about1"))
    return out


def split(records: list[dict], valid_share: float, test_share: float):
    train, valid, test = [], [], []
    for r in records:
        h = int(hashlib.sha1(r["key"].encode("utf-8")).hexdigest()[:8], 16) / 0xFFFFFFFF
        (test if h < test_share else valid if h < test_share + valid_share else train).append(r)
    return train, valid, test


def main() -> int:
    global CHUNK_CHARS
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=20261017)
    ap.add_argument("--valid-share", type=float, default=0.03)
    ap.add_argument("--test-share", type=float, default=0.02)
    ap.add_argument("--chunk-chars", type=int, default=CHUNK_CHARS, help="max characters per article section sample (≈ tokens × 3)")
    args = ap.parse_args()
    raw, out = Path(args.raw), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    CHUNK_CHARS = args.chunk_chars
    records = build(raw, args.seed)
    rng = random.Random(args.seed)
    rng.shuffle(records)
    train, valid, test = split(records, args.valid_share, args.test_share)
    stats = {"total": len(records), "train": len(train), "valid": len(valid), "test": len(test), "by_kind": {}, "chars": 0}
    for r in records:
        stats["by_kind"][r["kind"]] = stats["by_kind"].get(r["kind"], 0) + 1
        stats["chars"] += sum(len(m["content"]) for m in r["messages"])
    stats["approx_tokens"] = stats["chars"] // 3
    for name, rows in (("train", train), ("valid", valid), ("test", test)):
        with (out / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps({"messages": r["messages"]}, ensure_ascii=False) + "\n")
    (out / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
