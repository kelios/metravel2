"""Set `wikivoyage`: general knowledge about the towns and regions of Belarus
and Poland from the Wikivoyage cache (sources/wikivoyage.py →
<AI_HOME>/data/sources/wikivoyage/pages.jsonl), CC BY-SA, so every answer
opens with the open-data marker and carries no URL.

Why: asked about a town the site has no article about, v1 either invents our
materials or answers in generalities. These samples teach the fallback: say
what is known about the place from open data, in the language of the
question, without links.

Kinds, one per kept section of a page (ru/pl/en pages → questions and
answers in that language):

* understand — "Расскажи о X — что это за город?" → the "Понять" section;
* see        — "Что посмотреть в X?" → "Достопримечательности";
* get_in     — "Как добраться до X?" → "Как добраться";
* do         — "Чем заняться в X?" → "Чем заняться".

A long section becomes up to `max_chunks` samples of `max_chars` each (the
second asks "что ещё…"). Key is the Wikidata QID of the place, shared with
the `toponyms` set, so a town stays on one side of the split in both.

No contacts in the answers: a line with a URL, an e-mail, a phone number or
another site's domain ("aeroBUS.pl") is dropped; a page whose cleaned text
hits scripts/content-source-denylist.json is skipped (again — the source
scanned it at fetch time, a newer denylist applies here without a refetch).
Pages that the cache reached through a redirect sitelink are left out.

Options (mixes/*.yaml → sets.wikivoyage.options):
  langs       — page languages (default ru, pl, en);
  max_chars   — answer body per sample (default 1800);
  max_chunks  — samples per section (default 2);
  min_chars   — sections shorter than this are skipped (default 200).
"""
from __future__ import annotations

import json
import random
import re
from pathlib import Path

from sets.common import record
from sets.translations import has_external
from sources.wikivoyage import clean_wikitext, denylist_hits, denylist_patterns

NAME = "wikivoyage"
LICENSE = "CC BY-SA 4.0 (Wikivoyage contributors), answers marked «по открытым данным», no URLs"
SOURCE = "wikivoyage"
LANGS = ("ru", "pl", "en")
MAX_CHARS = 1800
MAX_CHUNKS = 2
MIN_CHARS = 200
MARKER = {"ru": "По открытым данным: ", "pl": "Według otwartych danych: ", "en": "From open data: "}
ASK = {
    "ru": {
        "understand": ("Расскажи о {x} — что это за город?", "Что известно о {x}?", "{x} — что это за место?"),
        "see": ("Что посмотреть в {x}?", "Какие достопримечательности есть в {x}?", "Что стоит увидеть в {x}?"),
        "get_in": ("Как добраться до {x}?", "Как доехать в {x}?", "Чем удобнее добираться до {x}?"),
        "do": ("Чем заняться в {x}?", "Что делать в {x} кроме осмотра достопримечательностей?", "Какие развлечения есть в {x}?"),
    },
    "pl": {
        "understand": ("Opowiedz o {x} — co to za miejsce?", "Co wiadomo o {x}?"),
        "see": ("Co warto zobaczyć w {x}?", "Jakie atrakcje ma {x}?"),
        "get_in": ("Jak dojechać do {x}?", "Jak dostać się do {x}?"),
        "do": ("Co robić w {x}?", "Jakie rozrywki oferuje {x}?"),
    },
    "en": {
        "understand": ("Tell me about {x} — what kind of place is it?", "What is {x} known for?"),
        "see": ("What is there to see in {x}?", "What are the sights of {x}?"),
        "get_in": ("How do I get to {x}?", "What is the best way to reach {x}?"),
        "do": ("What is there to do in {x}?", "Any activities in {x}?"),
    },
}
MORE = {"ru": "Что ещё {verb} в {x}?", "pl": "Co jeszcze {verb} w {x}?", "en": "What else {verb} in {x}?"}
MORE_VERB = {
    "ru": {"see": "посмотреть", "do": "можно делать", "understand": "известно о городе", "get_in": "сказать о дороге"},
    "pl": {"see": "warto zobaczyć", "do": "można robić", "understand": "wiadomo o mieście", "get_in": "o dojeździe"},
    "en": {"see": "to see", "do": "to do", "understand": "to know", "get_in": "about getting there"},
}
TITLE_NOTE_RE = re.compile(r"\s*\([^)]*\)$")
URL_RE = re.compile(r"https?://|www\.", re.I)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# "+48 55 233 44 10", "tel. 41 366 15 00", "(062) 736-25-44", "703-403-358", "44 732 36 63"; a bare digit run
# without these shapes is as often a year range, a distance or a volume ("67 181 500 m³") and stays
PHONE_RE = re.compile(
    r"\+\d[\d\s().-]{6,}\d|\b(?:tel|phone|telefon|тел|тэл)\b\.?\s*[:\-–]?\s*\(?\d|\(0?\d{2}\)\s?\d{3}"
    r"|\b\d{3}-\d{3}-\d{3}\b|\b\d{2} \d{3} \d{2} \d{2}\b",
    re.I,
)


