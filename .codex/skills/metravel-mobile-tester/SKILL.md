---
name: metravel-mobile-tester
description: Test metravel mobile behavior across mobile web and Android/native surfaces. Use when Codex needs a mobile tester role for touch targets, responsive layouts, mobile navigation, native smoke checks, USB-connected Android device/dev-client QA, Maestro flows, mobile browser evidence, or regression reports before Android release or mobile UI handoff.
---

# Metravel Mobile Tester

Use this skill for read-only mobile QA across mobile web and Android/native. Do not edit code unless the user explicitly asks to update tests.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/TESTING.md`
- `docs/NATIVE_COMPAT_RULES.md` for Android/native checks
- `docs/MANUAL_TEST_CASES.md` for `AND-USB-*` Android device cases when a device is connected
- Relevant `docs/features/*` files for the tested flow.

## What To Test

- Mobile web responsive flows: home, search/list, map, travel details, places, profile/auth, editor flows when in scope.
- Android/native smoke: app launch, tabs/navigation, map, travel details, search, login/token persistence, favorites, image/media flows, permissions, push prompt, external links.
- iOS/native parity when an iOS simulator/device is available: compare the same
  mobile flow against mobile web and Android rather than accepting a separate
  iOS-only layout.
- Interaction quality: no covered CTAs, no horizontal scroll, stable sheets/modals, reachable close buttons, touch targets near 44px, no broken placeholders, no emoji icons in production UI.
- Runtime health: console errors on web, Metro/runtime errors on native, and relevant `adb logcat` crash lines when available.

## Parity Contract

- Compare mobile web, Android, and iOS against the same intended mobile UX.
  Differences in safe area or native map engine are acceptable; different visual
  hierarchy, action order, card proportions, or tap behavior are bugs.
- For map/place/travel-point checks, verify the shared point/place card:
  fullscreen within visible app chrome, hero image about 70%, title/meta,
  coordinates + copy, article/page action, expandable navigation choices, and
  existing save/add actions.
- Verify the navigation list is complete: Google Maps, Apple Maps, Organic
  Maps/offline, Waze, Яндекс Карты, Яндекс Навигатор, and OpenStreetMap.
- Verify related travel statuses are visible as text ("Был здесь",
  "Хочу поехать", "Планирую" or "Был / Хочу / Планирую"), not only as an icon.
- On travel details, tapping a point card should focus/highlight the map marker
  without opening the popup; tapping the marker should open the fullscreen card.

## Evidence

- Use Playwright mobile viewport or browser preview for mobile web.
- Use emulator/device/dev-client evidence for Android when available.
- If `adb devices -l` shows a connected device, run or explicitly block the relevant `AND-USB-*` cases from `docs/MANUAL_TEST_CASES.md`; do not substitute mobile web viewport evidence for Android device evidence.
- Prefer Maestro flows in `e2e/maestro/` for repeatable native regressions when Java/Maestro are available; if Maestro is blocked, record the blocker and run the matching manual device steps.
- Store screenshots, traces, logs, and temporary captures only in ignored folders such as `.codex-temp/`, `.codex-debug/`, `test-results/`, or `playwright-report/`.
- Never print `.env.e2e` credentials, auth tokens, EAS secrets, or Google Play keys.

## Android USB Device Flow

1. Resolve `adb` with `which adb` on macOS or `where.exe adb` on Windows.
2. Verify the device with `adb devices -l`; `unauthorized` is blocked until the RSA prompt is accepted.
3. Record non-secret environment facts: model, Android release, API level, app build/dev-client.
4. For dev-client, start Metro in LAN/dev-client mode, run `adb reverse tcp:8081 tcp:8081`, resolve the installed scheme with `adb shell dumpsys package by.metravel.app`, then launch by scheme or use Dev Launcher Connect `exp://127.0.0.1:8081`; force a reload after code changes.
5. Clear logcat before the tested action and capture only filtered crash/runtime lines after it:
   `FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|JSApplicationIllegalArgumentException|DevLauncher`.
6. Run the relevant `AND-USB-*` cases and any matching `e2e/maestro/*.yaml` flows.
7. Route confirmed Android/native bugs to `$metravel-android-developer`; route shared UI/layout bugs to `$metravel-ui-guardrails` or `$metravel-feature-builder`.

## Rules

- Stay read-only by default.
- Use `.env.e2e` auth values if already configured, but never echo them.
- Do not treat missing production-hosted media in local dev as a frontend bug by itself.
- Distinguish mobile web from Android/native; a web viewport pass is not Android device verification.
- Confirmed Android/iOS/native app bugs must be routed to `$metravel-android-developer` or the relevant frontend owner and created or updated on the shared board as `area=front` in the current active sprint before handoff. Do not use `area=android`/`area=ios`; keep platform context in the title/description. If the board returns `401`, follow `docs/TASK_BOARD_MCP.md` token refresh via `.env.e2e` without printing secrets.
- Other confirmed bugs should become a compact `Bug Report` for `$metravel-feature-builder` or `$metravel-ui-guardrails`.

## Output Contract

Return one compact artifact:

```md
## Mobile QA Pass

Scope:
Environment:
Scenarios tested:
Test cases:
Findings:
Evidence:
Recommended owner/skill:
Retest needed:
Blockers:
```

For bugs, lead with:

- title
- severity
- environment
- reproduction steps
- expected vs actual
- evidence
- likely owner/skill
