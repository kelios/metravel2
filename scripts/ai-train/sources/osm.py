#!/usr/bin/env python3
"""Cache named OpenStreetMap POIs of Belarus and Poland for the `osm_intents`
set (#2479): the same objects the site's map shows through Overpass
(utils/overpass/buildOverpassQuery.ts — tourism attraction/museum/viewpoint/
zoo/theme_park, historic castle/manor/fort/ruins/archaeological_site/monument/
memorial, amenity place_of_worship) plus peaks with elevation and camp/caravan
sites. Only objects with a name and (for the map categories) a Wikidata link,
so the descriptions are about real, notable places.

Licence: ODbL. The cache is a derived database and never leaves this machine;
only the skills (question → filter, tags → description) go into the weights.

The two countries' bounding boxes are walked in 2° tiles, one Overpass query
per tile, cached in tiles/, so a rerun fetches only what is missing.

Usage:
    python3 -I scripts/ai-train/sources/osm.py --ai-home ~/metravel-ai

Output: <AI_HOME>/data/sources/osm/{pois.jsonl,LICENSE,fetched_at.json} (+ tiles/*.json).
pois.jsonl: {"id": "node/123", "country", "lat", "lon", "tags": {kept tags}}.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from sources.common import cache_dir, write_meta  # noqa: E402

NAME = "osm"
LICENSE = "ODbL 1.0 (OpenStreetMap contributors); derived cache kept local, not published"
# the main instance and its lz4 twin; the other public mirrors did not answer on 24.10.2026
ENDPOINTS = ("https://overpass-api.de/api/interpreter", "https://lz4.overpass-api.de/api/interpreter")
ENDPOINT = ENDPOINTS[0]
UA = "metravel-ai-train/1.0 (https://metravel.by; dataset build, see scripts/ai-train/README.md)"
# south, west, north, east
BBOX = {"BY": (51.2, 23.1, 56.2, 32.8), "PL": (49.0, 14.1, 54.9, 24.2)}
TILE = 1.0  # 1° tiles: ~100 requests for both countries, each light enough for a loaded server
TOURISM = "attraction|museum|viewpoint|zoo|theme_park"
HISTORIC = "castle|manor|fort|ruins|archaeological_site|monument|memorial"
KEEP_TAGS = (
    "name", "name:ru", "name:be", "name:pl", "name:en", "name:uk", "official_name",
    "tourism", "historic", "amenity", "natural", "religion", "denomination", "castle_type",
    "ele", "heritage", "heritage:operator", "start_date", "wheelchair", "fee", "opening_hours",
    "addr:city", "addr:place", "addr:street", "description", "inscription", "wikidata",
    "dog", "caravans", "tents", "drinking_water", "toilets", "shower", "capacity",
)


def tile_query(bbox: tuple[float, float, float, float], country: str) -> str:
    """POIs of the tile inside the country's boundary: the bounding boxes overlap Lithuania, Ukraine,
    Germany, Czechia…, and a bbox alone brought Lithuanian hill forts into the Belarus cache (24.10.2026;
    tiles fetched before that are filtered again by sets/osm_intents.py)."""
    b = ",".join(f"{v:.2f}" for v in bbox)
    return f"""[out:json][timeout:120];
