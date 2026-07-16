---
name: metravel-ios-developer
description: Reserved future-iOS route for metravel. Use only after the user explicitly reactivates iOS application work; never select it for normal QA, Done gates, or shared-change validation while iOS is inactive.
---

# Metravel iOS Developer

The iOS application is currently inactive. Do not use this skill for normal
implementation, QA, release readiness, or `verify pending`. It becomes active
only after a new explicit user decision that puts future iOS work in scope.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/NATIVE_COMPAT_RULES.md`
- `docs/features/map.md` for map/place work

## Scope

- `.ios.tsx`, `.native.tsx`, `.web.tsx`, and narrow `Platform.OS === 'ios'` branches.
- WKWebView/Safari behavior, safe-area/notch/home-indicator layout, iOS permissions, Keychain/SecureStore, APNs, Face ID/Touch ID, sharing, SFSafariViewController, deep links, and Universal Links.
- iOS locale lifecycle: `expo-localization`, versioned preference storage,
  RU/BE/UK/PL/EN resources, Intl/plurals, translated accessibility text, and cold restart behavior.
- `components/MapPage/Map.ios.tsx`: keep Leaflet/react-leaflet out of native bundles and preserve the shared map/card UI contract.

## Rules

- Stop if iOS was not explicitly reactivated in the current user request. Route
  current product work to desktop web, mobile web, and Android skills instead.

- If explicitly reactivated, keep any future iOS work from regressing the active
  mobile-web/Android contract. Platform files may change engines, APIs, insets,
  and shadows, not hierarchy, action order, card proportions, or tap semantics.
- Prefer a platform file for structural differences; use a local `Platform.OS` gate only for a small property or API difference.
- Guard `window`, `document`, storage, DOM events/observers, and web-only imports in shared files.
- Use `useSafeAreaInsets`; do not hardcode notch, Dynamic Island, or home-indicator offsets.
- Require HTTPS for iOS resources. Treat ATS failures, APNs permission order, and missing `NS*UsageDescription` values as configuration findings.
- Do not edit `app.json`, `eas.json`, `plugins/**`, or release scripts unless the user explicitly asked for that configuration change.
- Use `utils/externalLinks.ts`, `utils/secureStorage.ts`, and the project image wrappers instead of direct platform calls.
- Follow `$metravel-i18n-guardrails`; do not add iOS-only hardcoded app copy or
  locale formatting outside `i18n/format.ts`.
- Route backend/API gaps to an `area=back` board task; never edit backend code from this workspace.
- Never turn inactive iOS scaffolding into a QA/Done-gate requirement by inference.

## Workflow

1. Reproduce or map the iOS-only path and read the whole guarded effect/function before calling a web API reference unsafe.
2. Check adjacent Android/web implementations and preserve the common mobile contract.
3. Implement the smallest platform split or guard.
4. Run targeted tests, native compatibility governance, and `npm run check:fast` for a finished code block; add `npm run test:i18n` when locale behavior or UI copy changed.
5. Only after explicit reactivation, define the requested iOS validation path;
   otherwise stop without adding simulator/device work or `verify pending`.
6. Do not start any EAS iOS build or submit unless the user explicitly requested that exact build/submit in the current task.

## Handoff

If explicitly reactivated, report the future-iOS scope, files changed, active
mobile-web/Android impact, checks run, and separately authorized evidence.
