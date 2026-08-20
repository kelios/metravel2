---
name: metravel-mobile-tester
description: Test target-specific metravel behavior on mobile web and/or Android. Use for responsive browser layouts, touch/navigation checks, Android-specific USB local-build QA, Maestro flows, deliberate cross-platform comparisons, or regression reports before a target-specific handoff. Do not run EAS/cloud or store builds without an explicit user request.
---

# Metravel Mobile Tester

Use this skill for read-only target-specific QA on mobile web, Android/native,
or both when the task explicitly needs a comparison. Do not edit code unless
the user explicitly asks to update tests. iPhone-specific QA belongs to
`$metravel-ios-tester`.

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
- Interaction quality: no covered CTAs, no horizontal scroll, stable sheets/modals, reachable close buttons, touch targets near 44px, no broken placeholders, no emoji icons in production UI.
- Runtime health: console errors on web, Metro/runtime errors on native, and relevant `adb logcat` crash lines when available.
- Localization behavior: RU/BE/UK/PL/EN language selection and persistence,
  translated labels/accessibility text, long-label layout, dates/numbers/plurals,
  web reload for mobile-web scope, and Android cold restart for Android scope.

## Target Selection And Parity

- Select the QA target from observable scope before testing:
  - common/shared responsive UI: desktop web plus mobile web; no automatic
    Android or iPhone run
  - Android-specific behavior/configuration/runtime: locally built Android app
  - explicit cross-platform regression or parity investigation: mobile web and
    Android comparison
- Mobile web, Android, and iPhone preserve the same intended mobile UX as a
  product invariant. Differences in safe area or native map engine are
  acceptable; different visual hierarchy, action order, card proportions, or
  tap behavior remain defects when observed. The invariant does not create an
  automatic all-device Done gate.
- Compare the same locale on all affected platforms. A translated web pass does
  not prove native resource loading, storage, formatting, or accessibility behavior.
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

- Use Playwright mobile viewport or browser preview for mobile-web scope.
- Use local-build device evidence for Android-specific observable scope. A web
  viewport is not proof of Android behavior.
- If Android is in scope and `adb devices -l` shows a connected device,
  build/install locally and run the relevant `AND-USB-*` cases from
  `docs/MANUAL_TEST_CASES.md`. If it is absent/locked/unauthorized, request the
  exact connect/unlock/RSA action and continue; do not finish with a pending
  verdict.
- Prefer Maestro flows in `e2e/maestro/` for repeatable native regressions when Java/Maestro are available; if Maestro itself is blocked, run the matching manual device steps.
- Store screenshots, traces, logs, and temporary captures only in ignored folders such as `.codex-temp/`, `.codex-debug/`, `test-results/`, or `playwright-report/`.
- Never print `.env.e2e` credentials, auth tokens, EAS secrets, or Google Play keys.

## Android USB Device Flow

1. Resolve `adb` with `which adb` on macOS or `where.exe adb` on Windows.
2. Verify the device with `adb devices -l`; when absent/locked/`unauthorized`,
   ask the owner to connect/unlock/accept the RSA prompt and resume after it.
3. Record non-secret environment facts: model, Android release, API level, local build/install command, backend/API URL.
4. Check the operation gate, then build/install locally: `cd android && ./gradlew :app:installDebug`, or `:app:assembleDebug` plus `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
5. Force-stop and launch the installed app: `adb shell am force-stop by.metravel.app` then `adb shell monkey -p by.metravel.app 1`.
6. Clear logcat before the tested action and capture only filtered crash/runtime lines after it:
   `FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|JSApplicationIllegalArgumentException|DevLauncher`.
7. Run the relevant `AND-USB-*` cases and any matching `e2e/maestro/*.yaml` flows.
8. Route confirmed Android/native bugs to `$metravel-android-developer`; route shared UI/layout bugs to `$metravel-ui-guardrails` or `$metravel-feature-builder`.

## Rules

- Stay read-only by default.
- Use `.env.e2e` auth values if already configured, but never echo them.
- Do not run Android EAS/cloud builds, Android production builds/submits, or Expo export/dev-client Android QA routes unless the user explicitly asks for that exact path in the current task.
- Do not add iPhone evidence unless iOS-specific observable scope is assigned.
  Route that scope to `$metravel-ios-tester`.
- Do not treat missing production-hosted media in local dev as a frontend bug by itself.
- Distinguish mobile web from Android/native; a web viewport pass is not Android device verification.
- Confirmed Android/native app bugs must be routed to
  `$metravel-android-developer` or the relevant frontend owner. Run
  `$metravel-problem-memory`, then create/reuse the linked shared-board
  `area=front` task in the current active sprint
  before handoff. Keep the actual target and any deliberate parity comparison
  in the title/description. If the board returns `401`, follow `docs/TASK_BOARD_MCP.md`
  token refresh via `.env.e2e` without printing secrets.
- Other confirmed bugs should become a compact `Bug Report` for `$metravel-feature-builder` or `$metravel-ui-guardrails`.
- A completed pass closes the accepted current ticket; it is not parked in
  `testing` because the separate bug has its own linked task.

## Output Contract

Return one compact artifact:

```md
## Mobile QA Pass

Scope:
Targets selected and why:
Environment:
Scenarios tested:
Locales tested:
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
