"""Set `osm_intents`: two map skills built from OpenStreetMap tags
(sources/osm.py → <AI_HOME>/data/sources/osm/pois.jsonl, ODbL — the cache stays
local, only the skills reach the weights):

* intent   — a visitor's question ("где рядом с Несвижем смотровые и
             парковка для кемпера") → the map filter as JSON by
             ../osm_filter_schema.json: categories of the map, one of its radii,
             a centre to geocode (or null for the whole country) and the
             visitor's constraints. Synthetic: templates × real settlement
             names × categories × radii × constraints, RU with a share of BE
             and PL questions;
* describe — the tags of a real POI → a short description in the site's
             voice: what it is, where, height / year / access, no invented
             facts beyond the tags, no URLs.

`validate_filter()` is the one validator of the schema; eval.py uses it for
the `osm_intents` slice (expect=json).

Centres come from the Wikidata cache when it is there (settlements by
sitelinks), else from the POIs' addr:city.

Options (mixes/*.yaml → sets.osm_intents.options):
  intents       — number of intent samples (default 2500);
  describe      — max describe samples (default 2500);
  centres       — settlement names per country used as centres (default 250);
  lang_share    — {be: 0.1, pl: 0.1} share of non-Russian intent questions.
"""
from __future__ import annotations

import json
import random
import re
from pathlib import Path

from sets.common import record
from sets.translations import has_external

NAME = "osm_intents"
LICENSE = "ODbL 1.0 (OpenStreetMap contributors) — skills only, derived cache not published"
SOURCE = "osm"
SCHEMA_PATH = Path(__file__).resolve().parents[1] / "osm_filter_schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
CATEGORIES: list[str] = SCHEMA["properties"]["categories"]["items"]["enum"]
RADII: list[int] = SCHEMA["properties"]["radius_km"]["enum"]
CONSTRAINTS: list[str] = list(SCHEMA["properties"]["constraints"]["properties"])
INTENTS = 2500
DESCRIBE = 2500
CENTRES = 250
LANG_SHARE = {"be": 0.1, "pl": 0.1}
COUNTRY_RU = {"BY": "Беларуси", "PL": "Польше"}
COUNTRY_L = {"be": {"BY": "Беларусі", "PL": "Польшчы"}, "pl": {"BY": "na Białorusi", "PL": "w Polsce"}}

