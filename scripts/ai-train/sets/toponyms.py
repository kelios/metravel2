"""Set `toponyms`: places of Belarus and Poland from the Wikidata cache
(sources/wikidata.py → <AI_HOME>/data/sources/wikidata/{items.jsonl,entities.json}),
CC0, so nothing to attribute and no URL in the answers.

What the model learns: one place under its names in five languages
(Гродно / Гродна / Гродно / Grodno / Hrodna), which administrative unit it
belongs to, what kind of object it is. Four kinds of samples:

* name_in — "Как по-польски называется X?" → the name in that language (and
            back: a Polish/English/Belarusian spelling → the Russian name);
* where   — "В какой области находится X?" → type + the administrative chain
            up to the country, in the nominative, so no declension is needed;
* what    — "Что это за объект — X?" → type, chain, heritage status, elevation,
            population, year;
* same    — "X и Y — одно и то же?" → yes for two spellings of one place, no
            for two different places of the same kind (both described).

Key of every sample is the QID ("wd:Q6220"), so all phrasings of one place
stay on one side of the split. Items are ranked by sitelinks and cut per
(country, group) — a village with two Wikipedia articles is not what the
assistant is asked about.

Options (mixes/*.yaml → sets.toponyms.options):
  max_items   — items per (country, group), by sitelinks (default 600);
  name_langs  — target languages per item for name_in (default 2, of be/uk/pl/en);
  be_share    — share of items asked in Belarusian (default 0.1): name_in and
                where then answer in Belarusian too (the chain in be labels),
                what and same stay Russian.
"""
from __future__ import annotations

import json
import random
import re
from pathlib import Path

from sets.common import record

NAME = "toponyms"
LICENSE = "CC0 1.0 (Wikidata)"
SOURCE = "wikidata"
LANGS = ("be", "uk", "pl", "en")
MAX_ITEMS = 600
NAME_LANGS = 2
BE_SHARE = 0.1
COUNTRY = {"BY": {"ru": "Беларусь", "be": "Беларусь"}, "PL": {"ru": "Польша", "be": "Польшча"}}
COUNTRY_LOC = {"BY": "Беларуси", "PL": "Польше"}  # «в Беларуси»
LANG_RU = {"ru": "по-русски", "be": "по-белорусски", "uk": "по-украински", "pl": "по-польски", "en": "по-английски"}
LANG_BE = {"ru": "па-руску", "be": "па-беларуску", "uk": "па-ўкраінску", "pl": "па-польску", "en": "па-англійску"}
# natural Russian for the country-specific Wikidata classes
TYPE_RU = {
    "Q515": "город", "Q3957": "город", "Q7930989": "город", "Q1549591": "крупный город", "Q2514025": "посёлок городского типа",
    "Q79323854": "город областного подчинения", "Q79324274": "город", "Q91733160": "городской посёлок",
    "Q1989945": "агрогородок", "Q65665664": "посёлок", "Q65661087": "деревня", "Q925381": "город на правах повята",
    "Q13416557": "город", "Q138845716": "населённый пункт", "Q486972": "населённый пункт", "Q3558970": "село",
    "Q532": "село", "Q5084": "деревня",
    "Q23413": "замок", "Q16560": "дворец", "Q1802963": "усадьба", "Q879050": "усадебный дом", "Q44613": "монастырь",
    "Q16970": "храм", "Q2031836": "православная церковь", "Q1088552": "костёл", "Q744296": "деревянная церковь",
    "Q2977": "кафедральный собор", "Q34627": "синагога", "Q32815": "мечеть", "Q57821": "укрепление",
    "Q839954": "археологический памятник", "Q4989906": "памятник", "Q5003624": "мемориал", "Q12518": "башня",
    "Q570116": "достопримечательность", "Q1200957": "достопримечательность", "Q811165": "памятник архитектуры",
    "Q33506": "музей", "Q1081138": "историческое место",
    "Q23397": "озеро", "Q131681": "водохранилище", "Q8502": "гора", "Q46831": "горный хребет", "Q54050": "холм",
    "Q46169": "национальный парк", "Q179049": "заповедник", "Q4433777": "заказник", "Q6576413": "ландшафтный парк",
    "Q2042028": "охраняемый ландшафт", "Q473972": "охраняемая территория", "Q22698": "парк", "Q4421": "лес",
    "Q4022": "река", "Q35509": "пещера",
}
# the order decides which type names the object when it has several
TYPE_ORDER = list(TYPE_RU)
# administrative units that never make the chain readable
SKIP_UNIT_TYPES = {"Q15071808"}  # сельсовет Беларуси
COUNTRY_QID = {"BY": "Q184", "PL": "Q36"}
COUNTRY_QIDS = set(COUNTRY_QID.values())  # the chain stops here; the country is named by COUNTRY
COUNTRY_TYPES = {"Q6256", "Q3624078"}  # country, sovereign state: a chain reaching another one (a border river) is dropped
HISTORIC_TYPES = {"Q19953632", "Q3024240", "Q15893266"}  # former administrative unit, historical country, former entity: not "where it is" today
DISAMBIG_RE = re.compile(r"\s*\([^()]*\)$")  # "Студент (гора)" → "Студент"
MOUNTAIN_TYPES = {"Q8502", "Q46831", "Q54050"}  # elevation makes sense for these only, not for rivers
MAX_CHAIN = 3

