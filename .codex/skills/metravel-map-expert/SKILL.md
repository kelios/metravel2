---
name: metravel-map-expert
description: Expert for metravel map and places work, including MapPage, map popups, Leaflet web, native map/WebView surfaces, ORS routing, and place cards. Use for `components/MapPage/**`, `components/map/**`, `app/map*`, `app/(tabs)/map*`, `hooks/useMap*`, `screens/tabs/PlacesScreen.tsx`, or `api/places.ts`.
---

# Metravel Map Expert

Use this skill for map, places, marker, popup, routing, and cross-platform map behavior.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/README.md`
- `docs/features/map.md` or `docs/features/places.md` when present and relevant.
- `docs/NATIVE_COMPAT_RULES.md` for native map changes.

## Scope

- `components/MapPage/**`, `components/map/**`
- `app/map*`, `app/(tabs)/map*`
- `hooks/useMap*`, map utilities, ORS integration
- `screens/tabs/PlacesScreen.tsx`, `api/places.ts`

## Rules

- Keep Leaflet/react-leaflet isolated to web files and native map/WebView code isolated to native platform files.
- Use `ImageCardMedia` for map popup/place/travel images.
- Keep `/places` point-level: render places/coordinates first, travel links second.
- Keep external links centralized in `utils/externalLinks.ts`.
- Do not print `EXPO_PUBLIC_ORS_API_KEY` or other secrets.
- If a board ticket id is part of the task, update only that ticket: `in_progress` at start, `review` with evidence at handoff; do not move it to `done`.

## Workflow

1. Read the platform-specific map files before changing shared map code.
2. Check API contracts for travels, route points, places, and near-route queries.
3. For visible map UI/popup changes, require browser evidence; use `$metravel-browser-reviewer` when the task asks for review/fix.
4. For native-only behavior, pair with `$metravel-android-developer` or `$metravel-mobile-tester`.
5. Validate with targeted tests/checks plus browser/device evidence appropriate to the touched platform.

## Output

Return a compact `Map Expert Handoff` with platform impact, touched files, validation, and blockers.
