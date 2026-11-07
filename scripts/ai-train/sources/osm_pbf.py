#!/usr/bin/env python3
"""Complete country OSM cache when Overpass is unavailable (#2479).

Run with optional pyosmium and Shapely installed in a separate environment:
  python -I scripts/ai-train/sources/osm_pbf.py --ai-home ~/metravel-ai

Geofabrik PBFs and OSM country polygons stay local under the ODbL licence.
The national node index and selected relation geometry use disk storage.
"""
from __future__ import annotations

import argparse
from collections import Counter
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import sys
import tempfile
import time
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from sources.common import cache_dir, write_meta  # noqa: E402
from sources.osm import LICENSE, UA, TOURISM, HISTORIC, element_row, matches_tags  # noqa: E402

COUNTRIES = {"BY": "belarus", "PL": "poland"}
MAX_REFERENCES = 200_000


def digest(path: Path, algorithm: str = "sha256") -> str:
    value = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def download(url: str, target: Path, expected_md5: str | None = None) -> dict:
    """One bounded streaming request; preserve old complete files on failure."""
    if not target.exists():
        part = target.with_name(target.name + ".part")
        started = time.monotonic()
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as response:
            if urllib.parse.urlsplit(response.geturl()).scheme != "https":
                raise ValueError("source redirect must remain HTTPS")
            expected = int(response.headers.get("Content-Length", "0"))
            size = 0
            with part.open("wb") as stream:
                for chunk in iter(lambda: response.read(4 * 1024 * 1024), b""):
                    stream.write(chunk)
                    size += len(chunk)
                    if time.monotonic() - started > 1800:
                        raise TimeoutError("country download exceeded 30 minutes")
            if expected and size != expected:
                raise ValueError("incomplete download")
        if expected_md5 and digest(part, "md5") != expected_md5:
            raise ValueError("country extract checksum mismatch")
        part.replace(target)
    if expected_md5 and digest(target, "md5") != expected_md5:
        raise ValueError("cached country extract checksum mismatch")
    return {"url": url, "path": str(target), "bytes": target.stat().st_size, "sha256": digest(target), "md5": expected_md5}


def fetch_extract(folder: Path, code: str) -> tuple[Path, dict]:
    latest = f"https://download.geofabrik.de/europe/{COUNTRIES[code]}-latest.osm.pbf"
    with urllib.request.urlopen(urllib.request.Request(latest, method="HEAD", headers={"User-Agent": UA}), timeout=30) as response:
        source = response.geturl()
    filename = urllib.parse.urlsplit(source).path.rsplit("/", 1)[-1]
    if not re.fullmatch(re.escape(COUNTRIES[code]) + r"-\d{6}\.osm\.pbf", filename):
        raise ValueError("country extract did not resolve to a dated snapshot")
    url = source + ".md5"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as response:
        checksum = response.read(1024).decode().strip()
        resolved = response.geturl()
    match = re.fullmatch(r"([a-f0-9]{32})\s+(?:\*)?([a-z]+-\d{6}\.osm\.pbf)", checksum)
    if not match or not match[2].startswith(COUNTRIES[code] + "-"):
        raise ValueError("unrecognised Geofabrik checksum identity")
    if match[2] != filename:
        raise ValueError("checksum and resolved snapshot disagree")
    file = folder / filename
    meta = download(source, file, match[1])
    meta["checksum_url"] = resolved
    return file, meta


def boundary(folder: Path, code: str):
    from shapely.geometry import shape
    from shapely.prepared import prep

    file = folder / f"{code}-boundary.geojson"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "country": "Belarus" if code == "BY" else "Poland", "countrycodes": code.lower(),
        "format": "geojson", "polygon_geojson": 1, "addressdetails": 1, "limit": 1})
    if not file.exists():
        download(url, file)
        time.sleep(1.1)
    features = json.loads(file.read_text(encoding="utf-8")).get("features", [])
    if len(features) != 1 or features[0]["properties"].get("address", {}).get("country_code") != code.lower():
        raise ValueError("country boundary identity mismatch")
    geometry = shape(features[0]["geometry"])
    if geometry.geom_type not in ("Polygon", "MultiPolygon") or geometry.is_empty or not geometry.is_valid:
        raise ValueError("country boundary is not a valid complete polygon")
    return prep(geometry), {"url": url, "sha256": digest(file), "osm_id": features[0]["properties"].get("osm_id")}


