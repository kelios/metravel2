---
name: metravel-ios-developer
description: Implement and debug MeTravel iPhone/iPad source and configuration, then hand runtime QA to testing. Use for iOS/iPadOS platform files, adaptive windows, permissions, Apple auth, links, maps, media, safe areas, and native regressions; not App Store operations.
---

# Metravel iOS Developer

Use this skill for implementation and debugging of the active universal
iPhone/iPad MeTravel application, including adaptive iPad scenes.

Implementation and `review` are code-only. Do not launch simulator, physical
device, browser, or TestFlight; prepare the exact case for `$metravel-ios-tester`
after code-review pass and status=`testing`.

`AGENTS.md` is inherited. Load the affected native/feature section and exact
simulator/device case; use the iOS OpenSpec or development guidance only when
the requested subsystem depends on it.

## Scope

- `.ios.tsx`, `.native.tsx`, `.web.tsx`, tracked `ios/**`, and narrow
  `Platform.OS === 'ios'` branches.
- Xcode/simulator startup, WKWebView/Safari behavior, safe areas, keyboard,
  Dynamic Type, VoiceOver, reduced motion, and iPhone navigation lifecycle.
- Keychain/SecureStore, Sign in with Apple client integration, APNs client flow,
  Universal Links, location, camera/photo/HEIC, sharing, and native map behavior.
- iOS locale lifecycle for RU/BE/UK/PL/EN, including cold restart and native
  permission/accessibility copy.

## Boundaries

- Preserve desktop web, mobile web, and Android. Shared mobile product behavior
  stays aligned across mobile web, Android, and iPhone; platform files may adapt
  engines, permissions, insets, and OS APIs, not information hierarchy or primary actions.
- Prefer a platform file for structural or dependency differences. Use a local
  platform gate only for a small property or API difference.
- Guard DOM/web APIs and imports in shared files. Keep Leaflet/react-leaflet out
  of native bundles and native-only modules out of web bundles.
- Use `utils/externalLinks.ts`, `utils/secureStorage.ts`, existing image wrappers,
  shared i18n resources, and existing auth/session stores.
- Treat missing usage strings, entitlements, privacy declarations, ATS HTTPS,
  AASA, APNs credentials, and Apple server verification as fail-closed findings.
- Protected release/config paths (`app.json`, `eas.json`, `plugins/**`,
  `scripts/**`, tracked Xcode project settings) change only when the current user
  request or assigned board task explicitly puts that configuration in scope.
- Backend changes remain `area=back` work. Never implement Apple token
  verification, AASA hosting, or server push behavior in this frontend checkout.
- Signed distribution builds, App Store Connect uploads, TestFlight assignment,
  App Review submission, and storefront release belong to
  `$metravel-ios-release-operator`, each with its own authorization gate.

## Workflow

1. Record iOS/shared platform impact, RU/BE/UK/PL/EN impact, assigned board task,
   and exact files/configuration in scope.
2. Read the whole guarded effect/function before classifying a shared reference
   as unsafe. Record the exact simulator/physical-device reproduction for the
   testing handoff; do not launch it during implementation or review.
3. Compare the existing web and Android implementation and make the smallest
   platform split that preserves the common product contract.
4. Add focused regression coverage. For configuration changes, verify resolved
   Expo config, Xcode settings, plist/entitlements/privacy files, and production origins.
5. Run targeted tests, native compatibility governance, `npm run check:fast`,
   and `npm run test:i18n` when locale or app-owned copy changed. For shared
   files, run web controls only when their web path is affected; do not create an
   automatic Android device gate for iOS work.
6. Hand the complete diff and code-level evidence to `$metravel-ios-reviewer`;
   after code-review pass and status=`testing`, hand the runtime scenario/build
   to `$metravel-ios-tester`.

## Output Contract

Report the iOS requirement or bug, changed files, platform split, configuration
impact, simulator/device testing handoff, shared-platform code controls, checks
run, and any release/backend/owner dependency. Never claim runtime or App Store
readiness from implementation/review evidence.
