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

import json
import re
from pathlib import Path

FIXTURE = Path(__file__).resolve().parent.parent / "assistant_prompt.json"
LOCALES = ("ru", "be", "uk", "pl", "en")
SOURCE_TYPE_RU = {"travel": "Статья", "quest": "Квест"}
TITLE_MAX = 160
SNIPPET_MAX = 400
QUESTION_MAX = 500
# prompt.ts sanitizeFragment: control (\p{Cc}) and format (\p{Cf}) characters become spaces.
_HIDDEN_RE = re.compile(r"[\u0000-\u001f\u007f-\u009f­؀-؅؜۝܏࣢᠎​-‏‪-‮⁠-⁤⁦-⁯﻿￹-￻]")

_fixture: dict | None = None


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