INTENT_PROMPT = (
    "Составь фильтр карты metravel.by в JSON по схеме {{categories, radius_km, center, constraints}} "
    "(categories из attractions, culture, viewpoints, entertainment, religion, history; radius_km из 10, 25, 50, 100, 200; "
    "center — {{\"name\": ...}} или null; constraints — dogs, camper, kids, free) для запроса:\n«{q}»"
)
CAT_PHRASE = {
    "ru": {
        "attractions": ["достопримечательности", "интересные места", "что посмотреть"],
        "culture": ["музеи", "музей"],
        "viewpoints": ["смотровые", "смотровые площадки", "красивые виды"],
        "entertainment": ["зоопарк или парк развлечений", "развлечения", "парк аттракционов"],
        "religion": ["храмы", "костёлы и церкви", "церкви", "костёлы"],
        "history": ["замки", "усадьбы", "замки и усадьбы", "руины", "памятники истории"],
    },
    "be": {
        "attractions": ["славутасці", "цікавыя месцы"],
        "culture": ["музеі"],
        "viewpoints": ["аглядныя пляцоўкі", "краявіды"],
        "entertainment": ["забавы", "заапарк"],
        "religion": ["храмы", "касцёлы і цэрквы"],
        "history": ["замкі", "сядзібы", "руіны"],
    },
    "pl": {
        "attractions": ["atrakcje", "ciekawe miejsca"],
        "culture": ["muzea"],
        "viewpoints": ["punkty widokowe"],
        "entertainment": ["zoo lub park rozrywki", "rozrywki"],
        "religion": ["kościoły i cerkwie", "świątynie"],
        "history": ["zamki", "dwory", "ruiny", "zamki i pałace"],
    },
}
JOIN = {"ru": " и ", "be": " і ", "pl": " i "}
RADIUS_PHRASE = {
    "ru": ["в радиусе {r} км от {x}", "не дальше {r} км от {x}", "в {r} км вокруг {x}", "{r} км от {x}"],
    "be": ["у радыусе {r} км ад {x}", "не далей {r} км ад {x}"],
    "pl": ["w promieniu {r} km od {x}", "do {r} km od {x}"],
}
# phrases without a number map to a radius
NEAR_PHRASE = {
    "ru": [("рядом с {x}", 25), ("около {x}", 25), ("недалеко от {x}", 50), ("в окрестностях {x}", 25), ("возле {x}", 10), ("по дороге в {x}", 50)],
    "be": [("каля {x}", 25), ("недалёка ад {x}", 50), ("у наваколлі {x}", 25)],
    "pl": [("w pobliżu {x}", 25), ("niedaleko {x}", 50), ("w okolicy {x}", 25)],
}
COUNTRY_PHRASE = {"ru": ["по всей {c}", "где-нибудь в {c}", "в {c}"], "be": ["па ўсёй {c}", "у {c}"], "pl": ["{c}", "gdziekolwiek {c}"]}
CONSTRAINT_PHRASE = {
    "ru": {"dogs": ["с собакой", "куда можно с собакой"], "camper": ["где встать с кемпером", "с автодомом", "с парковкой для кемпера"],
           "kids": ["с детьми", "для детей"], "free": ["бесплатно", "без билета", "без платы за вход"]},
    "be": {"dogs": ["з сабакам"], "camper": ["з кемперам", "з аўтадомам"], "kids": ["з дзецьмі"], "free": ["бясплатна"]},
    "pl": {"dogs": ["z psem"], "camper": ["z kamperem"], "kids": ["z dziećmi"], "free": ["za darmo", "bez biletu"]},
}
OPENERS = {
    "ru": ["Где {where} {cats}{cons}?", "Покажи {cats} {where}{cons}.", "Какие {cats} есть {where}{cons}?", "Ищу {cats} {where}{cons}.", "{cats} {where}{cons}"],
    "be": ["Дзе {where} {cats}{cons}?", "Пакажы {cats} {where}{cons}.", "Якія {cats} ёсць {where}{cons}?"],
    "pl": ["Gdzie {where} {cats}{cons}?", "Pokaż {cats} {where}{cons}.", "Jakie {cats} są {where}{cons}?"],
}

DESCRIBE_PROMPT = "Опиши место по его тегам OpenStreetMap в стиле metravel.by, двумя-тремя фразами, без выдуманных фактов:\n{tags}"
KIND_RU = {
    ("tourism", "viewpoint"): "смотровая площадка", ("tourism", "museum"): "музей", ("tourism", "attraction"): "достопримечательность",
    ("tourism", "zoo"): "зоопарк", ("tourism", "theme_park"): "парк развлечений", ("tourism", "camp_site"): "кемпинг",
    ("tourism", "caravan_site"): "стоянка для автодомов",
    ("historic", "castle"): "замок", ("historic", "manor"): "усадьба", ("historic", "fort"): "форт", ("historic", "ruins"): "руины",
    ("historic", "archaeological_site"): "археологический памятник", ("historic", "monument"): "памятник", ("historic", "memorial"): "мемориал",
    ("natural", "peak"): "вершина",
}
WORSHIP_RU = {
    ("christian", "catholic"): "костёл", ("christian", "roman_catholic"): "костёл", ("christian", "orthodox"): "православная церковь",
    ("christian", "greek_catholic"): "греко-католическая церковь", ("christian", "protestant"): "протестантская церковь",
    ("christian", "lutheran"): "лютеранская кирха", ("christian", None): "храм", ("jewish", None): "синагога",
    ("muslim", None): "мечеть", (None, None): "храм",
}
FEMININE = {"смотровая площадка", "достопримечательность", "усадьба", "стоянка для автодомов", "вершина", "православная церковь",
            "греко-католическая церковь", "протестантская церковь", "лютеранская кирха", "синагога", "мечеть"}
PLURAL = {"руины"}
CLOSERS = {
    "tourism": ["Удобная точка, чтобы заложить на неё полчаса по пути.", "Хороший повод сделать остановку на маршруте."],
    "historic": ["Стоит заложить время на неспешную прогулку вокруг.", "Такие места лучше смотреть без спешки."],
    "amenity": ["Загляните внутрь, если открыто.", "Снаружи тоже есть на что посмотреть."],
    "natural": ["Подъём по силам большинству, обувь — походная.", "Лучший свет для фото — утро и предзакатный час."],
}
URL_RE = re.compile(r"https?://|www\.", re.I)


