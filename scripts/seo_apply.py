#!/usr/bin/env python3
"""
Safe SEO updater for LIVE published travels on metravel.by.

Unlike the draft engine in metravel_publish.py (which force-sends publish=False,
moderation=False, gallery=[] and __draft_placeholder__ for plus/minus/etc), this
script echoes back every real field from GET so the article STAYS published with
its photos, points, cover, pros/cons intact. It changes ONLY:
  - description  (existing HTML + appended enrichment blocks)
  - meta_description

Then it re-GETs and verifies nothing unintended changed (publish flag, slug,
gallery count). If a regression is detected it prints a loud warning and exits 2.

Usage:
  python3 scripts/seo_apply.py --id 169 --append-file blocks.html --meta "…" [--dry-run]
  python3 scripts/seo_apply.py --id 169 --desc-file full.html --meta "…"   # replace, not append

Token: env METRAVEL_TOKEN or ~/.metravel_token (Django REST token).
"""
import argparse
import json
import os
import sys
import urllib.request

BASE = os.environ.get("METRAVEL_API", "https://metravel.by/api")


def token():
    t = os.environ.get("METRAVEL_TOKEN")
    if not t:
        p = os.path.expanduser("~/.metravel_token")
        if os.path.exists(p):
            t = open(p).read().strip()
    if not t:
        sys.exit("ERROR: set METRAVEL_TOKEN env var or ~/.metravel_token file")
    return t


def req(method, path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(BASE + path, data=body, method=method)
    r.add_header("Authorization", "Token " + token())
    if body is not None:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def get_travel(tid):
    status, txt = req("GET", f"/travels/{tid}/")
    if status != 200:
        sys.exit(f"ERROR: GET travel {tid} → HTTP {status}")
    return json.loads(txt)


def build_payload(d, new_desc, meta):
    """Echo back every real field; override only description + meta_description.

    gallery=[] and travelAddress=[] are intentional: the backend treats empty
    arrays as 'no change' (points are carried by coordsMeTravel, photos live in
    the media collection). This is the same contract the draft engine relies on.
    """
    return {
        "id": d.get("id"),
        "name": d.get("name"),
        "description": new_desc,
        "meta_description": meta if meta is not None else d.get("meta_description"),
        "year": str(d.get("year") or "2025"),
        "categories": d.get("categories") or [20],
        "countries": d.get("countries") or [160],
        "coordsMeTravel": d.get("coordsMeTravel") or [],
        "travelAddress": [],
        "gallery": [],
        "transports": d.get("transports") or [],
        "month": d.get("month") or [],
        "complexity": d.get("complexity") or [],
        "companions": d.get("companions") or [],
        "over_nights_stay": d.get("over_nights_stay") or [],
        "thumbs200ForCollectionArr": [],
        "travelImageThumbUrlArr": [],
        "travelImageAddress": [],
        # Preserve REAL author content; fall back to the app's sentinel for
        # empty fields because the API rejects blank values here.
        "plus": d.get("plus") or "__draft_placeholder__",
        "minus": d.get("minus") or "__draft_placeholder__",
        "recommendation": d.get("recommendation") or "__draft_placeholder__",
        "youtube_link": d.get("youtube_link") or "__draft_placeholder__",
        # Keep the article LIVE.
        "publish": bool(d.get("publish")),
        "moderation": bool(d.get("moderation")),
        "visa": bool(d.get("visa")),
        "number_days": d.get("number_days"),
        "number_peoples": d.get("number_peoples"),
        "budget": d.get("budget"),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--append-file", help="HTML appended to the existing description")
    ap.add_argument("--prepend-file", help="HTML lead paragraph put BEFORE the existing text "
                                            "(fixes the SERP snippet, which is the first ~160 chars)")
    ap.add_argument("--desc-file", help="HTML that REPLACES the description entirely")
    ap.add_argument("--meta", help="meta_description text (80-160 chars)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    d = get_travel(args.id)
    old_desc = d.get("description") or ""

    if args.desc_file:
        new_desc = open(args.desc_file, encoding="utf-8").read()
    else:
        new_desc = old_desc
        if args.prepend_file:
            lead = open(args.prepend_file, encoding="utf-8").read().strip()
            new_desc = lead + "\n" + new_desc.lstrip()
        if args.append_file:
            add = open(args.append_file, encoding="utf-8").read().strip()
            new_desc = new_desc.rstrip() + "\n" + add

    payload = build_payload(d, new_desc, args.meta)

    print(f"travel #{d.get('id')} «{d.get('name')}»")
    print(f"  publish={d.get('publish')} moderation={d.get('moderation')} "
          f"gallery={len(d.get('gallery') or [])} points={len(d.get('coordsMeTravel') or [])}")
    print(f"  desc: {len(old_desc)} → {len(new_desc)} chars (+{len(new_desc)-len(old_desc)})")
    print(f"  meta_description: {args.meta!r}")

    if args.dry_run:
        print("DRY RUN — nothing sent.")
        return

    status, txt = req("PUT", "/travels/upsert/", payload)
    print(f"  PUT /travels/upsert/ → HTTP {status}")
    if status not in (200, 201):
        print(txt[:500])
        sys.exit(1)

    # --- verify nothing unintended changed ---
    after = get_travel(args.id)
    problems = []
    if not after.get("publish"):
        problems.append("publish flipped to False")
    if not after.get("moderation"):
        problems.append("moderation flipped to False")
    if after.get("slug") != d.get("slug"):
        problems.append(f"slug changed {d.get('slug')} → {after.get('slug')}")
    if len(after.get("gallery") or []) < len(d.get("gallery") or []):
        problems.append(f"gallery shrank {len(d.get('gallery') or [])} → {len(after.get('gallery') or [])}")
    if len(after.get("coordsMeTravel") or []) < len(d.get("coordsMeTravel") or []):
        problems.append("points shrank")
    if (after.get("description") or "") == old_desc and new_desc != old_desc:
        problems.append("description did NOT update")

    if problems:
        print("❌ REGRESSION:", "; ".join(problems))
        sys.exit(2)
    print(f"✅ OK — still published, gallery={len(after.get('gallery') or [])}, "
          f"points={len(after.get('coordsMeTravel') or [])}, desc={len(after.get('description') or '')} chars")


if __name__ == "__main__":
    main()
