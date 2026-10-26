"""The assistant screen's prompt for the training sets (#2712).

The site assistant (api/aiAssist/prompt.ts) sends metravel-llm a system prompt
built per interface locale and a user message with the retrieved cards. The
sets that teach that mode (rag_answers, offtopic) must train on exactly the same
text, so the strings come from scripts/ai-train/assistant_prompt.json — a
snapshot of prompt.ts that __tests__/api/aiAssist/assistantPromptFixture.test.ts
compares with the TypeScript and with build_user_message() below.

Not a set: sets/__init__.load() refuses this name only by not finding NAME/build.
"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit

FIXTURE = Path(__file__).resolve().parent.parent / "assistant_prompt.json"
# Questions of the assistant eval contour (#2710): held out by construction (#2731).
CONTOUR_CASES = Path(__file__).resolve().parents[2] / "ai-assistant-eval" / "cases.jsonl"
REQUIRED_CASES = ("cases.jsonl", "cases.quality.jsonl", "cases.complex.jsonl")
LOCALES = ("ru", "be", "uk", "pl", "en")
SOURCE_TYPE_RU = {"travel": "Статья", "quest": "Квест"}
TITLE_MAX = 160
SNIPPET_MAX = 400
QUESTION_MAX = 500
# prompt.ts sanitizeFragment: control (\p{Cc}) and format (\p{Cf}) characters become spaces.
_HIDDEN_RE = re.compile(r"[\u0000-\u001f\u007f-\u009f­؀-؅؜۝܏࣢᠎​-‏‪-‮⁠-⁤⁦-⁯﻿￹-￻]")

_fixture: dict | None = None
_contour: set[str] | None = None
_references: set[str] = set()
_fixture_markers: set[str] = set()
_holdout_hashes: dict[str, str] = {}


def _norm_question(text: str) -> str:
    text = unicodedata.normalize("NFKC", _HIDDEN_RE.sub(" ", str(text))).casefold().replace("ё", "е")
    return " ".join(re.findall(r"\w+", text))


def _load_holdouts() -> None:
    global _contour, _references, _fixture_markers, _holdout_hashes
    if _contour is not None:
        return
    directory = CONTOUR_CASES.parent
    for name in (*REQUIRED_CASES, "fixtures.complex.json"):
        if not (directory / name).is_file():
            raise ValueError(f"missing required evaluation input: {directory / name}")
    questions, references, markers, hashes = set(), set(), set(), {}
    for file in sorted(directory.glob("cases*.jsonl")):
        raw = file.read_bytes()
        hashes[file.name] = hashlib.sha256(raw).hexdigest()
        rows = 0
        for line in raw.decode("utf-8").splitlines():
            if not line.strip():
                continue
            case = json.loads(line)
            if not isinstance(case, dict):
                raise ValueError(f"invalid evaluation case in {file}")
            turns = case.get("turns", [case.get("q")])
            if (not isinstance(turns, list) or not turns
                    or any(not isinstance(q, str) or not _norm_question(q) for q in turns)):
                raise ValueError(f"invalid evaluation question in {file}")
            history = case.get("history", [])
            if (not isinstance(history, list)
                    or any(not isinstance(m, dict) or m.get("role") not in ("user", "assistant")
                           or not isinstance(m.get("text"), str) or not _norm_question(m["text"]) for m in history)):
                raise ValueError(f"invalid evaluation history in {file}")
            turns = turns + [m["text"] for m in history if m["role"] == "user"]
            questions.update(_norm_question(q) for q in turns)
            if "reference_answer" in case:
                if not isinstance(case["reference_answer"], str) or not _norm_question(case["reference_answer"]):
                    raise ValueError(f"invalid evaluation reference in {file}")
                references.add(_norm_question(case["reference_answer"]))
            rows += 1
        if file.name in REQUIRED_CASES and not rows:
            raise ValueError(f"empty required evaluation cases: {file}")
    for file in sorted(directory.glob("fixtures*.json")):
        raw = file.read_bytes()
        hashes[file.name] = hashlib.sha256(raw).hexdigest()
        sources = json.loads(raw)
        if not isinstance(sources, list):
            raise ValueError(f"invalid evaluation fixture list in {file}")
        controlled = 0
        for source in sources:
            if (not isinstance(source, dict)
                    or any(not isinstance(source.get(key), str) or not source[key].strip() for key in ("title", "url"))):
                raise ValueError(f"invalid evaluation fixture identity in {file}")
            url = urlsplit(source["url"])
            if url.scheme != "https" or url.hostname != "metravel.by" or not url.path.startswith("/"):
                raise ValueError(f"invalid evaluation fixture URL in {file}")
            if "/eval-fixture-" in url.path:
                marker = _norm_question(source["title"].split(" — ")[0])
                if not marker or not re.search(r"/eval-fixture-[^/\s]+", url.path):
                    raise ValueError(f"invalid controlled evaluation fixture identity in {file}")
                markers.add(marker)
                controlled += 1
        if file.name == "fixtures.complex.json" and not controlled:
            raise ValueError(f"required evaluation fixtures have no controlled identities: {file}")
    _references = references
    _fixture_markers = markers
    _holdout_hashes = hashes
    _contour = questions


def holdout_provenance() -> dict[str, str]:
    """Hashes of all protected inputs; lexical matching does not prove arbitrary paraphrase absence."""
    _load_holdouts()
    return dict(_holdout_hashes)


def holdout_violation(messages: list[dict]) -> str | None:
    _load_holdouts()
    for message in messages:
        content = message["content"]
        normalized = _norm_question(content)
        if "/eval-fixture-" in content.casefold() or any(marker in normalized for marker in _fixture_markers):
            return "controlled evaluation fixture reused"
        if message["role"] == "user":
            question = re.split(r"Вопрос посетителя:", content, flags=re.IGNORECASE)[-1]
            if is_contour_question(question):
                return "held-out evaluation question reused"
        if message["role"] == "assistant" and normalized in _references:
            return "held-out reference answer reused"
    return None


def is_contour_question(question: str) -> bool:
    """True when the question (after {loc} substitution) is one the eval contour asks: a set must not
    train on it, or the contour measures memorised strings (code review #2731 found bd01/bd02/bd07…)."""
    _load_holdouts()
    return _norm_question(question) in _contour


def fixture() -> dict:
    global _fixture
    if _fixture is None:
        _fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return _fixture


def system_prompt(locale: str) -> str:
    return fixture()["system"][locale]


def offtopic_reply(locale: str) -> str:
    return fixture()["offtopic_reply"][locale]


def max_answer_chars() -> int:
    return int(fixture()["max_answer_chars"])


def sanitize_fragment(value, max_length: int = SNIPPET_MAX) -> str:
    text = _HIDDEN_RE.sub(" ", str(value if value is not None else ""))
    # JS String.prototype.slice counts UTF-16 code units; the site text is BMP-only, so code points match.
    return re.sub(r"\s+", " ", text).strip()[:max_length]


def format_sources_block(sources: list[dict]) -> str:
    blocks = []
    for index, source in enumerate(sources, 1):
        head = f"[{index}] {SOURCE_TYPE_RU[source['type']]} «{sanitize_fragment(source['title'], TITLE_MAX)}» — {source['url']}"
        body = sanitize_fragment(source.get("snippet"))
        blocks.append(f"{head}\n{body}" if body else head)
    return "\n\n".join(blocks)


def build_user_message(question: str, sources: list[dict], locale: str = "ru") -> str:
    clean = sanitize_fragment(question, QUESTION_MAX)
    if not sources:
        return fixture()["user_no_sources"].replace("{question}", clean)
    return fixture()["user_with_sources"].replace("{sources}", format_sources_block(sources)).replace("{question}", clean)


# Training budget (#2712): lora-qwen3.5-4b-v3.yaml trains at max_seq_length 1024 — 1280 and 1536 run
# out of Metal memory on the 24 GB Mac (probes 2026-10-25), and a prompt-masked sample cut inside its
# prompt has no target tokens (loss NaN). ≈ 2.9 characters of Russian per Qwen token, URLs cost more.
SAMPLE_CHARS_BUDGET = 2700
SHORT_SNIPPETS = (200, 120, 60)


def fit_sources(question: str, sources: list[dict], answer: str, locale: str, budget: int = SAMPLE_CHARS_BUDGET) -> str | None:
    """User message that fits the training budget: unrelated cards (their URL is not in the answer) are
    dropped first, then every snippet is shortened; the cards the answer names always stay. `None` when
    even that does not fit — the caller skips the sample. The screen sends up to eight cards with
    320-character snippets — training sees fewer and shorter ones."""
    cards = [dict(source) for source in sources]

    def size() -> int:
        return len(system_prompt(locale)) + len(build_user_message(question, cards, locale)) + len(answer)

    while size() > budget:
        spare = [card for card in cards if card["url"] not in answer]
        if len(spare) <= 1 or len(cards) <= 2:
            break
        cards.remove(spare[-1])
    for limit in SHORT_SNIPPETS:
        if size() <= budget:
            break
        for card in cards:
            snippet = card.get("snippet") or ""
            if len(snippet) > limit:
                card["snippet"] = snippet[:limit].rsplit(" ", 1)[0] + "…"
    return build_user_message(question, cards, locale) if size() <= budget else None
