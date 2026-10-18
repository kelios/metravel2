"""Set `translations`: RU → BE/UK/PL/EN in the site's voice, from the site's own
parallel texts cached by sources/site_translations.py
(<AI_HOME>/data/sources/site_translations/{quests.jsonl,i18n.jsonl}).

Four kinds of samples:

* quest_translate    — a Russian unit of a translated quest (title + intro,
                       step story, step task, finale) → the published
                       translation of the same unit, steps aligned by step_id;
* quest_card_l       — a question about a quest in the target language → the
                       quest card in that language (lead of the intro, city,
                       duration, level, points) with the quest URL;
* quest_card_from_ru — the same question with the Russian card pasted in (what
                       the assistant sees when the retrieved material is
                       Russian) → the card in the target language;
* ui_strings         — a numbered batch of the site's UI strings (one i18n
                       namespace) → the same batch as the site shows it in
                       the target language, placeholders kept.

Every sample of a quest has key "quest:<id>" (as in the `site` set), every
locale of one UI batch shares "ui:<namespace>:<n>": the split keeps all
renderings of one text on the same side. Answers never carry links to other
sites: units and strings with an external URL or a bare domain of another site
("muzeumtatrzanskie.pl") are skipped.

Options (mixes/*.yaml → sets.translations.options):
  locales   — target locales (default be, uk, pl, en);
  quests    — quest samples (default true);
  ui        — UI string batches (default true);
  ui_batch  — strings per batch (default 25);
  kind_share — {kind: share} of samples kept per kind (default 1.0 each), a
              deterministic choice by the sample id and seed: the whole set
              is ~7 M tokens, the v2 budget is 0.5 M, and the share decides
              what fills it instead of the uniform cap_tokens subsample.
"""
from __future__ import annotations

import json
import random
import re
from pathlib import Path

from sets.common import bucket, record

NAME = "translations"
LICENSE = "metravel.by own content (quest translations, site UI strings)"
SOURCE = "site_translations"
LOCALES = ("be", "uk", "pl", "en")
UI_BATCH = 25
LEAD_CHARS = 600
KINDS = ("quest_translate", "quest_card_l", "quest_card_from_ru", "ui_strings")

# "на белорусский язык" / "на белорусском языке"
LANG_ACC = {"be": "белорусский", "uk": "украинский", "pl": "польский", "en": "английский"}
LANG_PREP = {"be": "белорусском", "uk": "украинском", "pl": "польском", "en": "английском"}
TRANSLATE = (
    "Переведи на {acc} язык в голосе metravel.by:",
    "Переведи текст квеста на {acc} язык:",
    "Как это звучит на {prep} языке в версии квеста на metravel.by?",
)
UI_PROMPT = "Переведи строки интерфейса metravel.by на {acc} язык. Сохрани нумерацию и плейсхолдеры вида {{{{value1}}}}:"
CARD_ASK = {
    "be": ("Раскажы пра квэст «{t}».", "Што за квэст «{t}» на metravel.by?"),
    "uk": ("Розкажи про квест «{t}».", "Що за квест «{t}» на metravel.by?"),
    "pl": ("Opowiedz o queście „{t}”.", "Co to za quest „{t}” na metravel.by?"),
    "en": ("Tell me about the quest “{t}”.", "What is the quest “{t}” on metravel.by about?"),
}
FROM_RU_ASK = {
    "be": "Адкажы па-беларуску: пра што гэты квэст? Вось картка з сайта:",
    "uk": "Відповідай українською: про що цей квест? Ось картка з сайту:",
    "pl": "Odpowiedz po polsku: o czym jest ten quest? Oto karta ze strony:",
    "en": "Answer in English: what is this quest about? Here is the card from the site:",
}
# city, duration, level, route points, start
META = {
    "ru": ("Город", "Продолжительность: около {n} мин", "Уровень", "Точек маршрута", "Начать"),
    "be": ("Горад", "Працягласць: каля {n} хв", "Узровень", "Пунктаў маршруту", "Пачаць"),
    "uk": ("Місто", "Тривалість: близько {n} хв", "Рівень", "Точок маршруту", "Почати"),
    "pl": ("Miasto", "Czas: około {n} min", "Poziom", "Punktów trasy", "Rozpocznij"),
    "en": ("City", "Duration: about {n} min", "Level", "Route points", "Start"),
}
DIFFICULTY = {
    "ru": {"easy": "лёгкий", "medium": "средний", "hard": "сложный"},
    "be": {"easy": "лёгкі", "medium": "сярэдні", "hard": "складаны"},
    "uk": {"easy": "легкий", "medium": "середній", "hard": "складний"},
    "pl": {"easy": "łatwy", "medium": "średni", "hard": "trudny"},
    "en": {"easy": "easy", "medium": "medium", "hard": "hard"},
}
EXTERNAL_RE = re.compile(r"https?://(?!(?:www\.)?metravel\.by(?:[/?#]|$))", re.I)
# A bare domain in the text ("check muzeumtatrzanskie.pl"): a link to another
# site all the same. Not after @ (e-mail placeholders) or / (inside a URL).
DOMAIN_RE = re.compile(
    r"(?<![\w@./-])(?:[a-z0-9-]+\.)+"
    r"(?:com|org|net|info|io|eu|gov|edu|museum|travel|by|ru|ua|pl|lt|lv|ee|de|cz|sk|hr|it|es|fr|at|nl|tr|ge|am)\b(?![\w@-])",
    re.I,
)
OWN_DOMAIN_RE = re.compile(r"(?:www\.)?metravel\.by", re.I)
CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")