# ----------------------------------------------------------------------------- schema

def validate_filter(obj) -> list[str]:
    """Problems of a parsed filter against osm_filter_schema.json ([] = valid). Hand-written
    for this one schema so the training venv needs no jsonschema."""
    errors: list[str] = []
    if not isinstance(obj, dict):
        return ["not an object"]
    allowed = set(SCHEMA["properties"])
    for key in obj:
        if key not in allowed:
            errors.append(f"unknown key {key!r}")
    for key in SCHEMA["required"]:
        if key not in obj:
            errors.append(f"missing {key!r}")
    cats = obj.get("categories")
    if "categories" in obj:
        if not isinstance(cats, list) or not cats:
            errors.append("categories must be a non-empty list")
        else:
            bad = [c for c in cats if c not in CATEGORIES]
            if bad:
                errors.append(f"unknown categories {bad}")
            if len(set(map(str, cats))) != len(cats):
                errors.append("categories repeat")
    if "radius_km" in obj and (isinstance(obj["radius_km"], bool) or obj["radius_km"] not in RADII):
        errors.append(f"radius_km {obj['radius_km']!r} not in {RADII}")
    centre = obj.get("center")
    if "center" in obj and centre is not None:
        if not isinstance(centre, dict) or set(centre) != {"name"} or not isinstance(centre["name"], str) or len(centre["name"]) < 2:
            errors.append("center must be null or {\"name\": str}")
    cons = obj.get("constraints")
    if "constraints" in obj:
        if not isinstance(cons, dict):
            errors.append("constraints must be an object")
        else:
            for k, v in cons.items():
                if k not in CONSTRAINTS:
                    errors.append(f"unknown constraint {k!r}")
                elif not isinstance(v, bool):
                    errors.append(f"constraint {k!r} must be boolean")
    return errors


def extract_json(text: str):
    """The first {...} object in a model answer (fenced or inline, text around it allowed), or None."""
    decoder = json.JSONDecoder()
    for m in re.finditer(r"\{", text):
        try:
            return decoder.raw_decode(text, m.start())[0]
        except json.JSONDecodeError:
            continue
    return None


def dump_filter(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True)


# ----------------------------------------------------------------------------- data

CYRILLIC_RE = re.compile(r"[А-Яа-яЁёІіЎўЪъЄєЇїҐґ]")
# letters Belarusian and Russian use and Ukrainian never does (і is shared, so it proves nothing)
BE_RU_ONLY_RE = re.compile(r"[ЎўЫыЭэЁё]")
UKRAINIAN_RE = re.compile(r"[ЄєЇїҐґ]")
# letters of the neighbours' alphabets that Polish does not use: Lithuanian ė ų į, Czech/Slovak ě ř ů ť ď ň, German ß ä ö ü
NOT_POLISH_RE = re.compile(r"[ėųįěřůťďňßäöü]", re.I)


def in_country(poi: dict, wikidata_country: dict[str, str]) -> bool:
    """The Overpass query is bounded by the country's area, but a tile fetched by bbox alone would hold
    the neighbours' objects too; this is the second line. A POI is kept when its Wikidata item is in the
    toponyms cache with the same country; without one the name must prove the country: for Belarus a
    Belarusian name (name:be) or a letter Ukrainian never uses, and no Ukrainian letter; for Poland
    Latin without the neighbours' letters. Ambiguous names (plain «Городище») are dropped."""
    tags = poi["tags"]
    qid = tags.get("wikidata")
    if qid in wikidata_country:
        return wikidata_country[qid] == poi["country"]
    name = tags.get("name", "")
    if poi["country"] == "BY":
        if UKRAINIAN_RE.search(name) or tags.get("name:uk") == name:
            return False
        # a Cyrillic name is required: Polish and Lithuanian objects also carry a Belarusian name:be
        return bool(CYRILLIC_RE.search(name)) and (bool(tags.get("name:be")) or bool(BE_RU_ONLY_RE.search(name)))
    return not CYRILLIC_RE.search(name) and not NOT_POLISH_RE.search(name)


