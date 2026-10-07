## Why

Canonical #864 again has React hydration recovery errors on cold guest `/trips`; preserved production runs contain #419, and immutable production-mode HTML contains one failed server boundary with no catalog/loading marker. The existing #938 invariant requires working static HTML and hydration, rather than a client-only screen or hidden errors.

## What Changes

- Make the public trip catalog available during the synchronous cold static render and preserve the same first-client-render contract, including its real loading owner, SEO and navigation.
- Add a genuine cold-route rendering regression and raw-console production acceptance. Retain #864's authenticated create, application/cancellation and `/trips/my` checks; a catalog fix alone cannot close those gates.
- Record the established mechanism and remove the obsolete lazy-route description from the trips feature document after implementation.
- Planning only: this change does not authorize apply. The original cold-render probe establishes pending-import abort; the same actual route/catalog renders its loading owner after natural import settlement. Exact ExpoRoot/Metro export and complete browser hydration remain later validation gates.

## Capabilities

### New Capabilities
- `trip-web-static-render`: formally specify the existing trip static-render/hydration invariant and observable cold-route regression control. This adds no product feature or API.

### Modified Capabilities
None. The three existing main spec capabilities concern quests and email auth; none owns trip static rendering.

## Impact

- Goal/user-visible result: cold trip navigation shows the established catalog loading/content/error owner and recovers data normally without React #418/#419, subtree replacement or avoidable authenticated 400/401.
- Platform impact: desktop web and mobile web. The owner's 06.10 current runtime instruction limits this acceptance pass to mobile Chromium390; desktop is an explicitly deferred runtime observation, not an inferred pass. Android/iOS route implementations are unchanged and have no device gate.
- Localization impact: all current locales RU/BE/UK/PL/EN for initialization and regression observation; no new or rewritten UI strings, translations or locale formatting.
- Data/API: existing public/planned-trip endpoints and authentication semantics unchanged; no backend edits or new response shape.
- SEO: preserve static catalog/head, URL/canonical and route metadata; no sitemap/robots/redirect change.
- Accessibility: preserve search, loading/error semantics, headings, keyboard/focus and existing empty-catalog/searchbox rules.
- Performance: measure cold route request/byte and loading-to-content consequences on a source-pinned production build and live rollout. Synchronous import may move chunk cost; no threshold changes or timer-based concealment.
- Security: preserve existing auth/query gates, URL sanitization and private-data boundaries; no credential/token changes. Analytics unchanged because no event/action changes are requested.
- Existing behavior: loading, genuine empty, populated, filtered-empty, error/offline recovery, direct and client navigation, own-trip dashboard and authenticated create/apply/cancel.
- Non-goals: blanket client-only or delayed-hydration conversion, React error filtering, global renderer/Metro changes, native routes, unrelated CLS/media/TripPlanCard fixes, authored content and backend work.
- Dependencies: reviewed source and required apply request; shared quality/build coordination; existing scanner false positive also blocks the mandatory commit hook. No new backend dependency. Production test accounts must already be usable under the existing test-data rules.
- Fallback/mock policy: infrastructure mocks may support code-level isolation only and must be enumerated; no mocked catalog or pre-resolved lazy payload proves cold static output. Done requires real production flows without mock API fallback.
- Evidence limit: no additional catalog import/loading-render exception was observed in the real Node route/provider fixture; exact ExpoRoot is blocked by the Jest navigation ESM harness, and jsdom hydration is blocked by missing CSSFontFaceRule. Do not infer production acceptance or change unrelated leaves from those harness failures. See `.codex-temp/trips-hydration-20261007/cold-render/evidence.md` for the exact commands, raw errors and hashes.