def clean(text: str | None) -> str:
    return (text or "").strip()


def has_external(*texts: str) -> bool:
    return any(
        EXTERNAL_RE.search(t) or any(not OWN_DOMAIN_RE.fullmatch(d) for d in DOMAIN_RE.findall(t))
        for t in texts
    )


def load_cache(sources_root: Path) -> tuple[dict[int, dict[str, dict]], list[dict]]:
    """({quest id: {locale: row}}, i18n rows) from the cache; SystemExit when it was never fetched."""
    root = sources_root / SOURCE
    if not (root / "i18n.jsonl").exists():
        raise SystemExit("set translations needs the site's parallel texts: run sources/site_translations.py first")
    quests: dict[int, dict[str, dict]] = {}
    if (root / "quests.jsonl").exists():
        for line in (root / "quests.jsonl").open(encoding="utf-8"):
            q = json.loads(line)
            quests.setdefault(q["id"], {})[q.get("content_locale") or "ru"] = q
    strings = [json.loads(line) for line in (root / "i18n.jsonl").open(encoding="utf-8")]
    return quests, strings


def quest_units(q: dict) -> dict[str, str]:
    """Aligned translation units of one quest locale: {unit id: text}."""
    units = {}
    intro = q.get("intro") or {}
    if clean(intro.get("story")):
        units["i"] = f"{clean(q.get('title'))}\n\n{clean(intro['story'])}"
    if clean(intro.get("task")):
        units["it"] = clean(intro["task"])
    for n, s in enumerate(q.get("steps") or []):
        sid = s.get("step_id") or f"#{n}"
        if clean(s.get("story")):
            loc = f" ({clean(s['location'])})" if clean(s.get("location")) else ""
            units[f"s:{sid}"] = f"{clean(s.get('title'))}{loc}\n\n{clean(s['story'])}".strip()
        if clean(s.get("task")):
            units[f"t:{sid}"] = clean(s["task"])
    if clean(q.get("finale_text")):
        units["f"] = clean(q["finale_text"])
    return units


def paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def lead_size(ru: dict, other: dict) -> int:
    """How many intro paragraphs make the card lead: as many Russian ones as fit
    LEAD_CHARS (at least one), the same number in the translation when both
    have the same paragraphs, else only the first one."""
    ru_paras = paragraphs(clean((ru.get("intro") or {}).get("story")))
    other_paras = paragraphs(clean((other.get("intro") or {}).get("story")))
    size, total = 1, len(ru_paras[0]) if ru_paras else 0
    while size < len(ru_paras) and total + len(ru_paras[size]) <= LEAD_CHARS:
        total += len(ru_paras[size])
        size += 1
    return size if len(ru_paras) == len(other_paras) else 1


def quest_card(q: dict, locale: str, url: str, lead: int) -> str:
    city_label, duration, level, points, start = META[locale]
    city = (q.get("city") or {}).get("name_localized") or q.get("city_name")
    bits = [f"{city_label}: {city}"] if city else []
    if q.get("duration_min"):
        bits.append(duration.format(n=q["duration_min"]))
    if q.get("difficulty") in DIFFICULTY[locale]:
        bits.append(f"{level}: {DIFFICULTY[locale][q['difficulty']]}")
    if q.get("steps"):
        bits.append(f"{points}: {len(q['steps'])}")
    story = "\n\n".join(paragraphs(clean((q.get("intro") or {}).get("story")))[:lead])
    meta = ". ".join(bits) + "." if bits else ""
    return "\n\n".join(p for p in (story, meta, f"{start}: {url}") if p)