def load_pois(sources_root: Path) -> list[dict]:
    path = sources_root / SOURCE / "pois.jsonl"
    if not path.exists():
        raise SystemExit("set osm_intents needs the OSM cache: run sources/osm.py first")
    pois = [json.loads(line) for line in path.open(encoding="utf-8")]
    items = sources_root / "wikidata" / "items.jsonl"
    country = {}
    if items.exists():
        for line in items.open(encoding="utf-8"):
            r = json.loads(line)
            country[r["qid"]] = r["country"]
    return [p for p in pois if in_country(p, country)]


def load_centres(sources_root: Path, pois: list[dict], per_country: int) -> dict[str, list[dict]]:
    """{country: [{key, ru, be, pl}]} — settlements of the Wikidata cache by sitelinks (key "wd:<QID>", as in
    toponyms, so Гродно / Гродна / Grodno stay on one side of the split), else addr:city of the POIs."""
    out: dict[str, list[dict]] = {"BY": [], "PL": []}
    items = sources_root / "wikidata" / "items.jsonl"
    if items.exists():
        rows = [json.loads(line) for line in items.open(encoding="utf-8")]
        rows = [r for r in rows if r.get("group") == "settlement" and r["labels"].get("ru")]
        for code in out:
            top = sorted((r for r in rows if r["country"] == code), key=lambda r: (-r["sitelinks"], r["qid"]))[:per_country]
            out[code] = [{"key": f"wd:{r['qid']}", "ru": r["labels"]["ru"], "be": r["labels"].get("be") or r["labels"]["ru"],
                          "pl": r["labels"].get("pl") or r["labels"]["ru"]} for r in top]
    for code in out:
        if not out[code]:
            names = sorted({p["tags"]["addr:city"] for p in pois if p["country"] == code and p["tags"].get("addr:city")})
            out[code] = [{"key": f"centre:{n}", "ru": n, "be": n, "pl": n} for n in names[:per_country]]
    return out


# ----------------------------------------------------------------------------- intents

def intent_sample(rng: random.Random, lang: str, centres: dict[str, list[dict]]) -> tuple[str, dict, str]:
    country = rng.choice(["BY", "PL"])
    n_cats = 1 if rng.random() < 0.65 else 2
    cats = rng.sample(CATEGORIES, n_cats)
    cats_text = JOIN[lang].join(rng.choice(CAT_PHRASE[lang][c]) for c in cats)
    cons = {c: True for c in CONSTRAINTS if rng.random() < 0.18}
    cons_text = "".join(f", {rng.choice(CONSTRAINT_PHRASE[lang][c])}" for c in cons)
    roll = rng.random()
    if roll < 0.1 or not centres[country]:
        where = rng.choice(COUNTRY_PHRASE[lang]).format(c=COUNTRY_L[lang][country] if lang != "ru" else COUNTRY_RU[country])
        centre, radius, key = None, 200, f"country:{country}"
    else:
        place = rng.choice(centres[country])
        x, key = place[lang], place["key"]
        if roll < 0.55:
            radius = rng.choice(RADII)
            phrase = rng.choice(RADIUS_PHRASE[lang])
        else:
            phrase, radius = rng.choice(NEAR_PHRASE[lang])
        where = phrase.format(r=radius, x=in_phrase(x, phrase, lang, rng))
        centre = {"name": x}
    q = rng.choice(OPENERS[lang]).format(where=where, cats=cats_text, cons=cons_text)
    q = q[0].upper() + q[1:]
    answer: dict = {"categories": sorted(cats, key=CATEGORIES.index), "radius_km": radius, "center": centre}
    if cons:
        answer["constraints"] = cons
    return q, answer, key


