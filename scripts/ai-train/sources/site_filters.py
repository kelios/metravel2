#!/usr/bin/env python3
"""Cache the site's filter dictionaries (transport, overnight stay, complexity,
companions, months — id → Russian name) from the public metravel.by API.

The exported travels carry only ids in `transports`, `over_nights_stay` and
`complexity`; the site set needs the names for the "route card" samples.

Usage:
    python3 -I scripts/ai-train/sources/site_filters.py --ai-home ~/metravel-ai

Output: <AI_HOME>/data/sources/site_filters/{filters.json,LICENSE,fetched_at.json}.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from export_corpus import API, get  # noqa: E402
from sources.common import cache_dir, write_meta  # noqa: E402

NAME = "site_filters"
LICENSE = "metravel.by own content (site dictionaries)"
ENDPOINT = f"{API}/getFiltersTravel/"
KEEP = ("transports", "over_nights_stay", "complexity", "companions", "month")


def load_filters(sources_root: Path) -> dict[str, dict[int, str]] | None:
    """{dictionary: {id: name}} from the cache, or None when it was never fetched."""
    path = sources_root / NAME / "filters.json"
    if not path.exists():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {k: {int(o["id"]): o["name"] for o in raw.get(k) or [] if o.get("id") is not None and o.get("name")} for k in KEEP}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ai-home", default=None, help="training folder (default: $AI_HOME)")
    ap.add_argument("--pause", type=float, default=1.0)
    args = ap.parse_args()
    home = Path(args.ai_home or os.environ.get("AI_HOME") or ".").expanduser()
    out = cache_dir(home / "data" / "sources", NAME)
    data = get(ENDPOINT, args.pause)
    kept = {k: data.get(k) or [] for k in KEEP}
    if not kept["transports"]:
        print(f"{ENDPOINT}: no transports in the answer, cache left untouched", file=sys.stderr)
        return 1
    (out / "filters.json").write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    meta = write_meta(out, license=LICENSE, origin=ENDPOINT, extra={"counts": {k: len(v) for k, v in kept.items()}})
    print(json.dumps(meta, ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
