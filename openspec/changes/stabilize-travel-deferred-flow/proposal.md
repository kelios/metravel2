## Why

Task #3382 reproduces cumulative full-scroll article CLS of 0.325/0.972/0.090/1.168/0.205 on five fresh 390×844 production visits (2026-11-12), against a budget of 0.1. The aggregate deferred reserve does not isolate geometry changes within its children: Nearby collapses 402→185px and the loaded map slot grows 692→1402px before shrinking to 1203.31px, moving already-visible following content.

## What Changes

- Apply the existing measured deferred transition at the actual changing child boundaries: the map slot's outer composition and the Nearby list's content.
- Keep parent/child height updates in the existing single anchored transaction, without additional fixed-height guesses.
- Add full-scroll regression cases for the affected article at 390×844 and 1440×900, five real guest visits each, cumulative CLS ≤0.1.

## Capabilities

### New Capabilities

- `travel-deferred-flow-stability`: preserve visible following article sections through asynchronous growth and empty-state contraction.

### Modified Capabilities

None.

## Impact

- Paths: `components/travel/details/TravelDetailsDeferred.tsx`, `components/travel/details/sections/TravelDetailsSidebarSection.tsx`, focused DOM/component tests, `e2e/cls-audit.spec.ts` and its dedicated helper; Problem Memory receives only the causal delta.
- Platform impact: mobile web and desktop web. Native retains its existing deferred component and direct-child rendering; no device-specific behavior changes.
- Localization impact: no text changes; longest-label locale remains a geometry QA case.
- User-visible/accessibility: preserve scroll position, current loading/error/empty content and existing focus/inert semantics.
- Performance: full-scroll CLS ≤0.1 in 5/5 visits for both viewports; production mobile Lighthouse median ≥60; retain the bilateral slider/performance gate.
- API/data, SEO, security and analytics: none; no request, payload, metadata, URL or event changes.
- Non-goals: map internals, media, article content, headers, chunk volume, per-screen minimum heights, new loading gates or a replacement anchoring algorithm.
- Dependencies: no backend work. Fallback/mock policy: real article and API data; existing unsupported-observer/native behavior remains in the shared transition.