ASK_NAME = {
    "ru": ("Как {lang} называется {x}?", "Как будет {x} {lang}?", "{x} — как это пишется {lang}?"),
    "be": ("Як {lang} называецца {x}?", "Як будзе {x} {lang}?"),
}
ASK_WHERE = {
    "BY": ("В какой области находится {x}?", "Где находится {x}?", "В каком районе {x}?"),
    "PL": ("В каком воеводстве находится {x}?", "Где находится {x}?", "В каком повяте {x}?"),
}
ASK_WHERE_BE = {
    "BY": ("У якой вобласці знаходзіцца {x}?", "Дзе знаходзіцца {x}?"),
    "PL": ("У якім ваяводстве знаходзіцца {x}?", "Дзе знаходзіцца {x}?"),
}
ASK_WHAT = ("Что это за объект — {x}?", "{x} — что это?", "Расскажи коротко, что такое {x}.")
ASK_SAME = ("{x} и {y} — одно и то же?", "{x} и {y} — это одно место?", "{x} — это то же самое, что {y}?")


def load_cache(sources_root: Path) -> tuple[list[dict], dict[str, dict]]:
    root = sources_root / SOURCE
    if not (root / "items.jsonl").exists() or not (root / "entities.json").exists():
        raise SystemExit("set toponyms needs the Wikidata cache: run sources/wikidata.py first")
    items = [json.loads(line) for line in (root / "items.jsonl").open(encoding="utf-8")]
    entities = json.loads((root / "entities.json").read_text(encoding="utf-8"))
    return items, entities


def type_of(it: dict, entities: dict[str, dict]) -> str | None:
    for q in TYPE_ORDER:
        if q in it["types"]:
            return TYPE_RU[q]
    for q in it["types"]:
        label = entities.get(q, {}).get("labels", {}).get("ru")
        if label:
            return label
    return None


def chain(it: dict, entities: dict[str, dict], lang: str = "ru") -> list[str]:
    """Administrative units from the item upwards, labels in `lang` (Russian fallback), country left out."""
    def historic(qid: str) -> bool:
        return bool(set(entities.get(qid, {}).get("types") or []) & HISTORIC_TYPES)

    out, seen = [], set()
    current = [r for r in it["regions"] if not historic(r)]  # a village may also list its 18th-century powiat
    q = current[0] if current else None
    while q and q not in seen and q not in COUNTRY_QIDS and len(out) < MAX_CHAIN + 2:
        seen.add(q)
        ent = entities.get(q)
        if not ent or historic(q):
            return []  # a chain ending in a former unit says nothing about today
        if set(ent.get("types") or []) & COUNTRY_TYPES:
            return []  # the P131 chain left the item's own country
        if not (set(ent.get("types") or []) & SKIP_UNIT_TYPES):
            label = ent.get("labels", {}).get(lang) or ent.get("labels", {}).get("ru")
            if label:
                out.append(label)
        ups = [r for r in ent.get("regions") or [] if not historic(r)]
        q = ups[0] if ups else None
    # the chain is trusted only when it climbs to the item's own country (border rivers list a foreign voivodeship)
    return out[:MAX_CHAIN] if q == COUNTRY_QID[it["country"]] else []


