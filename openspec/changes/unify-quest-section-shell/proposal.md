## Why

The scenario and country quest pages bypass the section navigation and advertising, while the catalog and gameplay use separate layouts. Centering the scenario alone did not satisfy the owner's requirement that quest pages have the same sidebar, advertising, and responsive structure.

## What Changes

- Share the sidebar/drawer frame between the catalog, city, country, scenario, and map surfaces.
- Share one advertising column/inline placement, with existing configured partner offers and real geographic context only.
- Keep gameplay's progress navigation and reading host, while reusing advertising placement without duplicate mounts.
- Preserve content, SEO, existing catalog selection rules, and mobile wrapping fixes.

## Capabilities

### New Capabilities

- `quest-section-shell`: Consistent navigation, advertising, and responsive layout across quest routes.

### Modified Capabilities

None. Catalog country selection and gameplay contracts retain their behavior.

## Impact

- Frontend quest screens/components, route adapters, responsive critical CSS, focused tests and feature documentation.
- Platform impact: shared visual composition; desktop web and mobile web acceptance. Native-specific APIs, signing and store work are outside scope.
- Localization impact: no new copy or resources; reuse existing RU/BE/UK/PL/EN labels and advertising disclosure.
- API/data: unchanged. No new requests for cities; use the existing quest query/cache.
- SEO/accessibility: retain one route H1 and metadata; mobile navigation has a labelled opener, close control and Escape handling.
- Analytics/security: retain configured affiliate attribution, impression gating and centralized external links; do not run catalog-only lifecycle effects on informational routes.
- Fallback: disabled advertising configuration renders no offers or empty reserved rail. No fictional location, mocked advertising, backend changes or content edits.
