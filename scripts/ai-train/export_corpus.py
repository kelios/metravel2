#!/usr/bin/env python3
"""Export the public corpus of metravel.by (author 1 travel articles and quests)
from the production API into JSONL files for model training.

Usage:
    python3 -I scripts/ai-train/export_corpus.py --out /Volumes/metravel-ai/data/raw

Only published and moderated content is read, over the public API, with a
pause between requests so the single prod core is not loaded. Nothing is
written to the server. Output:
    <out>/travels.jsonl  one article per line (detail payload, trimmed)
    <out>/quests.jsonl   one quest per line per locale (detail payload, trimmed)
    <out>/manifest.json  counts, timestamps, API base
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://metravel.by/api"
UA = "metravel-ai-train/0.1 (+https://metravel.by)"
TRAVEL_FIELDS = (
    "id slug url title name meta_description description rich_text countryName countries "
    "countryCode cityName travelAddress coordsMeTravel coordsMeTravelArr categories companions "
    "transports complexity budget month monthName year number_days number_peoples "
    "over_nights_stay visa plus minus recommendation created_at updated_at userName user"
).split()
QUEST_LOCALES = ("ru", "be", "uk", "pl", "en")


def get(url: str, pause: float, retries: int = 4):
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            time.sleep(pause)
            return data
        except Exception as exc:  # noqa: BLE001 - retry any transport error
            last = exc
            time.sleep(pause * (2 ** attempt) + 1)
    raise RuntimeError(f"GET {url} failed: {last}")


def paginate(path: str, params: dict, pause: float):
    page = 1
    while True:
        q = dict(params, page=page)
        data = get(f"{API}{path}?{urllib.parse.urlencode(q)}", pause)
        results = data.get("results") or data.get("data") or []
        yield from results
        if not data.get("next") or not results:
            break
        page += 1


def trim(obj: dict, fields) -> dict:
    return {k: obj.get(k) for k in fields if k in obj}


def export_travels(out: Path, pause: float, limit: int | None) -> int:
    path = out / "travels.jsonl"
    done = {json.loads(line)["id"] for line in path.open(encoding="utf-8")} if path.exists() else set()
    count = 0
    with path.open("a", encoding="utf-8") as fh:
        for meta in paginate("/travels/", {"perPage": 50, "publish": 1, "moderation": 1}, pause):
            if limit and count >= limit:
                break
            tid = meta["id"]
            count += 1
            if tid in done:
                continue
            detail = get(f"{API}/travels/{tid}/", pause)
            if not (detail.get("publish") and detail.get("moderation")):
                continue
            row = trim(detail, TRAVEL_FIELDS)
            row["gallery_count"] = len(detail.get("gallery") or [])
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            fh.flush()
            print(f"travel {count}: {tid} {row.get('slug')}", file=sys.stderr)
    return count


def export_quests(out: Path, pause: float, limit: int | None, locales) -> int:
    path = out / "quests.jsonl"
    done = set()
    if path.exists():
        for line in path.open(encoding="utf-8"):
            row = json.loads(line)
            done.add((row["id"], row.get("content_locale")))
    count = 0
    with path.open("a", encoding="utf-8") as fh:
        for meta in paginate("/quests/", {}, pause):
            if limit and count >= limit:
                break
            qid = meta["id"]
            count += 1
            available = meta.get("available_locales") or ["ru"]
            for locale in locales:
                if locale not in available or (qid, locale) in done:
                    continue
                detail = get(f"{API}/quests/{qid}/?lang={locale}", pause)
                row = {
                    "id": qid,
                    "quest_id": detail.get("quest_id"),
                    "title": detail.get("title"),
                    "content_locale": detail.get("content_locale"),
                    "source_locale": detail.get("source_locale"),
                    "available_locales": detail.get("available_locales"),
                    "city": detail.get("city"),
                    "city_alias": detail.get("city_alias") or meta.get("city_alias"),
                    "city_name": meta.get("city_name"),
                    "country_code": meta.get("country_code"),
                    "country_name": meta.get("country_name"),
                    "lat": meta.get("lat"),
                    "lng": meta.get("lng"),
                    "difficulty": meta.get("difficulty"),
                    "duration_min": meta.get("duration_min"),
                    "tags": meta.get("tags"),
                    "pet_friendly": meta.get("pet_friendly"),
                    "intro": trim(detail.get("intro") or {}, ("title", "location", "story", "task")),
                    "steps": [
                        trim(s, ("step_id", "title", "location", "story", "task", "hint", "lat", "lng", "order", "poi_info"))
                        for s in (detail.get("steps") or [])
                    ],
                    "finale_text": (detail.get("finale") or {}).get("text"),
                    "url": f"https://metravel.by/quests/{detail.get('quest_id') or qid}",
                }
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                fh.flush()
                print(f"quest {count}: {qid}/{locale} {row['title']}", file=sys.stderr)
    return count


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True, help="output directory (outside the repo)")
    ap.add_argument("--pause", type=float, default=0.3, help="seconds between requests")
    ap.add_argument("--limit", type=int, default=None, help="stop after N items of each kind (smoke run)")
    ap.add_argument("--quest-locales", default="ru", help="comma list, e.g. ru,pl,en")
    ap.add_argument("--skip-travels", action="store_true")
    ap.add_argument("--skip-quests", action="store_true")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc).isoformat()
    travels = 0 if args.skip_travels else export_travels(out, args.pause, args.limit)
    quests = 0 if args.skip_quests else export_quests(out, args.pause, args.limit, args.quest_locales.split(","))
    manifest = {
        "api": API,
        "started_at": started,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "travels_seen": travels,
        "quests_seen": quests,
        "quest_locales": args.quest_locales,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
