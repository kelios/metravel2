"""Shared pieces of the dataset sets: the assistant's system prompt, the record
shape and the deterministic train/valid/test split.

A record is {"messages": [system, user, assistant], "set", "key", "id", "kind",
"license"}. Only "messages" reaches mlx-lm; the rest is for statistics, the
split and the manifest:

* key  — the entity the sample is about ("travel:816", "city:Гродно"); the
         split by key keeps all phrasings of one entity on the same side;
* id   — the sample's own identifier (unique within the set); the split by id
         is the v0/v1 behaviour and stays for the v1 regression mix.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

SITE = "https://metravel.by"
SYSTEM = (
    "Ты — помощник сайта metravel.by. Отвечай кратко, по-дружески и только по материалам сайта: "
    "статьям Юли и Сергея о путешествиях и городским квестам. К каждой рекомендации давай ссылку "
    "на страницу metravel.by. Если на сайте нет материала по вопросу — честно скажи об этом и "
    "предложи ближайшее из того, что есть. Не выдумывай факты и не ссылайся на другие сайты."
)
SPLIT_FIELDS = ("key", "id")


def record(user: str, assistant: str, *, set_name: str, license: str, kind: str, key: str, id: str, system: str = SYSTEM) -> dict:
    return {
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ],
        "set": set_name,
        "key": key,
        "id": id,
        "kind": kind,
        "license": license,
    }


def bucket(value: str) -> float:
    return int(hashlib.sha1(value.encode("utf-8")).hexdigest()[:8], 16) / 0xFFFFFFFF


def split(records: list[dict], valid_share: float, test_share: float, by: str = "key") -> tuple[list[dict], list[dict], list[dict]]:
    if by not in SPLIT_FIELDS:
        raise ValueError(f"split by must be one of {SPLIT_FIELDS}, got {by!r}")
    train, valid, test = [], [], []
    for r in records:
        h = bucket(r[by])
        (test if h < test_share else valid if h < test_share + valid_share else train).append(r)
    return train, valid, test


def chars(r: dict) -> int:
    return sum(len(m["content"]) for m in r["messages"])


def approx_tokens(rows: list[dict]) -> int:
    # Russian text through the Qwen tokenizer: ≈ 3 characters per token.
    return sum(chars(r) for r in rows) // 3


def stats(rows: list[dict]) -> dict:
    by_kind: dict[str, int] = {}
    for r in rows:
        by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
    total_chars = sum(chars(r) for r in rows)
    return {"records": len(rows), "by_kind": by_kind, "chars": total_chars, "approx_tokens": total_chars // 3}


def write_jsonl(path: Path, rows: list[dict], messages_only: bool) -> None:
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps({"messages": r["messages"]} if messages_only else r, ensure_ascii=False) + "\n")
