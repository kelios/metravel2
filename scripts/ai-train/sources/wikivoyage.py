#!/usr/bin/env python3
"""Cache Wikivoyage (CC BY-SA 4.0) guides of Belarus and Poland for the
`wikivoyage` set (#2478): every ru/pl/en Wikivoyage page about a Wikidata
item located in one of the two countries (regions, cities, towns, parks).

Per page only the body sections the set is allowed to use are kept
(understand / get in / see / do); everything else — links, sources, notes,
sleep/eat listings with their phones and URLs — is dropped here, before any
build. The kept sections stay as wikitext; `clean_wikitext()` below turns
them into plain text (listings → "Name (address; hours): description",
no URLs, phone templates and listing phones dropped) and the set module
imports it; lines with a phone, e-mail or domain left in the prose are the
set's job (sets/wikivoyage.py).

Belarus rule (scripts/content-source-denylist.json, owner 11.10.2026): a page
whose kept body mentions a denylisted outlet is excluded entirely; the list of
excluded pages goes to fetched_at.json.

Usage:
    python3 -I scripts/ai-train/sources/wikivoyage.py --ai-home ~/metravel-ai

Output: <AI_HOME>/data/sources/wikivoyage/{pages.jsonl,LICENSE,fetched_at.json}
(+ queries/*.json — the raw SPARQL page list). pages.jsonl: one object per page
{"lang","title","pageid","qid","country","revision","touched","sections":{key: wikitext}}.
"""
from __future__ import annotations

import argparse
import html
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
REPO = HERE.parents[2]
sys.path.insert(0, str(HERE.parent))
from sources.common import cache_dir, write_meta  # noqa: E402
from sources.wikidata import COUNTRIES, UA, qid, sparql, value  # noqa: E402

NAME = "wikivoyage"
LICENSE = "CC BY-SA 4.0 (Wikivoyage contributors); answers carry the marker «по открытым данным», no URLs"
LANGS = ("ru", "pl", "en")
DENYLIST = REPO / "scripts" / "content-source-denylist.json"
TITLES_PER_REQUEST = 50
# H2 headings → section key; anything else is dropped at the source
SECTIONS = {
    "ru": {"понять": "understand", "как добраться": "get_in", "достопримечательности": "see", "чем заняться": "do"},
    "pl": {"charakterystyka": "understand", "dojazd": "get_in", "atrakcje": "see", "warto zobaczyć": "see",
           "rozrywka": "do", "aktywny wypoczynek": "do", "aktywności": "do"},
    "en": {"understand": "understand", "get in": "get_in", "see": "see", "do": "do"},
}
HEADING_RE = re.compile(r"^(={2,6})\s*(.*?)\s*=+\s*$", re.M)
LISTING_TEMPLATES = {"listing", "see", "do", "buy", "eat", "drink", "sleep", "go", "vcard", "marker", "zobacz", "atrakcja", "znacznik"}
LISTING_DESCRIPTION = ("content", "description", "opis", "treść", "dodatkowe informacje", "informacje")
LISTING_HOURS = ("hours", "godziny otwarcia", "godziny")
LISTING_PRICE = ("price", "cena")
URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)
# inline templates kept as text, by their positional parameters ({{lang|be|Мінск}}, {{km|12}}, {{Белорусская трасса|М|1}})
INLINE_TEMPLATES = {
    "lang": lambda p: p[-1], "nobr": lambda p: p[-1], "nowrap": lambda p: p[-1], "iata": lambda p: p[0],
    "km": lambda p: f"{p[0]} km", "convert": lambda p: " ".join(p[:2]),
    "road": lambda p: p[-1], "european road": lambda p: "".join(p[1:]), "белорусская трасса": lambda p: "".join(p),
}
MEDIA_NS = r"(?:File|Image|Файл|Изображение|Plik|Grafika|Category|Категория|Kategoria):"
MEDIA_LINK_RE = re.compile(r"\[\[" + MEDIA_NS + r"[^\[\]]*\]\]", re.I)
# innermost links only, so a caption with a link ([[File:x.jpg|thumb|Square in [[Minsk]]]]) unwinds from the inside
PIPED_LINK_RE = re.compile(r"\[\[(?!" + MEDIA_NS + r")[^\[\]|]*\|([^\[\]]*)\]\]", re.I)
PLAIN_LINK_RE = re.compile(r"\[\[(?!" + MEDIA_NS + r")([^\[\]|]*)\]\]", re.I)
TABLE_RE = re.compile(r"^\{\|.*?^\|\}", re.S | re.M)


