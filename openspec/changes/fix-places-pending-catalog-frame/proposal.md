## Why

Task #3387 independently reproduced mobile `/places` CLS 0.3924044352233086 on production `292c85ba3f431ba9fba8fd0e0919d2f6f03fc290`, 390×844, fresh guest Chromium (12 November 2026). Before the first catalog request starts, its pending/idle state temporarily renders an empty result and removes the skeleton grid; the principal layout shift is 0.3704854781869.

## What Changes

- Preserve the catalog loading frame until the current request has either data or a terminal error, including cache restoration before fetching starts.
- Add deterministic restoration/URL-transition regression coverage and a cold browser check for grid continuity and full CLS.
- Preserve default starter categories, explicit empty-category intent, URL hydration parity, request budgets and settled empty/error behavior.

## Capabilities

### New Capabilities

- `catalog-place-initial-frame`: stable initial catalog geometry while the initial result is unresolved.

### Modified Capabilities

None.

## Impact

- User-visible result: the initial catalog no longer flashes an empty state or collapses before its first request.
- Platform impact: shared status derivation; mobile web390 is the measured boundary and desktop1280 the required control. No distinct native behavior or device gate changes.
- Localization impact: none; no text, keys or formatting changes.
- Owned paths: `screens/tabs/usePlacesCatalogController.ts`, focused tests in `__tests__/screens/PlacesScreen.hydration.test.tsx`, `e2e/places.spec.ts`, and this change.
- API/data: existing read-only catalog GET and query keys remain unchanged. No backend dependency.
- SEO/accessibility/security/analytics: existing markup semantics, navigation, secrets, events and SEO policy remain unchanged.
- Performance: target full unfiltered initial CLS≤0.1 in five fresh production mobile390 visits; retain all shift sources. No request or bundle growth is intended.
- Fallback/mock policy: first baseline and final acceptance use real production data; deterministic restoration and catalog fixtures may support permanent regressions without replacing live evidence.
- Non-goals: banner #3386, article #3382, catalog data, API, locale bootstrap, URL semantics, unrelated filter/style cleanup, thresholds and protected paths.
- Open questions: none blocking the bounded restoration-state regression; after deployment any remaining measured CLS>0.1 requires renewed causal evidence.
