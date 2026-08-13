---
name: metravel-ios-tester
description: Test the active MeTravel iPhone application on an eligible simulator, a physical iPhone, and an authorized TestFlight candidate. Use for launch and core-flow QA, permissions, Apple login, Keychain persistence, Universal Links, maps, HEIC/media, APNs, localization, accessibility, offline recovery, crash evidence, and release-candidate retesting. Stay read-only by default.
---

# Metravel iOS Tester

Use this skill for read-only iPhone QA. A simulator pass proves neither signing
nor physical-device/TestFlight behavior.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/TESTING.md`
- `docs/NATIVE_COMPAT_RULES.md`
- `docs/MANUAL_TEST_CASES.md`
- `openspec/changes/launch-ios-app-store/` for release acceptance.

## Test Layers

1. **Simulator:** clean launch without Metro when applicable, guest/auth shell,
   navigation, five locales, safe areas, keyboard, loading/error/offline states,
   basic links, and fatal/runtime log scan.
2. **Physical iPhone:** camera/photo/HEIC, location, sharing, Keychain cold
   restart, biometrics, external apps, real safe areas, Universal Links, and
   permission allow/deny/restricted paths.
3. **TestFlight candidate:** exact processed build, fresh install/update,
   production origins, Apple login, APNs delivery and notification routing,
   account deletion visibility, five locales, accessibility, offline recovery,
   crash/hang evidence, and launch-critical product matrix.

Use `docs/MANUAL_TEST_CASES.md` cases `IOS-01..14` as the repeatable baseline;
select only the cases required by the assigned Task Contract for non-release work.

## Rules

- Stay read-only unless the user explicitly asks to update tests or fixtures.
- Record build/version, simulator or device model, iOS version, backend target,
  account mode, locale, scenario, expected/actual result, and ignored evidence path.
- Do not expose Apple accounts, Team ID, UDID, tokens, reviewer credentials,
  signing material, or notification payload secrets.
- Do not replace physical/TestFlight evidence with a simulator screenshot.
- For shared behavior, compare the same state and locale with mobile web and
  Android; route shared failures to the relevant feature owner.
- A denied optional permission must leave unrelated browsing usable. A missing
  capability, AASA response, APNs delivery, or Apple backend contract is a
  concrete blocker, not a mocked pass.
- Confirmed iOS bugs use `area=front` and an `[IOS-...]` title in the active
  sprint; backend/API/server causes use a linked `area=back` task.
- Do not build, upload, assign TestFlight groups, submit to review, or release a
  version without the exact authorization owned by `$metravel-ios-release-operator`.

## Output Contract

```md
## iOS QA Pass

Build and environment:
Layer: simulator | physical iPhone | TestFlight
Scenarios and locales:
Findings:
Crash/runtime evidence:
Shared-platform controls:
Recommended owner:
Retest required:
Blockers:
```

For a bug, lead with title, severity, exact reproduction, expected/actual,
evidence, suspected owner layer, and whether the release candidate is blocked.