# ----------------------------------------------------------------------------- page list

def pages_query(country_qid: str, lang: str) -> str:
    return f"""
SELECT ?item ?article WHERE {{
  ?article schema:about ?item ; schema:isPartOf <https://{lang}.wikivoyage.org/> .
  ?item wdt:P17 wd:{country_qid} .
}}
"""


def list_pages(pause: float, cache: Path, countries: dict[str, str], langs: tuple[str, ...]) -> list[dict]:
    pages = []
    for code, cq in countries.items():
        for lang in langs:
            data = sparql(pages_query(cq, lang), pause, cache)
            for b in data["results"]["bindings"]:
                title = urllib.parse.unquote(value(b, "article").rsplit("/", 1)[-1]).replace("_", " ")
                pages.append({"lang": lang, "title": title, "qid": qid(value(b, "item")), "country": code})
            print(f"{code} {lang}: {len(data['results']['bindings'])} pages", file=sys.stderr)
    seen, unique = set(), []
    for p in pages:
        if (p["lang"], p["title"]) not in seen:
            seen.add((p["lang"], p["title"]))
            unique.append(p)
    return unique


# ----------------------------------------------------------------------------- wikitext

def template_spans(text: str) -> list[tuple[int, int]]:
    """Top-level {{…}} spans, nesting respected."""
    spans, depth, start = [], 0, 0
    i = 0
    while i < len(text) - 1:
        two = text[i:i + 2]
        if two == "{{":
            if depth == 0:
                start = i
            depth += 1
            i += 2
        elif two == "}}" and depth:
            depth -= 1
            i += 2
            if depth == 0:
                spans.append((start, i))
        else:
            i += 1
    return spans


def split_params(body: str) -> tuple[str, dict[str, str]]:
    """'see | name=X | content=Y' → ('see', {'name': 'X', 'content': 'Y'}); '|' inside nested {{ }} or [[ ]] is kept;
    unnamed parameters get MediaWiki's keys '1', '2', … ('lang|be|Мінск' → {'1': 'be', '2': 'Мінск'})."""
    parts, depth, cur = [], 0, []
    i = 0
    while i < len(body):
        two = body[i:i + 2]
        if two in ("{{", "[["):
            depth += 1
            cur.append(two)
            i += 2
        elif two in ("}}", "]]"):
            depth = max(0, depth - 1)
            cur.append(two)
            i += 2
        elif body[i] == "|" and depth == 0:
            parts.append("".join(cur))
            cur = []
            i += 1
        else:
            cur.append(body[i])
            i += 1
    parts.append("".join(cur))
    name = parts[0].strip().lower()
    params, n = {}, 0
    for p in parts[1:]:
        k, eq, v = p.partition("=")
        if eq:
            params[k.strip().lower()] = v.strip()
        else:
            n += 1
            params[str(n)] = p.strip()
    return name, params


def first(params: dict[str, str], keys: tuple[str, ...]) -> str:
    for k in keys:
        if params.get(k):
            return params[k]
    return ""


def render_listing(params: dict[str, str]) -> str:
    name = params.get("name") or params.get("nazwa") or params.get("1") or ""  # {{Znacznik|Name|lat|lon}}
    if not name:
        return ""
    bits = [name]
    if params.get("alt"):
        bits[0] += f" ({params['alt']})"
    where = ", ".join(v for v in (first(params, ("address", "adres")), first(params, ("directions", "wskazówki"))) if v)
    extras = [x for x in (where, first(params, LISTING_HOURS), first(params, LISTING_PRICE)) if x]
    head = bits[0] + (f" ({'; '.join(extras)})" if extras else "")
    desc = first(params, LISTING_DESCRIPTION)
    return f"{head}: {desc}" if desc else head


