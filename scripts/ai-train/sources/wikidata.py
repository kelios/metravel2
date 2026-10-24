#!/usr/bin/env python3
"""Cache Wikidata (CC0) places of Belarus and Poland for the `toponyms` set
(#2477): settlements, monuments and nature objects with their names in
ru/be/uk/pl/en, type (P31), administrative unit (P131, with the chain up to the
country), coordinates (P625), heritage status (P1435), elevation (P2044) and
population (P1082).

Three passes over the SPARQL endpoint, every response cached, so an
interrupted run resumes and a rebuild never touches the network:

1. items   — one query per (country, group) with the group's classes and a
             sitelinks floor (villages without any Wikipedia article are
             noise for a language model);
2. labels  — labels and aliases of the items in batches (VALUES);
3. units   — the administrative units and types the items refer to: labels,
             their own P31 and P131, followed upwards until the country.

Usage:
    python3 -I scripts/ai-train/sources/wikidata.py --ai-home ~/metravel-ai

Output: <AI_HOME>/data/sources/wikidata/{items.jsonl,entities.json,LICENSE,fetched_at.json}
(+ queries/*.json — the raw responses). items.jsonl: one object per QID
{"qid","country","group","sitelinks","types":[qid],"regions":[qid],
 "heritage":[qid],"coord":[lat,lon]|null,"population","elevation","inception",
 "labels":{lang: str},"aliases":{lang: [str]}}; entities.json: {qid: {"labels",
 "types", "regions"}} for every type, region and heritage status.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from sources.common import cache_dir, write_meta  # noqa: E402

NAME = "wikidata"
LICENSE = "CC0 1.0 (Wikidata)"
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "metravel-ai-train/1.0 (https://metravel.by; dataset build, see scripts/ai-train/README.md)"
LANGS = ("ru", "be", "uk", "pl", "en")
COUNTRIES = {"BY": "Q184", "PL": "Q36"}
# sitelinks floor per country: Poland has ~50 k villages on Wikidata, Belarus ~25 k
SITELINKS_MIN = {"BY": 2, "PL": 3}
# Settlements of both countries are typed with country-specific classes
# ("город районного подчинения", "село в Польше"), not with the generic
# city/town/village — the generic ones alone give 16 Belarusian settlements.
GROUPS = {
    "settlement": [
        "Q515",       # city
        "Q3957",      # town
        "Q7930989",   # city/town
        "Q1549591",   # big city
        "Q2514025",   # urban-type settlement
        "Q79323854",  # город областного подчинения (BY)
        "Q79324274",  # город районного подчинения (BY)
        "Q91733160",  # городской посёлок (BY)
        "Q1989945",   # агрогородок (BY)
        "Q65665664",  # посёлок в Беларуси
        "Q65661087",  # деревня в Беларуси
        "Q925381",    # city with powiat rights (PL)
        "Q13416557",  # royal city in the Polish–Lithuanian Commonwealth
        "Q138845716", # settlement in Poland with a Kashubian name
        "Q486972",    # human settlement
        "Q3558970",   # село в Польше
        "Q532",       # village
        "Q5084",      # hamlet
    ],
    "monument": [
        "Q23413",     # castle
        "Q16560",     # palace
        "Q1802963",   # mansion
        "Q879050",    # manor house
        "Q44613",     # monastery
        "Q16970",     # church building
        "Q2031836",   # Orthodox church
        "Q1088552",   # Catholic church (костёл)
        "Q744296",    # wooden church
        "Q2977",      # cathedral
        "Q34627",     # synagogue
        "Q32815",     # mosque
        "Q57821",     # fortification
        "Q839954",    # archaeological site
        "Q4989906",   # monument
        "Q5003624",   # memorial
        "Q12518",     # tower
        "Q570116",    # tourist attraction
        "Q1200957",   # tourist attraction (PL typing)
        "Q811165",    # architectural heritage monument (PL)
        "Q33506",     # museum
        "Q1081138",   # historic site
    ],
    "nature": [
        "Q23397",     # lake
        "Q131681",    # reservoir
        "Q8502",      # mountain
        "Q46831",     # mountain range
        "Q54050",     # hill
        "Q46169",     # national park
        "Q179049",    # nature reserve
        "Q4433777",   # заказник Белоруссии
        "Q6576413",   # landscape park (PL)
        "Q2042028",   # protected landscape area (PL)
        "Q473972",    # protected area
        "Q22698",     # park
        "Q4421",      # forest
        "Q4022",      # river
        "Q35509",     # cave
    ],
}
# classes with tens of thousands of members get their own, higher floor
CLASS_MIN = {"Q65661087": 6, "Q65665664": 5, "Q3558970": 8, "Q486972": 5, "Q532": 5, "Q5084": 5, "Q4022": 4, "Q16970": 3, "Q2031836": 3, "Q1088552": 3}
BATCH = 150
# country-level units stop the climb up P131
STOP_UNITS = set(COUNTRIES.values())
QID_RE = re.compile(r"Q\d+$")


def sparql(query: str, pause: float, cache: Path, retries: int = 6) -> dict:
    key = hashlib.sha1(query.encode("utf-8")).hexdigest()[:16]
    cached = cache / f"{key}.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    body = urllib.parse.urlencode({"query": query, "format": "json"}).encode("utf-8")
    delay = pause
    for attempt in range(retries):
        time.sleep(delay)
        req = urllib.request.Request(ENDPOINT, data=body, headers={
            "User-Agent": UA, "Accept": "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded",
        })
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            cached.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            return data
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                delay = float(retry_after) if retry_after and retry_after.isdigit() else max(5.0, delay * 2)
                print(f"sparql HTTP {exc.code}, retry in {delay:.0f}s", file=sys.stderr)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt < retries - 1:
                delay = max(5.0, delay * 2)
                print(f"sparql {exc}, retry in {delay:.0f}s", file=sys.stderr)
                continue
            raise
    raise RuntimeError("unreachable")


def qid(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def value(binding: dict, name: str):
    return binding[name]["value"] if name in binding else None


def items_query(country_qid: str, classes: list[str], min_sitelinks: int) -> str:
    """Cheap: items of the classes with their P31 list; the properties come in details_query batches
    (one query with six OPTIONALs over every object of a country times out at the 60 s gateway)."""
    values = " ".join(f"wd:{c}" for c in classes)
    return f"""
