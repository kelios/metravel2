## Why

Task #3424 remains unfinished: the native quest catalogue map supplies a 2000 km
radius search to the shared map, so server travel-place clusters replace quest
markers. Loading also claims that the map is web-only, and a second Back action
duplicates the native header.

## What Changes

- Render the native quest catalogue as its own points-only dataset without a radius circle.
- Reuse explicit loading, empty and retryable error states on both route surfaces.
- Keep the native header as the single Back action and preserve marker-to-quest navigation.
- Fit global point bounds below the normal radius-map floor when necessary,
  keep that fit after resize, and expose the existing category as the marker's accessible name.
- Preserve the main map's radius and server-cluster contract.

## Capabilities

### New Capabilities
- `native-quest-catalog-map`: truthful native catalogue markers, states and navigation.

### Modified Capabilities
None.

## Impact

- Platform impact: Android and iOS share the changed route and the same WebView renderer; web reuses the state body.
- Localization impact: none; existing RU/BE/UK/PL/EN keys are reused.
- Data/API and dependencies: unchanged; catalogue coordinates remain `lat,lng`, related #3397 establishes the web contract.
- SEO, accessibility and analytics: existing web metadata/marker actions remain; existing accessible error/retry controls are reused; no event changes.
- Performance/security: the quest map does not request server travel-place clusters; no new dependencies, secrets or external URLs.
- Non-goals: main `/map`, quest data, marker clustering, native renderer rewrite, physical-device or store release work.
- Fallback/mock policy: unit tests mock the map boundary; actual acceptance uses the Android emulator and production catalogue, without synthetic production data.
- Open questions: none; direct implementation request authorizes planning and apply.
