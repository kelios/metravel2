## Why

Task #3229 and the growth audit of 2026-11-09 show that `/map` cannot recover a city search outside its current 50 km area: searching «Несвиж» from Minsk only offers a wider radius. The map also lacks an explicit entry to the existing quest map.

## What Changes

- When a settled local place search is empty, offer an explicit city-lookup action. Only that action starts the existing geocoder; verified settlement results require a second explicit selection to move both the camera and search center while retaining query, radius and categories.
- Keep local pending/error/offline states and the existing radius expansion; a failed geocoder or absent city does not become a successful city match.
- Add a shared, labelled internal link from the radius discovery panel to `/quests/map`.

## Capabilities

### New Capabilities

- `map-city-search`: explicit recovery from a radius-limited empty city search.
- `map-quest-entry`: discoverable navigation from the main map to the existing quest map.

### Modified Capabilities

None. Existing radius-search and AI-intent contracts remain intact; occupied active changes are not modified.

## Impact

- Platform impact: desktop web and mobile web city recovery, at the existing web search-feedback boundary. The quest link is shared across map panels and reuses unchanged common internal navigation. Native map engines, bridges and destination screens remain unchanged.
- Localization impact: RU/BE/UK/PL/EN app-owned status, action and accessibility copy; geocoder place names remain API-owned.
- Frontend scope: map controller, focused city-recovery hook/component, radius panel, map UI feedback types, opt-in canonical geocoder observer policy, five existing map resource shards, regression tests and this change. Existing geocoder callers keep their defaults.
- Data/API: reuse canonical locale-aware cached location search and existing radius catalog requests. No backend parameters, endpoints, dependencies or mock fallbacks.
- Accessibility: labelled link and city buttons, live pending/error text, existing keyboard/touch primitives. Performance: geocoding only after an explicit action for a current settled empty query of at least three characters; existing cache, cancellation and transport retained. New-consumer rapid requests/retries are bounded to one per second in this JavaScript context; this is not a global application traffic SLA.
- Security: validate finite WGS84 coordinates and settlement identity before offering or applying a city. Analytics: preserve existing map-search outcomes and event parameters. SEO: unchanged URLs, metadata, canonical, robots, sitemap and static page contract.
- Dependencies: completed #3042 radius-search recovery and #1819 canonical geocoder. Preserve #2887 AI camera-only intent and separately owned #3044 analytics observation.
- Non-goals: quest catalog/content/search, a quest overlay, destination city parameters, backend, native map redesign, startup tile lifecycle, routing, user location, SEO/editorial changes.
- Fallback policy: retain local empty/radius expansion when no verified city exists; show geocoder pending/error distinctly with retry. No synthetic city or runtime mock.