SELECT ?item ?sl (GROUP_CONCAT(DISTINCT ?type; separator="|") AS ?types) WHERE {{
  VALUES ?cls {{ {values} }}
  ?item wdt:P31 ?cls ; wdt:P17 wd:{country_qid} ; wikibase:sitelinks ?sl .
  FILTER(?sl >= {min_sitelinks})
  ?item wdt:P31 ?type .
}}
GROUP BY ?item ?sl
"""


def details_query(qids: list[str]) -> str:
    """Only SAMPLE aggregates: MAX(?pop) / MIN(?inc) over 150 items make Blazegraph throw StackOverflowError (HTTP 500)."""
    values = " ".join(f"wd:{q}" for q in qids)
    return f"""
SELECT ?item (SAMPLE(?coord) AS ?coord) (SAMPLE(?pop) AS ?pop) (SAMPLE(?ele) AS ?ele) (SAMPLE(?inc) AS ?inc)
       (GROUP_CONCAT(DISTINCT ?region; separator="|") AS ?regions)
       (GROUP_CONCAT(DISTINCT ?heritage; separator="|") AS ?heritages)
WHERE {{
  VALUES ?item {{ {values} }}
  OPTIONAL {{ ?item wdt:P131 ?region }}
  OPTIONAL {{ ?item wdt:P1435 ?heritage }}
  OPTIONAL {{ ?item wdt:P625 ?coord }}
  OPTIONAL {{ ?item wdt:P1082 ?pop }}
  OPTIONAL {{ ?item wdt:P2044 ?ele }}
  OPTIONAL {{ ?item wdt:P571 ?inc }}
}}
GROUP BY ?item
"""


def labels_query(qids: list[str], with_aliases: bool) -> str:
    values = " ".join(f"wd:{q}" for q in qids)
    langs = ", ".join(f'"{l}"' for l in LANGS)
    alias = f"UNION {{ ?item skos:altLabel ?label . BIND(true AS ?alt) }}" if with_aliases else ""
    return f"""