def facts(it: dict, entities: dict[str, dict]) -> list[str]:
    bits = []
    for q in it.get("heritage") or []:
        label = entities.get(q, {}).get("labels", {}).get("ru")
        if label:
            bits.append(f"Статус: {label}.")
            break
    if it.get("elevation") and set(it["types"]) & MOUNTAIN_TYPES:
        bits.append(f"Высота: {it['elevation']} м.")
    if it.get("population") and it["group"] == "settlement":
        bits.append(f"Население: около {it['population']:,} человек.".replace(",", " "))
    if it.get("inception") and it["group"] == "monument":
        bits.append(f"Год: {it['inception']}.")
    return bits


def names_line(it: dict) -> str:
    parts = [f"{LANG_RU[lang]} — {it['labels'][lang]}" for lang in LANGS if it["labels"].get(lang)]
    return ("Названия: " + ", ".join(parts) + ".") if parts else ""


def describe(it: dict, entities: dict[str, dict], kind: str | None, with_names: bool) -> str:
    ru = it["labels"]["ru"]
    where = chain(it, entities)
    place = ", ".join(where + [COUNTRY[it["country"]]["ru"]])
    head = f"{ru} — {kind} ({place})." if kind else f"{ru} — {place}."
    tail = facts(it, entities)
    if with_names:
        tail.append(names_line(it))
    return " ".join(p for p in [head] + tail if p)