def render_hours(body: str) -> str:
    """{{hours|Пн|Пт|10|00|18|00}} → "Пн–Пт 10:00–18:00"; {{hours|||10||18}} → "10:00–18:00"."""
    parts = [p.strip() for p in body.split("|")][1:]
    parts += [""] * (6 - len(parts))
    d1, d2, h1, m1, h2, m2 = parts[:6]
    days = f"{d1}–{d2}" if d1 and d2 else d1 or d2
    span = f"{h1}:{m1 or '00'}–{h2}:{m2 or '00'}" if h1 and h2 else ""
    return " ".join(x for x in (days, span) if x)


def strip_templates(text: str, title: str = "") -> str:
    """Replace top-level {{…}} spans from the end: listings rendered (and cleaned again,
    their parameters carry nested {{hours}}), a few inline templates kept, the rest dropped."""
    for start, end in reversed(template_spans(text)):
        body = text[start + 2:end - 2]
        name, params = split_params(body)
        base = name.split()[0] if name else ""
        positional = [v for k, v in params.items() if k.isdigit()]
        if base in LISTING_TEMPLATES:
            rendered = strip_templates(render_listing(params), title)
        elif base == "hours":
            rendered = render_hours(body)
        elif name in INLINE_TEMPLATES:
            rendered = INLINE_TEMPLATES[name](positional) if positional else ""
        elif name == "pagename":
            rendered = title
        else:
            rendered = ""
        text = text[:start] + rendered + text[end:]
    return text