SELECT ?item ?label ?alt WHERE {{
  VALUES ?item {{ {values} }}
  {{ ?item rdfs:label ?label }} {alias}
  FILTER(LANG(?label) IN ({langs}))
}}
"""


def units_query(qids: list[str]) -> str:
    values = " ".join(f"wd:{q}" for q in qids)
    return f"""
SELECT ?item (GROUP_CONCAT(DISTINCT ?type; separator="|") AS ?types) (GROUP_CONCAT(DISTINCT ?up; separator="|") AS ?ups) WHERE {{
  VALUES ?item {{ {values} }}
  OPTIONAL {{ ?item wdt:P31 ?type }}
  OPTIONAL {{ ?item wdt:P131 ?up }}
}}
GROUP BY ?item
"""


def parse_point(text: str | None) -> list[float] | None:
    if not text:
        return None
    m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", text)  # lon lat
    return [round(float(m.group(2)), 5), round(float(m.group(1)), 5)] if m else None


def split_qids(text: str | None) -> list[str]:
    return [qid(u) for u in (text or "").split("|") if u]


def fetch_items(pause: float, cache: Path, groups: dict[str, list[str]], countries: dict[str, str], top: int) -> dict[str, dict]:
    """Items of every (country, group), the `top` by sitelinks kept, then their properties in batches."""
    items: dict[str, dict] = {}
    for code, cq in countries.items():
        for group, classes in groups.items():
            # one class per query: a union of twenty classes over Poland hits the 60 s gateway timeout
            rows = []
            for c in classes:
                rows += sparql(items_query(cq, [c], max(SITELINKS_MIN[code], CLASS_MIN.get(c, 0))), pause, cache)["results"]["bindings"]
            print(f"{code} {group}: {len(rows)} rows", file=sys.stderr)
            for b in rows:
                q = qid(value(b, "item"))
                types = split_qids(value(b, "types"))
                if q in items:  # an item may fall into two groups (a park that is a monument)
                    items[q]["types"] = sorted(set(items[q]["types"]) | set(types))
                    continue
                items[q] = {"qid": q, "country": code, "group": group, "sitelinks": int(value(b, "sl") or 0), "types": types,
                            "regions": [], "heritage": [], "coord": None, "population": None, "elevation": None,
                            "inception": None, "labels": {}, "aliases": {}}
    kept: dict[str, dict] = {}
    for code in countries:
        for group in groups:
            ranked = sorted((it for it in items.values() if it["country"] == code and it["group"] == group),
                            key=lambda it: (-it["sitelinks"], int(it["qid"][1:])))
            kept.update({it["qid"]: it for it in ranked[:top]})
            print(f"{code} {group}: {len(ranked)} items, {min(top, len(ranked))} kept", file=sys.stderr)
    items = kept
    qids = sorted(items)
    for n in range(0, len(qids), BATCH):
        data = sparql(details_query(qids[n:n + BATCH]), pause, cache)
        for b in data["results"]["bindings"]:
            it = items[qid(value(b, "item"))]
            inc = value(b, "inc")
            it.update({
                "regions": split_qids(value(b, "regions")), "heritage": split_qids(value(b, "heritages")),
                "coord": parse_point(value(b, "coord")),
                "population": int(float(value(b, "pop"))) if value(b, "pop") else None,
                "elevation": round(float(value(b, "ele"))) if value(b, "ele") else None,
                "inception": inc[:4] if inc and inc[:4].isdigit() else None,
            })
        print(f"details {min(n + BATCH, len(qids))}/{len(qids)}", file=sys.stderr)
    return items


def fetch_labels(qids: list[str], pause: float, cache: Path, with_aliases: bool) -> dict[str, dict]:
    """{qid: {"labels": {lang: label}, "aliases": {lang: [..]}}}"""
    out: dict[str, dict] = {}
    for n in range(0, len(qids), BATCH):
        batch = qids[n:n + BATCH]
        data = sparql(labels_query(batch, with_aliases), pause, cache)
        for b in data["results"]["bindings"]:
            q = qid(value(b, "item"))
            lang = b["label"].get("xml:lang")
            text = value(b, "label")
            if not lang or not text:
                continue
            ent = out.setdefault(q, {"labels": {}, "aliases": {}})
            if value(b, "alt"):
                ent["aliases"].setdefault(lang, [])
                if text not in ent["aliases"][lang]:
                    ent["aliases"][lang].append(text)
            else:
                ent["labels"][lang] = text
        print(f"labels {min(n + BATCH, len(qids))}/{len(qids)}", file=sys.stderr)
    return out


def fetch_units(start: set[str], pause: float, cache: Path, max_hops: int = 5) -> dict[str, dict]:
    """Administrative units up the P131 chain (and types of everything), with labels."""
    units: dict[str, dict] = {}
    frontier = sorted(q for q in start if QID_RE.match(q) and q not in STOP_UNITS)
    for hop in range(max_hops):
        if not frontier:
            break
        next_frontier: set[str] = set()
        for n in range(0, len(frontier), BATCH):
            batch = frontier[n:n + BATCH]
            data = sparql(units_query(batch), pause, cache)
            for b in data["results"]["bindings"]:
                q = qid(value(b, "item"))
                units[q] = {"types": split_qids(value(b, "types")), "regions": split_qids(value(b, "ups"))}
                next_frontier.update(units[q]["types"])
                next_frontier.update(units[q]["regions"])
        frontier = sorted(q for q in next_frontier if q not in units and q not in STOP_UNITS)
        print(f"units hop {hop}: {len(units)} known, {len(frontier)} next", file=sys.stderr)
    for q in STOP_UNITS:
        units.setdefault(q, {"types": [], "regions": []})
    labels = fetch_labels(sorted(units), pause, cache, with_aliases=False)
    for q, ent in units.items():
        ent["labels"] = labels.get(q, {}).get("labels", {})
    return units


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ai-home", default=None, help="training folder (default: $AI_HOME)")
    ap.add_argument("--pause", type=float, default=1.5, help="seconds between SPARQL requests")
    ap.add_argument("--countries", default="BY,PL", help="subset of BY,PL (smoke run)")
    ap.add_argument("--groups", default=",".join(GROUPS), help="subset of settlement,monument,nature")
    ap.add_argument("--top", type=int, default=3000, help="items kept per country and group, by sitelinks")
    args = ap.parse_args()
    home = Path(args.ai_home or os.environ.get("AI_HOME") or ".").expanduser()
    out = cache_dir(home / "data" / "sources", NAME)
    cache = out / "queries"
    cache.mkdir(exist_ok=True)
    countries = {c: COUNTRIES[c] for c in args.countries.split(",") if c}
    groups = {g: GROUPS[g] for g in args.groups.split(",") if g}

    items = fetch_items(args.pause, cache, groups, countries, args.top)
    labels = fetch_labels(sorted(items), args.pause, cache, with_aliases=True)
    for q, it in items.items():
        it.update(labels.get(q, {"labels": {}, "aliases": {}}))
    referenced = {q for it in items.values() for q in it["types"] + it["regions"] + it["heritage"]}
    entities = fetch_units(referenced, args.pause, cache)

    with (out / "items.jsonl").open("w", encoding="utf-8") as fh:
        for q in sorted(items, key=lambda k: int(k[1:])):
            fh.write(json.dumps(items[q], ensure_ascii=False) + "\n")
    (out / "entities.json").write_text(json.dumps(entities, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    counts = {"items": len(items), "entities": len(entities)}
    for code in countries:
        for group in groups:
            counts[f"{code}_{group}"] = sum(1 for it in items.values() if it["country"] == code and it["group"] == group)
    for lang in LANGS:
        counts[f"label_{lang}"] = sum(1 for it in items.values() if lang in it["labels"])
    meta = write_meta(out, license=LICENSE, origin=ENDPOINT, extra={
        "counts": counts, "sitelinks_min": SITELINKS_MIN, "class_min": CLASS_MIN, "top": args.top, "groups": groups, "countries": countries,
    })
    print(json.dumps(meta, ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
