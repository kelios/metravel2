## Why

The `/quests` catalogue filters free text locally but does not emit a search event, so the owner cannot see which quests or destinations visitors seek. The goal is a report of settled search terms and their result counts in the existing analytics providers.

## What Changes

- Record one `quest_search` event after a visitor pauses typing a valid query, with `search_term`, `results_count`, and `source=quest_catalog`.
- Preserve consent, automation suppression, native analytics boundaries, and the catalogue's existing filtering and rendering.
- Register a standalone JavaScript goal `quest_search` in Yandex Metrica counter 62803912 so event parameters are reportable.
- Ignore empty, one-character, oversized, and obvious contact/URL input; cancel pending searches when the screen loses focus or data is not ready.

## Capabilities

### New Capabilities

- `quest-catalog-search-analytics`: settled free-text search measurement with trustworthy result counts and existing consent/provider rules.

### Modified Capabilities

None.

## Impact

- Platform impact: desktop web | mobile web. Android/iOS continue to emit no provider analytics.
- Localization impact: none; no app-owned visible text is added and queries keep the visitor's language.
- User-visible result: catalogue interaction and search results remain the same; the owner gains a query report.
- Paths: `screens/tabs/QuestsScreen.tsx`, focused search query/analytics hooks and tests, `docs/features/quests.md`.
- Data/API: additive analytics payload only; no backend API change or new identifiers/coordinates.
- Analytics: additive event and Yandex JavaScript goal; historical queries cannot be reconstructed.
- Performance: one bounded timer per pending query; no additional catalogue/network request.
- Security: length/obvious contact input limits; consent remains enforced by the existing delivery boundary.
- SEO/accessibility: no change because markup, navigation, and controls remain identical.
- Dependencies: configured existing analytics providers and access to the named Yandex counter. Missing provider access is reported, not replaced by mock data.
- Fallback/mock policy: tests may mock delivery; production uses existing real providers and never fabricates searches.
- Non-goals: quest content, search ranking, catalogue filters, native SDKs, personal identifiers, historical demand estimates.
- Open questions: none; implementation is directly authorized by the user request.
