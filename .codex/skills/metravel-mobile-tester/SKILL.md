---
name: metravel-mobile-tester
description: Test target-specific metravel behavior on mobile web or Android. Use for responsive layouts, touch/navigation checks, Android emulator/device QA, Maestro flows, cross-platform regressions, or a target-specific handoff.
---

# Metravel Mobile Tester

Use this skill for read-only target-specific QA on mobile web, Android/native,
or both when the task explicitly needs a comparison. Do not edit code unless
the user explicitly asks to update tests. iPhone-specific QA belongs to
`$metravel-ios-tester`.

`AGENTS.md` is inherited. Apply `docs/TESTING.md` → `Validation selection gate`
before target-specific runbooks or readiness. Return unjustified Android
assignments for refinement before inventory/stamp/build; an inherited platform
list is not enough. Then read the feature contract and admitted browser/native
cases; physical cases apply only to the selected capability/USB/release layer.

## Repeatable native scenarios

For an admitted Android target, use `docs/TESTING.md` →
`Native scenario automation and recording readiness`
for tracked suites, readiness identity, retry limits and coverage gaps. Execute
only the assigned assertion-bearing suite in `testing`; actions or screenshots
alone do not prove the business outcome. Maestro covers Android/iOS simulator UI;
physical Apple-device scenarios use XCTest. New product bugs need a failing
regression and implementation → review → affected retest. Capture requires a
passing matching rehearsal; do not debug during recording. Report pass/fail/
uncovered separately and do not repeat unchanged passing scope.

## Runtime entry

For a changed-code acceptance pass, require reviewed code in `testing` before
runtime probes. Refresh/readiness of the local backend (WORKFLOW_OPERATIONS §3.0)
is required only for local runtime probes. Use the gate-qualified target and inherited acceptance pipeline;
record the actual API target. Dev remains an explicit owner choice. This skill does not grant permission to message other people.

## What To Test

These are candidate risks for the selected assertions, not a default full sweep.

- Mobile web responsive flows: home, search/list, map, travel details, places, profile/auth, editor flows when in scope.
- Android/native smoke: app launch, tabs/navigation, map, travel details, search, login/token persistence, favorites, image/media flows, permissions, push prompt, external links.
- Interaction quality: no covered CTAs, no horizontal scroll, stable sheets/modals, reachable close buttons, touch targets near 44px, no broken placeholders, no emoji icons in production UI.
- Runtime health: console errors on web, Metro/runtime errors on native, and relevant `adb logcat` crash lines when available.
- Localization behavior: RU/BE/UK/PL/EN language selection and persistence,
  translated labels/accessibility text, long-label layout, dates/numbers/plurals,
  web reload for mobile-web scope, and Android cold restart for Android scope.

## Target Selection And Parity

- Select targets and reusable evidence through `docs/TESTING.md` →
  `Risk-based validation and evidence reuse`: responsive changes use mobile web
  first and desktop web; identical shared behavior is checked once. Android-only
  implementation uses a local emulator build, with physical evidence only for
  capabilities or an assigned device/release gate.
- Mobile web, Android, and iPhone preserve the same intended mobile UX as a
  product invariant. Differences in safe area or native map engine are
  acceptable; different visual hierarchy, action order, card proportions, or
  tap behavior remain defects when observed. The invariant does not create an
  automatic all-device Done gate.
- Compare locales/platforms only for distinct affected risks. A translated web
  pass does not prove a changed native locale-storage or lifecycle boundary.
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
- Use compatible local emulator evidence for Android-specific UI/logic. A web viewport
  is not proof of native behavior. For a required physical/USB case, check
  `adb devices -l`, then reuse the prepared
  installed candidate when app/source/backend identity matches the assignment.
  Build/install locally once per required binary only when that identity is
  missing or mismatched; an exact store candidate is handled by its release
  operator instead. Run assigned `AND-USB-*` cases. Missing/locked/unauthorized
  device requires the exact connect/unlock/RSA action and continuation.
- Prefer tracked Maestro regressions for repeatable Android UI checks. A manual
  fallback can provide assigned device evidence, but leaves the automation gate
  blocked; record that gap and the exact environment repair.
- Never print `.env.e2e` credentials, auth tokens, EAS secrets, or Google Play keys.

## Android USB Device Flow

Use this flow only for a required physical capability or an assigned USB/release
gate; ordinary Android-specific UI/logic uses the affected emulator.

1. Resolve `adb` with `which adb` on macOS or `where.exe adb` on Windows.
2. Verify the device with `adb devices -l`; when absent/locked/`unauthorized`,
   ask the owner to connect/unlock/accept the RSA prompt and resume after it.
3. Record non-secret environment facts: model, Android release, API level, local build/install command, backend/API URL.
4. Verify the prepared candidate's app/source/backend identity. Reuse it across
   cases; when a new local binary is required, check the operation gate and
   build/install once through the Android local-build contract. Do not replace
   an assigned exact store candidate with a debug build.
5. Launch normally; force-stop/relaunch only when the assigned case requires a
   cold-start/session precondition, not between every step or scene.
6. Keep filtered crash/runtime capture for the batch and inspect checkpoints or
   failure; clear logcat once before the assigned batch if needed, not per tap:
   `FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|JSApplicationIllegalArgumentException|DevLauncher`.
7. Run the relevant `AND-USB-*` cases and any matching `e2e/maestro/*.yaml` flows.
8. Route confirmed Android/native bugs to `$metravel-android-developer`; route shared UI/layout bugs to `$metravel-ui-guardrails` or `$metravel-feature-builder`.

## Rules

- Stay read-only by default.
- Use `.env.e2e` auth values if already configured, but never echo them.
- Android EAS/cloud builds and submits are prohibited. Production store builds
  and submissions belong to `$metravel-google-play-operator` for the authorized
  stage. Use the assigned local Android QA layer through the operation gate.
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

A defect that fails the current Task Contract keeps that ticket unaccepted; a
separate linked bug is appropriate only when current Acceptance Criteria pass.
