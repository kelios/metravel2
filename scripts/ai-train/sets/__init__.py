"""Dataset sets: one module per set (site, toponyms, translations, …).

A set module exposes:
    NAME: str                  — set name, equals the module name;
    LICENSE: str               — licence of the material the answers are made of;
    build(ctx, options) -> list[dict]
                               — records (see sets.common.record), in a stable order;
    source_info(ctx) -> dict   — what the set was built from (paths, fetched_at), for manifest.json.

ctx = {"ai_home": Path, "raw": Path, "sources": Path, "seed": int}.
"""
from __future__ import annotations

import importlib
import re
from types import ModuleType

_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def load(name: str) -> ModuleType:
    if not _NAME_RE.match(name) or name == "common":
        raise ValueError(f"bad set name: {name!r}")
    try:
        module = importlib.import_module(f"sets.{name}")
    except ModuleNotFoundError as exc:
        if exc.name != f"sets.{name}":
            raise
        raise SystemExit(f"set {name!r} is not implemented yet: scripts/ai-train/sets/{name}.py (docs/AI_TRAIN_DATASETS.md § 7)")
    for attr in ("NAME", "LICENSE", "build", "source_info"):
        if not hasattr(module, attr):
            raise TypeError(f"set module sets.{name} has no {attr}")
    return module
