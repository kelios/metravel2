---
name: metravel-ios-developer
description: Implement and debug iOS/iPadOS compatibility in the metravel Expo React Native app. Use for `.ios.tsx` or shared native code, iPhone/iPad crashes, WebKit/WKWebView behavior, safe areas, APNs, Face ID, iOS permissions, ATS, Universal Links, native maps, or behavior that differs between iOS, Android, and mobile web. Do not run EAS/cloud builds or submits without an explicit user request.
---

# Metravel iOS Developer

Use this skill for iOS-specific frontend implementation and diagnosis while preserving production web and Android behavior.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/NATIVE_COMPAT_RULES.md`
- `docs/features/map.md` for map/place work

## Scope

- `.ios.tsx`, `.native.tsx`, `.web.tsx`, and narrow `Platform.OS === 'ios'` branches.
- WKWebView/Safari behavior, safe-area/notch/home-indicator layout, iOS permissions, Keychain/SecureStore, APNs, Face ID/Touch ID, sharing, SFSafariViewController, deep links, and Universal Links.
- `components/MapPage/Map.ios.tsx`: keep Leaflet/react-leaflet out of native bundles and preserve the shared map/card UI contract.

## Rules

- Keep mobile web, Android, and iOS visually and behaviorally aligned. Platform files may change engines, APIs, insets, and shadows, not hierarchy, action order, card proportions, or tap semantics.
- Prefer a platform file for structural differences; use a local `Platform.OS` gate only for a small property or API difference.
- Guard `window`, `document`, storage, DOM events/observers, and web-only imports in shared files.
- Use `useSafeAreaInsets`; do not hardcode notch, Dynamic Island, or home-indicator offsets.
- Require HTTPS for iOS resources. Treat ATS failures, APNs permission order, and missing `NS*UsageDescription` values as configuration findings.
- Do not edit `app.json`, `eas.json`, `plugins/**`, or release scripts unless the user explicitly asked for that configuration change.
- Use `utils/externalLinks.ts`, `utils/secureStorage.ts`, and the project image wrappers instead of direct platform calls.
- Route backend/API gaps to an `area=back` board task; never edit backend code from this workspace.
- Never claim iOS readiness from web or Android evidence alone.

## Workflow

1. Reproduce or map the iOS-only path and read the whole guarded effect/function before calling a web API reference unsafe.
2. Check adjacent Android/web implementations and preserve the common mobile contract.
3. Implement the smallest platform split or guard.
4. Run targeted tests, native compatibility governance, and `npm run check:fast` for a finished code block.
5. Verify shared-file changes on web. Verify iOS on an available simulator/device; if none is available, report `verify pending` with the exact missing path.
6. Do not start any EAS iOS build or submit unless the user explicitly requested that exact build/submit in the current task.

## Handoff

Report the iOS issue, files changed, platform strategy, web/Android impact, checks run, simulator/device evidence, and any exact `verify pending` blocker.