# Russian prepositions in the templates take the genitive ("от Несвижа") or the
# instrumental ("рядом с Несвижем"); the answer keeps the nominative, so the
# model learns the mapping. Only one-word names with a clear ending are
# declined, the rest (and every BE/PL question) get "города X" / "miasta X".
# Every other phrase ("от", "около", "вокруг", "ад", "каля", "у наваколлі", "od") takes the genitive.
INSTRUMENTAL_PREPS = ("рядом с ",)
ACCUSATIVE_PREPS = ("по дороге в ",)
# endings whose genitive/instrumental can't be told by the ending: -ь (Гомель — Гомеля, but Сморгонь — Сморгони),
# -я (Гдыня — Гдыни/Гдыней), adjectives (Глубокое, Октябрьский), -ье/-ище, fleeting vowels (Лунинец — Лунинца,
# Новогрудок — Новогрудка)
UNSURE_ENDINGS = ("ь", "я", "ий", "ый", "ой", "ое", "ее", "ье", "ще", "ец", "ок")
CITY_WORD = {"ru": {"gen": "города", "ins": "городом", "acc": "город"}, "be": {"gen": "горада", "ins": "горадам", "acc": "горад"},
             "pl": {"gen": "miasta", "ins": "miastem", "acc": "miasto"}}
SIBILANT = set("жшчщц")


def decline_ru(name: str, case: str) -> str | None:
    """Genitive / instrumental / accusative of a one-word Russian place name, None when unsure."""
    if " " in name or "-" in name or len(name) < 3:
        return None
    low = name.lower()
    last = low[-1]
    if case == "acc":
        return name if last not in "аяи" else None  # inanimate: accusative = nominative, Лида → Лиду is left to the city form
    if low.endswith(UNSURE_ENDINGS):
        return None
    if last in "оеиыуэю":
        return name if last in "оеуэю" else None  # Гродно, Катовице stay; -и/-ы plurals are unsure
    if last == "а":
        if case == "gen":
            return name[:-1] + ("и" if low[-2] in "гкхжшчщ" else "ы")  # Лида → Лиды, Вилейка → Вилейки
        return name[:-1] + ("ей" if low[-2] in "жшчщц" else "ой")  # Лидой, Речицей, Ломжей
    if last == "й":
        return name[:-1] + ("я" if case == "gen" else "ем")
    if last.isalpha() and "а" <= last <= "я":
        if case == "gen":
            return name + "а"
        return name + ("ем" if last in SIBILANT else "ом")  # Несвиж → Несвижем, Брест → Брестом
    return None


def in_phrase(name: str, phrase: str, lang: str, rng: random.Random) -> str:
    head = phrase.split("{x}")[0].lower()
    case = "ins" if head.endswith(INSTRUMENTAL_PREPS) else "acc" if head.endswith(ACCUSATIVE_PREPS) else "gen"
    if lang == "ru" and rng.random() < 0.6:
        declined = decline_ru(name, case)
        if declined:
            return declined
    return f"{CITY_WORD[lang][case]} {name}"


# ----------------------------------------------------------------------------- descriptions

def kind_of(tags: dict) -> str | None:
    """The most specific kind: tourism=attraction rides along on castles and churches, so it names the object last."""
    for k in ("historic", "natural", "tourism"):
        if (k, tags.get(k)) in KIND_RU and tags[k] != "attraction":
            return KIND_RU[(k, tags[k])]
    if tags.get("amenity") == "place_of_worship":
        rel, den = tags.get("religion"), tags.get("denomination")
        return WORSHIP_RU.get((rel, den)) or WORSHIP_RU.get((rel, None)) or WORSHIP_RU[(None, None)]
    return KIND_RU.get(("tourism", tags.get("tourism")))


def agree(kind: str, masc: str, fem: str, plural: str) -> str:
    return plural if kind in PLURAL else fem if kind in FEMININE else masc