def bounds(points) -> list[float] | None:
    result = None
    for point in points:
        if point is None:
            return None
        x, y = point
        result = [x, y, x, y] if result is None else [min(result[0], x), min(result[1], y), max(result[2], x), max(result[3], y)]
    return result


def combine_bounds(boxes) -> list[float] | None:
    points = []
    for box in boxes:
        if box is None:
            return None
        points.extend(((box[0], box[1]), (box[2], box[3])))
    return bounds(points)


def scan_extract(file: Path, code: str, polygon, output, work: Path) -> dict:
    import osmium
    from shapely.geometry import Point

    db = sqlite3.connect(work / "selected-geometry.sqlite")
    db.execute("PRAGMA cache_size=-16384")
    db.execute("PRAGMA temp_store=FILE")
    db.execute("CREATE TABLE objects(kind TEXT,id INTEGER,bbox TEXT,tags TEXT,candidate INTEGER,members TEXT,PRIMARY KEY(kind,id))")
    counts = Counter()

    def save(kind, identity, box=None, tags=None, candidate=False, members=None):
        db.execute("INSERT INTO objects VALUES(?,?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET bbox=COALESCE(excluded.bbox,objects.bbox)",
                   (kind, identity, json.dumps(box) if box is not None else None, json.dumps(tags) if tags is not None else None,
                    int(candidate), json.dumps(members) if members is not None else None))

    def box(kind, identity):
        row = db.execute("SELECT bbox FROM objects WHERE kind=? AND id=?", (kind, identity)).fetchone()
        return json.loads(row[0]) if row and row[0] else None

    def relation(obj, candidate):
        members = [(m.type, m.ref) for m in obj.members if m.type in ("n", "w", "r")]
        save("r", obj.id, tags=dict(obj.tags), candidate=candidate, members=members)

    pairs = [("tourism", value) for value in TOURISM.split("|") + ["camp_site", "caravan_site"]]
    pairs += [("historic", value) for value in HISTORIC.split("|")] + [("amenity", "place_of_worship"), ("natural", "peak")]
    pool = osmium.io.ThreadPool(2)
    processor = osmium.FileProcessor(file, thread_pool=pool).with_locations(f"sparse_file_array,{work / 'nodes.idx'}")
    processor.with_filter(osmium.filter.TagFilter(*pairs))
    for obj in processor:
        tags = dict(obj.tags)
        if not matches_tags(tags):
            continue
        kind = "n" if obj.is_node() else "w" if obj.is_way() else "r"
        counts["candidates_" + kind] += 1
        if kind == "r":
            relation(obj, True)
        else:
            points = [(obj.lon, obj.lat)] if kind == "n" else [(n.lon, n.lat) if n.location.valid() else None for n in obj.nodes]
            save(kind, obj.id, bounds(points), tags, True)
    db.commit()
    location = processor.node_location_storage

    def members():
        for (raw,) in db.execute("SELECT members FROM objects WHERE kind='r'"):
            yield from json.loads(raw)

    for _ in range(32):
        pending = {identity for kind, identity in members() if kind == "r" and not db.execute("SELECT 1 FROM objects WHERE kind='r' AND id=?", (identity,)).fetchone()}
        if len(pending) > MAX_REFERENCES:
            raise ValueError("relation dependency budget exceeded")
        if not pending:
            break
        found = 0
        for obj in osmium.FileProcessor(file, osmium.osm.RELATION, thread_pool=pool).with_filter(osmium.filter.IdFilter(pending)):
            relation(obj, False)
            found += 1
        db.commit()
        if found == 0:
            break
    else:
        raise ValueError("relation nesting exceeds bounded processing limit")

    references = {(kind, identity) for kind, identity in members() if kind in ("n", "w") and box(kind, identity) is None}
    if len(references) > MAX_REFERENCES:
        raise ValueError("geometry dependency budget exceeded")
    for kind, identity in references:
        if kind == "n":
            try:
                point = location.get(identity)
                save(kind, identity, bounds([(point.lon, point.lat)]))
            except (KeyError, osmium.InvalidLocationError):
                pass
    needed_ways = {identity for kind, identity in references if kind == "w"}
    if needed_ways:
        for obj in osmium.FileProcessor(file, osmium.osm.WAY, thread_pool=pool).with_filter(osmium.filter.IdFilter(needed_ways)):
            points = []
            for node in obj.nodes:
                try:
                    point = location.get(node.ref)
                    points.append((point.lon, point.lat))
                except (KeyError, osmium.InvalidLocationError):
                    points.append(None)
            save("w", obj.id, bounds(points))
    db.commit()
    for _ in range(32):
        changed = 0
        for identity, raw in db.execute("SELECT id,members FROM objects WHERE kind='r' AND bbox IS NULL").fetchall():
            merged = combine_bounds(box(kind, ref) for kind, ref in json.loads(raw))
            if merged is not None:
                db.execute("UPDATE objects SET bbox=? WHERE kind='r' AND id=?", (json.dumps(merged), identity))
                changed += 1
        if not changed:
            break
    db.commit()
    for kind, identity, raw_box, raw_tags in db.execute("SELECT kind,id,bbox,tags FROM objects WHERE candidate=1 ORDER BY kind,id"):
        if raw_box is None:
            counts["rejected_geometry"] += 1
            continue
        b = json.loads(raw_box)
        lon, lat = round((b[0] + b[2]) / 2, 5), round((b[1] + b[3]) / 2, 5)
        if not polygon.contains(Point(lon, lat)):
            counts["rejected_country"] += 1
            continue
        row = element_row({"type": {"n": "node", "w": "way", "r": "relation"}[kind], "id": identity,
                           "center": {"lat": lat, "lon": lon}, "tags": json.loads(raw_tags)}, code)
        output.write(json.dumps(row, ensure_ascii=False) + "\n")
        counts["accepted"] += 1
    db.close()
    return dict(counts)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ai-home", required=True)
    parser.add_argument("--download-only", action="store_true")
    args = parser.parse_args()
    out = cache_dir(Path(args.ai_home).expanduser() / "data/sources", "osm")
    lock = (out / ".pbf.lock").open("a+")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    lock.seek(0)
    lock.truncate()
    lock.write(json.dumps({"pid": os.getpid(), "operation": "country PBF source"}))
    lock.flush()
    folder = cache_dir(out, "pbf")
    files, metadata = {}, {}
    for code in COUNTRIES:
        files[code], metadata[code] = fetch_extract(folder, code)
        print(f"{code}: verified {files[code].name} ({metadata[code]['bytes']} bytes)", flush=True)
    (folder / "extracts.json").write_text(json.dumps(metadata, indent=2))
    if args.download_only:
        return 0
    counts, boundaries = {}, {}
    part = out / "pois.pbf.jsonl.part"
    with part.open("w", encoding="utf-8") as output:
        for code in COUNTRIES:
            polygon, boundaries[code] = boundary(folder, code)
            with tempfile.TemporaryDirectory(prefix=f"geometry-{code}-", dir=folder) as temp:
                counts[code] = scan_extract(files[code], code, polygon, output, Path(temp))
            if counts[code].get("accepted", 0) == 0:
                raise ValueError(f"{code}: no verified POIs; refusing complete publication")
            print(code, json.dumps(counts[code]), flush=True)
    old = out / "fetched_at.json"
    legacy = out / "overpass-fetched_at.json"
    if old.exists() and not legacy.exists() and json.loads(old.read_text()).get("source_kind") != "geofabrik-pbf":
        shutil.copyfile(old, legacy)
    provenance = {"source_kind": "geofabrik-pbf", "coverage": {"countries": list(COUNTRIES), "complete_extracts": True, "scans_finished": True},
                  "extracts": metadata, "boundaries": boundaries, "counts": counts, "pois_sha256": digest(part),
                  "overpass_diagnostics": str(legacy) if legacy.exists() else None,
                  "geometry": "bounding-box centres, exact OSM country polygon; missing/cyclic references excluded"}
    part.replace(out / "pois.jsonl")
    meta = write_meta(out, license=LICENSE, origin="https://download.geofabrik.de/", extra=provenance)
    print(json.dumps(meta, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
