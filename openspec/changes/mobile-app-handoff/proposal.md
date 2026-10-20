## Why

Mobile visitors do not reliably see an app offer: the existing bar waits 12 seconds and a saved cookie decision, and a store click suppresses it permanently. There is no open-app action or Safari Smart App Banner. The goal is a discoverable, dismissible offer that opens the current supported page in the installed app or offers the official store.

## What Changes

- Add Safari's native installation-aware Smart App Banner to exported HTML.
- Extend the existing mobile offer with explicit Open and Install actions, displayed without a cookie decision; stack above other bottom banners.
- Use the existing native route allowlist, Android package-bound intents with official-store fallback, and explicit iOS custom-scheme links. Never redirect automatically on page load or claim browser-side installation detection.
- Remove permanent suppression after store clicks; preserve explicit dismissals with a bounded cooldown.
- Localize labels and accessibility text in RU/BE/UK/PL/EN.

## Capabilities

### New Capabilities

- `mobile-app-handoff`: mobile website offers native app opening and installation.

### Modified Capabilities

None.

## Impact

- Platform impact: mobile web, Android/iOS browser-to-app handoff; desktop web must remain free of the custom bar. No native configuration or store build.
- Localization impact: all current locales, sharedStatic namespace.
- Frontend paths: existing app install bar/state, shared bottom reserves and consent measurement, external navigation helper, HTML metadata, new link builder and focused tests.
- Dependencies: already registered `metravel` scheme, package `by.metravel.app`, App Store ID `6801264369`; actual OS dispatch requires devices. No API/data changes.
- SEO: additive head metadata; canonical URLs, indexing and editorial content preserved.
- Accessibility: labelled actions, dismiss control and wrapping translated text; no modal/focus capture.
- Performance: reuse mobile-only lazy chunk and existing icon; no installation polling or extra requests.
- Security: reuse incoming-link policy, fixed package/store URLs, no arbitrary intent components.
- Analytics: preserve installation-click goal; record open intent separately, never as proof of installation.
- Fallback/mock policy: unsupported routes open the app map; Android browser fallback uses Google Play; iOS offers a separate App Store action. Unit mocks cannot certify OS dispatch.
- Non-goals: forced redirects, native release, backend/AASA changes, universal installed-app detection, deferred deep links after installing.
- Open questions: none blocking implementation. Physical device availability may limit runtime evidence and must be reported explicitly.