def describe_answer(poi: dict, rng: random.Random) -> str | None:
    tags = poi["tags"]
    kind = kind_of(tags)
    name = tags.get("name:ru") or tags.get("name")
    if not kind or not name or URL_RE.search(json.dumps(tags, ensure_ascii=False)):
        return None
    where = tags.get("addr:city") or tags.get("addr:place")
    head = f"{name} — {kind}" + (f" ({where})" if where else f" в {COUNTRY_RU[poi['country']]}") + "."  # addr:city is nominative
    facts = []
    if tags.get("ele") and re.fullmatch(r"\d{2,4}(\.\d+)?", tags["ele"]):
        facts.append(f"Высота — {int(float(tags['ele']))} м над уровнем моря.")
    if tags.get("start_date") and re.fullmatch(r"\d{4}", tags["start_date"]):
        facts.append(f"{agree(kind, 'Построен', 'Построена', 'Построены')} в {tags['start_date']} году.")
    elif tags.get("start_date") and re.fullmatch(r"C?\d{1,2}", tags["start_date"]):
        facts.append(f"Датируется {tags['start_date'].lstrip('C')} веком.")
    if tags.get("heritage"):
        facts.append("Объект под охраной как памятник наследия.")
    if tags.get("castle_type") in ("palace", "stately"):
        facts.append("По типу это скорее дворец, чем крепость.")
    if tags.get("fee") == "no":
        facts.append("Вход свободный.")
    elif tags.get("fee") == "yes":
        facts.append("Вход платный.")
    if tags.get("wheelchair") == "yes":
        facts.append("Доступно для коляски.")
    if tags.get("opening_hours") and len(tags["opening_hours"]) <= 40:
        facts.append(f"Часы работы: {tags['opening_hours']}.")
    if kind in ("кемпинг", "стоянка для автодомов"):
        if tags.get("dog") == "yes":
            facts.append("С собакой можно.")
        if tags.get("caravans") == "yes":
            facts.append("Принимают автодома.")
        if tags.get("drinking_water") == "yes":
            facts.append("Есть питьевая вода.")
    names = [f"по-белорусски — {tags['name:be']}" if tags.get("name:be") and tags["name:be"] != name else "",
             f"по-польски — {tags['name:pl']}" if tags.get("name:pl") and tags["name:pl"] != name else ""]
    names = [n for n in names if n]
    if names:
        facts.append("Название " + ", ".join(names) + ".")
    desc = tags.get("description")
    if desc and len(desc) <= 300 and not URL_RE.search(desc) and not has_external(desc):  # "Bilety: zamek.pl" is a link too
        facts.insert(0, desc.rstrip(".") + ".")
    group = next((k for k in ("tourism", "historic", "amenity", "natural") if tags.get(k)), "tourism")
    return " ".join([head] + facts[:4] + [rng.choice(CLOSERS[group])])


def tags_prompt(tags: dict) -> str:
    shown = {k: v for k, v in tags.items() if k != "wikidata"}
    return DESCRIBE_PROMPT.format(tags=json.dumps(shown, ensure_ascii=False, indent=0))


# ----------------------------------------------------------------------------- build

def build(ctx: dict, options: dict) -> list[dict]:
    n_intents = int(options.get("intents", INTENTS))
    n_describe = int(options.get("describe", DESCRIBE))
    per_country = int(options.get("centres", CENTRES))
    share = {**LANG_SHARE, **{k: float(v) for k, v in (options.get("lang_share") or {}).items()}}
    if set(share) - {"be", "pl"} or sum(share.values()) > 1.0:
        raise SystemExit(f"set osm_intents: lang_share takes be/pl with a sum ≤ 1, got {share}")

    def rec(user: str, assistant: str, kind: str, key: str, id: str) -> dict:
        return record(user, assistant, set_name=NAME, license=LICENSE, kind=kind, key=key, id=id)

    rng = random.Random(f"{ctx['seed']}:{NAME}")
    pois = load_pois(ctx["sources"])
    centres = load_centres(ctx["sources"], pois, per_country)
    out: list[dict] = []
    seen: set[str] = set()
    for n in range(n_intents):
        roll = rng.random()
        lang = "be" if roll < share["be"] else "pl" if roll < share["be"] + share["pl"] else "ru"
        q, answer, key = intent_sample(rng, lang, centres)
        if q in seen:
            continue
        seen.add(q)
        out.append(rec(INTENT_PROMPT.format(q=q), dump_filter(answer), "intent", key, f"i{n}"))
    rng.shuffle(pois)
    described = 0
    for poi in pois:
        if described >= n_describe:
            break
        answer = describe_answer(poi, rng)
        if answer:
            out.append(rec(tags_prompt(poi["tags"]), answer, "describe", f"osm:{poi['id']}", f"d:{poi['id']}"))
            described += 1
    return out


def source_info(ctx: dict) -> dict:
    from sources.common import read_meta

    return {"cache": str(ctx["sources"] / SOURCE), "meta": read_meta(ctx["sources"] / SOURCE), "schema": str(SCHEMA_PATH)}
