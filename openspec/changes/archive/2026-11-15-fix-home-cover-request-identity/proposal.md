## Why

Task #3437: Home quest covers switch from landscape snapshot URLs to square API URLs; bundled Tre Cime also gains ineffective resize parameters. Cold baseline shows 5 duplicate files on mobile and 6 on desktop.

## What Changes

A healthy home load and five viewport scrolls request at most one effective URL per quest cover, Tre Cime file and visible travel cover.

## Capabilities

### New Capabilities
- `home-cover-identity`: bounded request identity for the affected public web surface.

### Modified Capabilities
None.

## Impact

Paths: hooks/useQuestsApi.ts, components/home/HomeQuestsPromoSection.tsx, components/quests/QuestForCityCard.tsx, utils/imageProxy.ts. Platform impact: desktop web and mobile web; existing native API/media callers retain their contracts. Localization impact: none. Data/API: existing response fields and endpoint semantics preserved. SEO/accessibility/analytics/security: existing metadata, alt, session and event contracts preserved. Performance: zero duplicate URLs/redirects, measured in the stored real production baseline. No backend changes, catalog redesign, content changes or new dependencies. No hard dependencies. Mock policy: deterministic unit fixtures may prove code behavior; final acceptance uses the real published URLs. No unresolved product choices.
