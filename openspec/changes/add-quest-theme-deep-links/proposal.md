## Why

Board #2403 documents that `/quests?theme=halloween` ignores the theme and `/quests/theme/halloween` enters quest detail with an invalid quest ID. Guests following the October campaign need a direct catalog selection before the 29 October post, with safe fallback outside the season.

## What Changes

- Resolve an explicit theme query into the existing catalog selection, before persisted selection, on initial navigation and later deep links.
- Allow active registered theme IDs case-insensitively; an explicit empty, unknown or inactive theme selects All quests.
- Give `/quests/theme/<id>` a dedicated fixed-route redirect into the same query entry.
- Preserve saved out-of-season selections and manual changes after a URL selection; align the static first-frame selection marker with URL precedence.

Goal / user-visible result: direct theme links open the intended catalog slice; invalid links open All without a quest-detail error.
Non-goals: theme landing content, new themes, registry/calendar edits, quest content, API changes, iPad-specific behavior.
Dependencies: #2377 and #2376 are completed context; no backend dependency. Implementation requires a separate apply request after planning review.
Fallback/mock policy: All is the only invalid-link fallback; real catalog data remains authoritative, with existing loading/error/offline behavior.
Existing behavior to preserve: city/country/personal slices, profile handoff, geolocation consent, manual reset, persisted theme restoration outside its season.
Open questions: none; URL season validation intentionally differs from saved-selection restoration, as requested by #2403.

## Capabilities

### New Capabilities
- `quest-theme-deep-links`: safe cross-platform URL entry into an existing thematic catalog selection.

### Modified Capabilities
None.

## Impact

- Platform impact: desktop web, mobile web, Android and iOS deep links; no platform configuration or store operation. Planning files themselves have platform impact none.
- Localization impact: all current locales retain existing RU/BE/UK/PL/EN labels; no new copy or keys. Planning text has localization impact none.
- Frontend paths: `screens/tabs/QuestsScreen.tsx`, `utils/questCatalogSelection.ts`, dedicated `app/(tabs)/quests/theme/[theme].tsx`, their tests and `docs/features/quests.md`.
- API/data: no endpoint/payload change; query `theme` maps to existing `__theme__:<id>` or `__all__`, using the existing storage key.
- SEO: alias route redirects locally; no new landing, metadata, sitemap or robots work.
- Accessibility: preserve selected filter state, headings, focus and reset controls; no new control.
- Performance: no additional network request or eager resource namespace; avoid loading the translated theme registry into every restoration consumer.
- Security: IDs are validated against the existing registry; redirect destination is fixed and never user-provided.
- Analytics: current catalog events preserved; no new tracking requirement.