def load_cache(sources_root: Path) -> list[dict]:
    """Pages of the cache, one per (lang, pageid), only under their own sitelink (pages_list.json):
    caches fetched before the redirect fix also hold the targets of redirect sitelinks under the wrong QID."""
    root = sources_root / SOURCE
    path = root / "pages.jsonl"
    if not path.exists():
        raise SystemExit("set wikivoyage needs the Wikivoyage cache: run sources/wikivoyage.py first")
    listed_path = root / "pages_list.json"
    listed = {(p["lang"], p["title"]): p["qid"] for p in json.loads(listed_path.read_text(encoding="utf-8"))} if listed_path.exists() else None
    pages: dict[tuple[str, int], dict] = {}
    for line in path.open(encoding="utf-8"):
        page = json.loads(line)
        if listed is not None and listed.get((page["lang"], page["title"])) != page.get("qid"):
            continue
        pages.setdefault((page["lang"], page["pageid"]), page)
    return list(pages.values())


def without_contacts(text: str) -> str:
    """The text without the lines that carry a URL, an e-mail, a phone or another site's domain."""
    return "\n".join(line for line in text.split("\n")
                     if not (URL_RE.search(line) or EMAIL_RE.search(line) or PHONE_RE.search(line) or has_external(line)))


def chunks(text: str, size: int, limit: int) -> list[str]:
    """Up to `limit` pieces of ≤ size characters, cut at paragraph or line breaks."""
    out, cur = [], ""
    for para in re.split(r"\n(?=\S)", text):
        para = para.strip()
        if not para:
            continue
        if len(para) > size:
            para = para[:size].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"
        if cur and len(cur) + len(para) + 1 > size:
            out.append(cur)
            cur = ""
            if len(out) == limit:
                break
        cur = f"{cur}\n{para}" if cur else para
    if cur and len(out) < limit:
        out.append(cur)
    return out


def display_title(title: str) -> str:
    return TITLE_NOTE_RE.sub("", title).strip()


def build(ctx: dict, options: dict) -> list[dict]:
    langs = tuple(options.get("langs") or LANGS)
    unknown = sorted(set(langs) - set(LANGS))
    if unknown:
        raise SystemExit(f"set wikivoyage: unknown langs {unknown}, expected some of {list(LANGS)}")
    max_chars = int(options.get("max_chars", MAX_CHARS))
    max_chunks = int(options.get("max_chunks", MAX_CHUNKS))
    min_chars = int(options.get("min_chars", MIN_CHARS))

    def rec(user: str, assistant: str, kind: str, key: str, id: str) -> dict:
        return record(user, assistant, set_name=NAME, license=LICENSE, kind=kind, key=key, id=id)

    rng = random.Random(f"{ctx['seed']}:{NAME}")
    patterns = denylist_patterns()
    out: list[dict] = []
    for page in sorted(load_cache(ctx["sources"]), key=lambda p: (p["lang"], p["title"])):
        lang = page["lang"]
        if lang not in langs:
            continue
        x = display_title(page["title"])
        key = f"wd:{page['qid']}" if page.get("qid") else f"wv:{lang}:{page['title']}"
        texts = {section: without_contacts(clean_wikitext(wikitext, x)) for section, wikitext in page["sections"].items()}
        if denylist_hits("\n".join(texts.values()), patterns):
            continue
        for section, text in texts.items():
            text = re.sub(r"\n{3,}", "\n\n", text).strip()
            if len(text) < min_chars:
                continue
            for n, piece in enumerate(chunks(text, max_chars, max_chunks)):
                if len(piece) < min_chars:
                    continue
                ask = rng.choice(ASK[lang][section]).format(x=x) if n == 0 else MORE[lang].format(verb=MORE_VERB[lang][section], x=x)
                out.append(rec(ask, MARKER[lang] + piece, section, key, f"{lang}:{page['pageid']}:{section}:{n}"))
    return out


def source_info(ctx: dict) -> dict:
    from sources.common import read_meta

    meta = read_meta(ctx["sources"] / SOURCE) or {}
    return {"cache": str(ctx["sources"] / SOURCE), "meta": {k: v for k, v in meta.items() if k != "excluded"},
            "excluded_pages": len(meta.get("excluded") or [])}