def clean_wikitext(text: str, title: str = "") -> str:
    """Plain text of a kept section: listings rendered, other templates dropped ({{PAGENAME}} → title),
    tables and galleries dropped, links to their visible text, no URLs/refs/comments/images."""
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"<ref[^>/]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"<gallery[^>]*>.*?</gallery>", "", text, flags=re.S | re.I)
    text = strip_templates(text, title)
    text = TABLE_RE.sub("", text)
    for _ in range(5):
        before = text
        text = PLAIN_LINK_RE.sub(r"\1", PIPED_LINK_RE.sub(r"\1", MEDIA_LINK_RE.sub("", text)))
        if text == before:
            break
    text = re.sub(r"\[(?:https?:)?//\S+\s+([^\]]*)\]", r"\1", text)
    text = re.sub(r"\[(?:https?:)?//\S+\]", "", text)
    text = URL_RE.sub("", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"'{2,}", "", text)
    text = HEADING_RE.sub(lambda m: f"\n{m.group(2)}:\n", text)
    text = re.sub(r"^[*#:;]+\s*", "• ", text, flags=re.M)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\(\s*;\s*", "(", text)
    text = re.sub(r"\s*;\s*\)", ")", text)
    text = re.sub(r" ?\( ?\)", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # a sub-heading whose body was only templates ("Samochodem:" right before "Pociągiem:") says nothing
    for _ in range(3):
        text = re.sub(r"^[^\n]{1,60}:\n+(?=[^\n]{1,60}:\n|\Z)", "", text, flags=re.M)
    return text.strip()


def kept_sections(wikitext: str, lang: str) -> dict[str, str]:
    """{section key: wikitext of its H2 section}; H3+ inside stay, other H2 sections are dropped."""
    out: dict[str, str] = {}
    headings = [(m.start(), m.end(), len(m.group(1)), m.group(2).strip().lower()) for m in HEADING_RE.finditer(wikitext)]
    h2 = [h for h in headings if h[2] == 2]
    for n, (start, end, _, title) in enumerate(h2):
        key = SECTIONS[lang].get(title)
        if not key:
            continue
        stop = h2[n + 1][0] if n + 1 < len(h2) else len(wikitext)
        body = wikitext[end:stop].strip()
        if body:
            out[key] = (out[key] + "\n\n" + body) if key in out else body
    return out


# ----------------------------------------------------------------------------- denylist

def denylist_patterns(path: Path = DENYLIST) -> list[tuple[str, re.Pattern]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [(p["id"], re.compile(p["regex"], re.I | re.U)) for p in data["patterns"]]


def denylist_hits(text: str, patterns: list[tuple[str, re.Pattern]]) -> list[str]:
    return sorted({pid for pid, rx in patterns if rx.search(text)})


# ----------------------------------------------------------------------------- fetch

def api_get(lang: str, params: dict, pause: float, retries: int = 5) -> dict:
    url = f"https://{lang}.wikivoyage.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    delay = pause
    for attempt in range(retries):
        time.sleep(delay)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            if attempt == retries - 1:
                raise
            delay = max(5.0, delay * 2)
            print(f"{lang} api {exc}, retry in {delay:.0f}s", file=sys.stderr)
    raise RuntimeError("unreachable")


def fetch_pages(pages: list[dict], out: Path, pause: float, patterns) -> dict:
    """Append kept sections of every page to pages.jsonl (resumes), return counts and the excluded list.
    A sitelink that is a redirect is skipped: the target is another item's page (Leninski → Brest Oblast,
    a German Land, "Rail travel in Europe") or comes under its own sitelink anyway."""
    path = out / "pages.jsonl"
    done = set()
    if path.exists():
        for line in path.open(encoding="utf-8"):
            row = json.loads(line)
            done.add((row["lang"], row["title"]))
    excluded: list[dict] = []
    counts = {"pages": len(done), "no_sections": 0, "missing": 0, "redirects": 0}
    with path.open("a", encoding="utf-8") as fh:
        for lang in LANGS:
            todo = [p for p in pages if p["lang"] == lang and (lang, p["title"]) not in done]
            for n in range(0, len(todo), TITLES_PER_REQUEST):
                batch = todo[n:n + TITLES_PER_REQUEST]
                by_title = {p["title"]: p for p in batch}
                data = api_get(lang, {"action": "query", "prop": "revisions|info", "rvprop": "content|timestamp|ids", "rvslots": "main",
                                      "redirects": "1", "titles": "|".join(by_title)}, pause)
                counts["redirects"] += len(data["query"].get("redirects", []))
                for page in data["query"]["pages"]:
                    source = by_title.get(page["title"])
                    if not source:  # reached through a redirect
                        continue
                    if "revisions" not in page:
                        counts["missing"] += 1
                        continue
                    rev = page["revisions"][0]
                    sections = kept_sections(rev["slots"]["main"]["content"], lang)
                    if not sections:
                        counts["no_sections"] += 1
                        continue
                    hits = denylist_hits("\n".join(sections.values()), patterns)
                    if hits:
                        excluded.append({"lang": lang, "title": page["title"], "hits": hits})
                        continue
                    row = {"lang": lang, "title": page["title"], "pageid": page["pageid"], "qid": source["qid"], "country": source["country"],
                           "revision": rev["revid"], "touched": rev["timestamp"], "sections": sections}
                    fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                    counts["pages"] += 1
                fh.flush()
                print(f"{lang}: {min(n + TITLES_PER_REQUEST, len(todo))}/{len(todo)} fetched, {len(excluded)} excluded", file=sys.stderr)
    counts["excluded"] = len(excluded)
    return {"counts": counts, "excluded": excluded}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ai-home", default=None, help="training folder (default: $AI_HOME)")
    ap.add_argument("--pause", type=float, default=1.0, help="seconds between requests")
    ap.add_argument("--langs", default=",".join(LANGS), help="subset of ru,pl,en")
    ap.add_argument("--countries", default="BY,PL", help="subset of BY,PL")
    args = ap.parse_args()
    home = Path(args.ai_home or os.environ.get("AI_HOME") or ".").expanduser()
    out = cache_dir(home / "data" / "sources", NAME)
    cache = out / "queries"
    cache.mkdir(exist_ok=True)
    langs = tuple(l for l in args.langs.split(",") if l in LANGS)
    countries = {c: COUNTRIES[c] for c in args.countries.split(",") if c}

    pages = list_pages(args.pause, cache, countries, langs)
    (out / "pages_list.json").write_text(json.dumps(pages, ensure_ascii=False) + "\n", encoding="utf-8")
    result = fetch_pages(pages, out, args.pause, denylist_patterns())
    meta = write_meta(out, license=LICENSE, origin="https://{ru,pl,en}.wikivoyage.org/w/api.php (page list: Wikidata sitelinks)",
                      extra={**result, "sections": sorted({v for m in SECTIONS.values() for v in m.values()}), "denylist": str(DENYLIST.relative_to(REPO))})
    print(json.dumps({k: v for k, v in meta.items() if k != "excluded"}, ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
