---
name: metravel-map-expert
description: Expert for metravel map and places work, including MapPage, map popups, Leaflet web, native map/WebView surfaces, ORS routing, and place cards. Use for `components/MapPage/**`, `components/map/**`, `app/(tabs)/map*`, `hooks/useMap*`, `screens/tabs/PlacesScreen.tsx`, or `api/places.ts`.
---

# Metravel Map Expert

Use this skill for map, places, marker, popup, routing, and cross-platform map behavior.

`AGENTS.md` is inherited. Read `docs/features/map.md` or
`docs/features/places.md` when relevant and only the map/UI/media/link heading
implicated by the task; add the affected native section for native map changes.

## Scope

- `components/MapPage/**`, `components/map/**`
- `app/(tabs)/map*`, `app/(tabs)/quests/map.tsx`
- `hooks/useMap*`, map utilities, ORS integration
- `screens/tabs/PlacesScreen.tsx`, `api/places.ts`

## Rules

- Keep Leaflet/react-leaflet isolated to web files and native map/WebView code isolated to native platform files.
- Use `ImageCardMedia` for map popup/place/travel images.
- Keep `/places` point-level: render places/coordinates first, travel links second.
- Preserve parity across mobile web, Android, and iPhone as an invariant: the same
  point/place card layout, action order, hero proportions, and marker/card tap
  semantics. Common/shared responsive UI is validated on desktop/mobile web;
  add native QA only for platform-specific map behavior.
- Map marker popups/cards on mobile must use the shared fullscreen point/place
  template inside visible app chrome: header/footer remain visible, hero image is
  about 70%, then title/meta, coordinates + copy, article/page action, expandable
  navigation choices, and existing save/add actions.
- Navigation choices must include Google Maps, Apple Maps, Organic Maps/offline,
  Waze, Яндекс Карты, Яндекс Навигатор, and OpenStreetMap when coordinates are
  available. Telegram/share is extra, not a replacement for navigation.
- Related travel status must be visible as text ("Был здесь", "Хочу поехать",
  "Планирую" or compact "Был / Хочу / Планирую"), not only an unlabeled icon.
- On travel details, point-card taps focus/highlight the map marker only; do not
  auto-open the popup unless the marker itself is tapped.
- Keep external links centralized in `utils/externalLinks.ts`.
- Do not print `EXPO_PUBLIC_ORS_API_KEY` or other secrets.
- If a board ticket id is part of the task, update only that ticket: `in_progress` at start, `review` with evidence at handoff; do not move it to `done`.

## Workflow

1. Read the platform-specific map files before changing shared map code.
2. Check API contracts for travels, route points, places, and near-route queries.
3. For visible map UI/popup changes, define the browser scenario and hand it to
   `$metravel-browser-reviewer` only after code review in `testing`.
4. For native-only behavior, implementation belongs to
   `$metravel-android-developer` or `$metravel-ios-developer`; device QA belongs
   to `$metravel-mobile-tester`, and iPhone-specific QA to
   `$metravel-ios-tester`, in `testing`.
5. Before review, run targeted code-level tests/checks only. Browser/device
   evidence is collected afterward by testing.

## Output

Return a compact `Map Expert Handoff` with platform impact, touched files, validation, and blockers.
