## Why

MeTravel has production web and Android surfaces, but its Apple mobile target still needs a complete release contract. The goal is to ship one adaptive iPhone-and-iPad application that preserves the existing product experience, uses the full available iPad window, and reaches App Store review with reproducible evidence instead of treating an upload as proof of readiness.

## What Changes

- Reactivate iOS/iPadOS as supported product surfaces and deliver one universal iPhone-and-iPad v1 with adaptive full-screen and resizable-window behavior.
- Normalize the Expo/Xcode identity, versioning, signing, entitlements, capabilities, permission purpose strings, privacy manifest, and a local Xcode 26 release workflow for `by.metravel.app`.
- Make the shared app safe on iOS and verify the launch-critical flows: anonymous discovery, authentication, travel and quest details, maps/location, profile/settings/account deletion, media upload, sharing, notifications, deep links, localization, offline/error recovery, and cold restart.
- Add Sign in with Apple as an equivalent authentication option because the app offers Google/Facebook login; include the required backend token-verification and account-linking contract as a separately owned dependency.
- Establish iPhone/iPad simulator, physical-device, and TestFlight QA with crash/console/network evidence and regression checks that keep desktop web, mobile web, and Android behavior intact.
- Prepare the App Store Connect record, localized RU/BE/UK/PL/EN product metadata and screenshots, privacy answers, age rating, support/privacy URLs, reviewer notes, and a non-expiring demo account.
- Produce a signed release build, upload it to TestFlight, close beta findings, select the accepted build, and submit the iOS version to App Review.

### User-visible result

An iPhone or iPad user can install MeTravel, use the full available app window in portrait or landscape, browse without forced authentication, sign in with supported methods, use the launch-critical travel/map/quest/profile flows in any current locale, deny optional permissions without losing unrelated functionality, follow `metravel.by` links into the correct screen, and recover their session after a cold restart. The sprint outcome is a release build submitted to App Review; Apple approval timing remains an external outcome.

### Existing behavior to preserve

- Desktop web, mobile web, and Android retain their current navigation, data/API contracts, localized copy, storage behavior, map/place semantics, and release paths.
- Mobile web and Android remain a paired compatibility control for shared UI changes.
- Existing email/password, Google, Facebook, account deletion, secure storage, external-link, media, map, quest, notification, and deep-link contracts are reused rather than replaced wholesale.
- Backend/Django code remains outside this frontend workspace; any new Apple-auth contract is a separate `area=back` task for the backend owner.

### Dependencies and fallback/mock policy

- Owner-controlled prerequisites: an active Apple Developer Program membership, current agreements, an explicit App ID for `by.metravel.app`, App Store Connect access, signing credentials/profiles, APNs/Sign in with Apple capabilities, legal/privacy answers, distribution choices, and access to the required physical Apple devices for agent-driven QA.
- The local toolchain must expose eligible iPhone and iPad simulators for the active Xcode 26 installation. The previously repaired runtime invariant from board task `#957` is reused rather than duplicated.
- Sign in with Apple requires a deployed backend token-verification/account-linking contract before the frontend flow can pass runtime validation.
- Test fixtures and mocked native modules may support unit tests only. Missing signing, Apple-auth, APNs, Universal Link, backend, TestFlight, physical-device, or App Store Connect evidence cannot be replaced by mock success.

### Out of scope / Non-goals

- A separate tablet-only product hierarchy or a broad redesign that diverges from the shared responsive information architecture.
- Apple Watch, visionOS, widgets, App Clips, Apple Pay, in-app purchases, subscriptions, or new monetization.
- A broad redesign of existing MeTravel screens or divergence from the mobile web/Android information hierarchy.
- Rewriting backend services in this repository or fabricating unavailable server behavior in the client.
- Guaranteeing Apple's approval date; the controlled sprint milestone is successful submission to App Review and prompt handling of review feedback.

### Open questions

None block planning. The sprint assumes a universal iPhone-and-iPad v1, a free App Store listing, RU as the primary store language with RU/BE/UK/PL/EN localizations, and submission rather than approval as the dated sprint commitment.

## Capabilities

### New Capabilities

- `ios-app-runtime`: Supported iPhone/iPad installation, adaptive windowing, launch-critical feature parity, permissions, authentication, localization, deep links, secure storage, and recoverable runtime behavior.
- `ios-app-store-release`: Signed release production, TestFlight validation, App Store metadata/privacy/review readiness, and submission-state evidence.

### Modified Capabilities

None; there is no living OpenSpec capability for an iOS application or App Store release.

## Impact

- **Frontend paths:** `app.json`, `eas.json` or its approved successor, tracked `ios/**`, `package.json` release commands, native platform files, auth/storage/notifications/deep-link/map/media services, localization resources, and focused tests. Protected configuration or scripts change only inside their explicit implementation tasks.
- **Data/API:** existing production APIs remain authoritative; Sign in with Apple introduces a separate backend dependency for Apple identity-token verification, stable subject/account linking, private relay email handling, session issuance, and deletion/revocation behavior.
- **Platform impact:** iOS/iPadOS and shared. Every shared edit requires desktop-web regression evidence plus paired mobile-web/Android evidence; Apple mobile additionally requires iPhone/iPad simulator and the capability-appropriate physical-device/TestFlight evidence.
- **Localization impact:** all current locales — RU/BE/UK/PL/EN, including native permission copy, accessibility text, runtime locale persistence, and App Store metadata.
- **Accessibility:** safe areas, Dynamic Type, VoiceOver names/states, focus/keyboard behavior where applicable, contrast, reduced motion, and at least 44-point touch targets must be covered on iPhone and iPad, including resized windows.
- **Performance:** cold launch, route transitions, map/WebView stability, image request cardinality, memory pressure, and release crash/hang evidence must be measured on a release/TestFlight build; no new web bundle regression is accepted from shared changes.
- **SEO:** public web URLs, canonical tags, sitemap, and prerendering do not change; Universal Links must preserve the same `https://metravel.by/...` destinations without redirecting web users away from the site.
- **Security:** signing keys and App Store credentials stay outside Git and logs; tokens use SecureStore; Apple identity tokens are verified server-side; WebView/deep-link inputs are validated; privacy declarations must include third-party SDK behavior.
- **Analytics:** no new tracking is required for launch. Existing analytics must not introduce undeclared tracking or secrets into the iOS bundle; release funnel events may be added only through the existing privacy contract.
