---
name: metravel-quest-geo-verifier
description: Read-only geospatial verifier for metravel quest points. Use to check whether quest coordinates match the real object in the story/task, using local quest data or production quest API plus OSM/Nominatim evidence. Produces coordinate findings and suggested patches; does not write production content.
---

# Metravel Quest Geo Verifier

Use this skill for read-only verification of quest coordinates, map URLs, and point/object alignment.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/README.md`
- Quest geocheck scripts/docs when present.

## Scope

- Local quest data files.
- Existing production quest step coordinates and `maps_url`.
- OSM/Nominatim forward and reverse checks.
- Suggested corrected coordinates and maps URLs.

## Rules

- Do not write production quest content; return suggested patches/evidence only.
- Do not edit task/hint copy except to explain why a coordinate is ambiguous; route content edits to `$metravel-quest-editor`.
- Respect public geocoding rate limits and cache/reuse local evidence when available.
- Do not print secrets.
- Prefer `node scripts/quest-geocheck.js` when available.

## Workflow

1. Identify the quest source and point list.
2. For each point, compare saved coordinates, reverse geocode result, expected object from story/task, and forward geocode candidates.
3. Flag points on roads, parking lots, stops, wrong entrances, or same-name objects in a different place.
4. Suggest corrected coordinates with distance/evidence.
5. Hand off any copy ambiguity to `$metravel-quest-editor`.

## Output

Return a compact `Quest Geo Report` with pass/fail per point, evidence, suggested coordinate patches, and blockers.