def quest_samples(qid: int, by_locale: dict[str, dict], locales: tuple[str, ...], rng: random.Random, rec) -> list[dict]:
    ru = by_locale["ru"]
    url, key = ru["url"], f"quest:{qid}"
    ru_units = quest_units(ru)
    out = []
    for loc in locales:
        q = by_locale.get(loc)
        if not q:
            continue
        for unit, text in quest_units(q).items():
            source = ru_units.get(unit)
            if not source or has_external(source, text):
                continue
            prompt = rng.choice(TRANSLATE).format(acc=LANG_ACC[loc], prep=LANG_PREP[loc])
            out.append(rec(f"{prompt}\n\n{source}", text, "quest_translate", key, f"q{qid}{loc}:{unit}"))
        if not clean((q.get("intro") or {}).get("story")):
            continue
        lead = lead_size(ru, q)
        card, ru_card = quest_card(q, loc, url, lead), quest_card(ru, "ru", url, lead)
        if has_external(card, ru_card):
            continue
        ask = rng.choice(CARD_ASK[loc])
        out.append(rec(ask.format(t=clean(q.get("title"))), card, "quest_card_l", key, f"q{qid}{loc}:c"))
        out.append(rec(f"{FROM_RU_ASK[loc]}\n\n{ru_card}", card, "quest_card_from_ru", key, f"q{qid}{loc}:r"))
    return out


def ui_usable(ru: str, text: str | None) -> bool:
    return bool(text) and text != ru and "\n" not in text and "\n" not in ru and not has_external(ru, text)


def ui_samples(strings: list[dict], locales: tuple[str, ...], batch: int, rec) -> list[dict]:
    by_ns: dict[str, list[dict]] = {}
    for row in strings:
        if CYRILLIC_RE.search(row["ru"]):
            by_ns.setdefault(row["ns"], []).append(row)
    out = []
    for ns, rows in by_ns.items():
        for n in range(0, len(rows), batch):
            chunk = rows[n:n + batch]
            for loc in locales:
                pairs = [(r["ru"], r[loc]) for r in chunk if ui_usable(r["ru"], r.get(loc))]
                if not pairs:
                    continue
                user = UI_PROMPT.format(acc=LANG_ACC[loc]) + "\n" + "\n".join(f"{i}. {src}" for i, (src, _) in enumerate(pairs, 1))
                answer = "\n".join(f"{i}. {dst}" for i, (_, dst) in enumerate(pairs, 1))
                out.append(rec(user, answer, "ui_strings", f"ui:{ns}:{n // batch}", f"ui{loc}:{ns}:{n // batch}"))
    return out


def build(ctx: dict, options: dict) -> list[dict]:
    locales = tuple(options.get("locales") or LOCALES)
    unknown = sorted(set(locales) - set(LOCALES))
    if unknown:
        raise SystemExit(f"set translations: unknown locales {unknown}, expected some of {list(LOCALES)}")
    share = {kind: float(v) for kind, v in (options.get("kind_share") or {}).items()}
    if set(share) - set(KINDS) or any(not 0.0 <= v <= 1.0 for v in share.values()):
        raise SystemExit(f"set translations: kind_share takes kinds {list(KINDS)} with shares in [0, 1], got {share}")

    def rec(user: str, assistant: str, kind: str, key: str, id: str) -> dict:
        return record(user, assistant, set_name=NAME, license=LICENSE, kind=kind, key=key, id=id)

    quests, strings = load_cache(ctx["sources"])
    rng = random.Random(f"{ctx['seed']}:{NAME}")
    out: list[dict] = []
    if options.get("quests", True):
        for qid in sorted(quests):
            if "ru" in quests[qid]:
                out.extend(quest_samples(qid, quests[qid], locales, rng, rec))
    if options.get("ui", True):
        out.extend(ui_samples(strings, locales, int(options.get("ui_batch", UI_BATCH)), rec))
    return [r for r in out if share.get(r["kind"], 1.0) == 1.0 or bucket(f"{ctx['seed']}:{r['id']}") < share[r["kind"]]]


def source_info(ctx: dict) -> dict:
    from sources.common import read_meta

    return {"cache": str(ctx["sources"] / SOURCE), "meta": read_meta(ctx["sources"] / SOURCE)}
