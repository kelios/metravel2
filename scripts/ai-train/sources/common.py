"""Cache folder helpers shared by source loaders."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path


def cache_dir(sources_root: Path, name: str) -> Path:
    path = sources_root / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_meta(path: Path, *, license: str, origin: str, extra: dict | None = None) -> dict:
    """LICENSE (human-readable) and fetched_at.json (machine-readable) next to the cached data."""
    meta = {"license": license, "origin": origin, "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(), **(extra or {})}
    (path / "LICENSE").write_text(f"{license}\nSource: {origin}\nFetched: {meta['fetched_at']}\n", encoding="utf-8")
    (path / "fetched_at.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return meta


def read_meta(path: Path) -> dict | None:
    meta = path / "fetched_at.json"
    return json.loads(meta.read_text(encoding="utf-8")) if meta.exists() else None