area["ISO3166-1"="{country}"]["admin_level"="2"]->.c;
(
  nwr["tourism"~"^({TOURISM})$"]["name"]["wikidata"](area.c)({b});
  nwr["historic"~"^({HISTORIC})$"]["name"]["wikidata"](area.c)({b});
  nwr["amenity"="place_of_worship"]["name"]["wikidata"](area.c)({b});
  nwr["natural"="peak"]["name"]["ele"](area.c)({b});
  nwr["tourism"~"^(camp_site|caravan_site)$"]["name"](area.c)({b});
);
out center tags;"""


def overpass(query: str, pause: float, retries: int = 10) -> dict:
    """POST the query, rotating the endpoints on 429/5xx/network errors; the wait grows to 2 minutes."""
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    delay = pause
    for attempt in range(retries):
        time.sleep(delay)
        endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
        req = urllib.request.Request(endpoint, data=body, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == retries - 1:
                raise
            reason = f"HTTP {exc.code}"
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            if attempt == retries - 1:
                raise
            reason = str(exc)[:80]
        delay = min(120.0, max(20.0, delay * 1.5))
        print(f"overpass {endpoint.split('/')[2]}: {reason}, retry in {delay:.0f}s", file=sys.stderr)
    raise RuntimeError("unreachable")


def tiles(bbox: tuple[float, float, float, float], step: float) -> list[tuple[float, float, float, float]]:
    s0, w0, n0, e0 = bbox
    out = []
    s = s0
    while s < n0:
        w = w0
        while w < e0:
            out.append((s, w, min(s + step, n0), min(w + step, e0)))
            w += step
        s += step
    return out


def element_row(el: dict, country: str) -> dict | None:
    tags = el.get("tags") or {}
    if not tags.get("name"):
        return None
    center = el.get("center") or el
    if "lat" not in center or "lon" not in center:
        return None
    return {"id": f"{el['type']}/{el['id']}", "country": country, "lat": round(center["lat"], 5), "lon": round(center["lon"], 5),
            "tags": {k: tags[k] for k in KEEP_TAGS if k in tags}}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ai-home", default=None, help="training folder (default: $AI_HOME)")
    ap.add_argument("--pause", type=float, default=5.0, help="seconds between Overpass requests")
    ap.add_argument("--countries", default="BY,PL", help="subset of BY,PL")
    ap.add_argument("--tile", type=float, default=TILE, help="tile size in degrees")
    ap.add_argument("--offline", action="store_true", help="assemble pois.jsonl from the cached tiles only, fetch nothing")
    args = ap.parse_args()
    home = Path(args.ai_home or os.environ.get("AI_HOME") or ".").expanduser()
    out = cache_dir(home / "data" / "sources", NAME)
    tiles_dir = out / "tiles"
    tiles_dir.mkdir(exist_ok=True)

    rows: dict[str, dict] = {}
    counts: dict[str, int] = {}
    missing: list[str] = []
    for code in (c for c in args.countries.split(",") if c):
        for bbox in tiles(BBOX[code], args.tile):
            path = tiles_dir / f"{code}_{bbox[0]:.1f}_{bbox[1]:.1f}.json"
            if path.exists():
                data = json.loads(path.read_text(encoding="utf-8"))
            elif args.offline:
                missing.append(path.stem)
                continue
            else:
                try:
                    data = overpass(tile_query(bbox, code), args.pause)
                except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
                    # the public server goes away for hours; keep what is cached, list the gap, a rerun fills it
                    missing.append(path.stem)
                    print(f"{code} tile {bbox[0]:.1f},{bbox[1]:.1f}: skipped ({str(exc)[:80]})", file=sys.stderr)
                    continue
                path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            n = 0
            for el in data.get("elements", []):
                row = element_row(el, code)
                if row and row["id"] not in rows:
                    rows[row["id"]] = row
                    n += 1
            counts[code] = counts.get(code, 0) + n
            print(f"{code} tile {bbox[0]:.1f},{bbox[1]:.1f}: {n} new POIs ({len(rows)} total)", file=sys.stderr)

    with (out / "pois.jsonl").open("w", encoding="utf-8") as fh:
        for key in sorted(rows):
            fh.write(json.dumps(rows[key], ensure_ascii=False) + "\n")
    by_kind: dict[str, int] = {}
    for r in rows.values():
        t = r["tags"]
        kind = t.get("tourism") or t.get("historic") or t.get("amenity") or t.get("natural") or "other"
        by_kind[kind] = by_kind.get(kind, 0) + 1
    meta = write_meta(out, license=LICENSE, origin=ENDPOINT, extra={"counts": {"pois": len(rows), **counts, "by_kind": by_kind}, "bbox": BBOX, "tile": args.tile,
                                                                 "missing_tiles": missing})
    if missing:
        print(f"{len(missing)} tiles missing — rerun to fill them", file=sys.stderr)
    print(json.dumps(meta, ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