def item_samples(it: dict, entities: dict[str, dict], others: list[dict], opts: dict, rng: random.Random, rec) -> list[dict]:
    ru = it["labels"]["ru"]
    key, out = f"wd:{it['qid']}", []
    kind = type_of(it, entities)
    be = rng.random() < opts["be_share"]

    # name_in: Russian → N target languages, and one foreign spelling → Russian
    targets = [lang for lang in LANGS if it["labels"].get(lang) and it["labels"][lang] != ru]  # "Ланьцут — Ланьцут" teaches nothing
    rng.shuffle(targets)
    for lang in targets[: opts["name_langs"]]:
        ask = rng.choice(ASK_NAME["be" if be else "ru"]).format(x=ru, lang=(LANG_BE if be else LANG_RU)[lang])
        aliases = [a for a in it["aliases"].get(lang, []) if a != it["labels"][lang]][:2]
        also = f" ({'сустракаецца таксама' if be else 'встречается также'}: {', '.join(aliases)})" if aliases else ""
        if be:
            answer = f"{LANG_BE[lang].capitalize()} {ru} — {it['labels'][lang]}{also}."
        else:
            answer = f"{LANG_RU[lang].capitalize()} {ru} — {it['labels'][lang]}{also}."
        out.append(rec(ask, answer, "name_in", key, f"{it['qid']}:n:{lang}"))
    foreign = [lang for lang in ("pl", "en", "be") if it["labels"].get(lang) and it["labels"][lang] != ru]
    if foreign:
        lang = rng.choice(foreign)
        ask = rng.choice(ASK_NAME["ru"]).format(x=it["labels"][lang], lang=LANG_RU["ru"])
        out.append(rec(ask, f"{it['labels'][lang]} по-русски — {ru}. {describe(it, entities, kind, with_names=True)}", "name_in", key, f"{it['qid']}:n:ru"))

    # where
    if it["regions"] and chain(it, entities):
        ask = rng.choice((ASK_WHERE_BE if be else ASK_WHERE)[it["country"]]).format(x=ru)
        if be:  # a Belarusian question gets a Belarusian answer: no type (TYPE_RU is Russian), the chain in be labels
            answer = f"{ru} — {', '.join(chain(it, entities, 'be') + [COUNTRY[it['country']]['be']])}."
        else:
            answer = describe(it, entities, kind, with_names=False)
        out.append(rec(ask, answer, "where", key, f"{it['qid']}:w"))

    # what
    if kind:
        out.append(rec(rng.choice(ASK_WHAT).format(x=ru), describe(it, entities, kind, with_names=True), "what", key, f"{it['qid']}:t"))

    # same: one positive (another spelling), one negative (another place of the group)
    spellings = [it["labels"][l] for l in LANGS if it["labels"].get(l) and it["labels"][l] != ru]
    spellings += [a for l in ("en", "pl", "be") for a in it["aliases"].get(l, []) if a != ru]
    if spellings:
        y = rng.choice(spellings)
        answer = f"Да, {ru} и {y} — одно и то же место: {describe(it, entities, kind, with_names=True)[len(ru) + 3:]}"
        out.append(rec(rng.choice(ASK_SAME).format(x=ru, y=y), answer, "same", key, f"{it['qid']}:s1"))
    if others:
        other = rng.choice(others)
        if other["qid"] != it["qid"] and other["labels"]["ru"] != ru:
            # the other place is named only by its kind and country: its own where/what answer must not leak
            # into this item's split side (docs/AI_TRAIN_DATASETS.md § 2, key = entity)
            other_kind = type_of(other, entities) or "другой объект"
            answer = (f"Нет, это разные места. {describe(it, entities, kind, with_names=False)} "
                      f"{other['labels']['ru']} — {other_kind} в {COUNTRY_LOC[other['country']]}.")
            out.append(rec(rng.choice(ASK_SAME).format(x=ru, y=other["labels"]["ru"]), answer, "same", key, f"{it['qid']}:s0"))
    return out


def build(ctx: dict, options: dict) -> list[dict]:
    opts = {
        "max_items": int(options.get("max_items", MAX_ITEMS)),
        "name_langs": int(options.get("name_langs", NAME_LANGS)),
        "be_share": float(options.get("be_share", BE_SHARE)),
    }
    if not 0.0 <= opts["be_share"] <= 1.0 or opts["name_langs"] < 0 or opts["max_items"] <= 0:
        raise SystemExit(f"set toponyms: bad options {opts}")

    def rec(user: str, assistant: str, kind: str, key: str, id: str) -> dict:
        return record(user, assistant, set_name=NAME, license=LICENSE, kind=kind, key=key, id=id)

    items, entities = load_cache(ctx["sources"])
    for it in items:
        if it["labels"].get("ru"):
            it["labels"]["ru"] = DISAMBIG_RE.sub("", it["labels"]["ru"]) or it["labels"]["ru"]
    items = [it for it in items if it["labels"].get("ru")]
    by_group: dict[tuple[str, str], list[dict]] = {}
    for it in sorted(items, key=lambda i: (-i["sitelinks"], i["qid"])):
        bucket_ = by_group.setdefault((it["country"], it["group"]), [])
        if len(bucket_) < opts["max_items"]:
            bucket_.append(it)
    rng = random.Random(f"{ctx['seed']}:{NAME}")
    out: list[dict] = []
    for group_key in sorted(by_group):
        group = by_group[group_key]
        for it in group:
            out.extend(item_samples(it, entities, group, opts, rng, rec))
    return out


def source_info(ctx: dict) -> dict:
    from sources.common import read_meta

    return {"cache": str(ctx["sources"] / SOURCE), "meta": read_meta(ctx["sources"] / SOURCE),
            # Task Contract #2477 p. 4: the Belarus denylist scan is not applied — structured CC0 data, no media text
            "denylist_scan": "not applied: structured Wikidata labels and properties, no press text"}
