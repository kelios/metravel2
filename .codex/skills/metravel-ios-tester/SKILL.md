---
name: metravel-ios-tester
description: "Read-only metravel iPhone/iPad QA on simulator, physical device, or authorized TestFlight build. Use for launch, adaptive windows, permissions, auth/Keychain, links, maps/media, locales, accessibility, offline, or crashes."
---

# Metravel iOS Tester

Use this skill for read-only iPhone/iPad QA. A simulator pass proves neither signing
nor physical-device/TestFlight behavior.

`AGENTS.md` is inherited. Load the exact test layer/cases for the affected
subsystem from testing, native, and manual-test docs; use release OpenSpec only
for candidate acceptance.

## Test Layers

1. **Simulator:** clean launch without Metro when applicable, guest/auth shell,
   navigation, five locales, safe areas, keyboard, loading/error/offline states,
   basic links, and fatal/runtime log scan.
   On iPad also cover full-screen and resized windows in portrait and landscape.
2. **Physical iPhone:** camera/photo/HEIC, location, sharing, Keychain cold
   restart, biometrics, external apps, real safe areas, Universal Links, and
   permission allow/deny/restricted paths.
3. **Physical iPad:** exact tablet window geometry, full-screen/windowed
   rotation, touch targets, safe areas, keyboard, and accessibility acceptance.
4. **TestFlight candidate:** exact processed build, fresh install/update,
   production origins, Apple login, APNs delivery and notification routing,
   iPad device-family/window geometry, account deletion visibility, five locales,
   accessibility, offline recovery, crash/hang evidence, and launch-critical product matrix.

Use `docs/MANUAL_TEST_CASES.md` cases `IOS-01..15` as the repeatable baseline;
select only the cases required by the assigned Task Contract for non-release work.

## Rules

- Stay read-only unless the user explicitly asks to update tests or fixtures.
- Record build/version, simulator or device model, iOS version, backend target,
  account mode, locale, scenario, expected/actual result, and ignored evidence path.
- Do not expose Apple accounts, Team ID, UDID, tokens, reviewer credentials,
  signing material, or notification payload secrets.
- For local device signing, resolve `DEVELOPMENT_TEAM` from the selected Xcode
  team or provisioning profile `TeamIdentifier`; never infer it from the
  parenthesized suffix of a `security find-identity` display name. Before
  declaring a certificate missing, verify that the profile matches the bundle
  and device, contains the required entitlements, and that one of its
  `DeveloperCertificates` fingerprints matches a local codesigning identity.
- Treat an Xcode-managed profile as automatic-signing state. If its capabilities
  are stale, refresh it with automatic signing only when the user authorized the
  profile mutation; do not force that profile through manual signing. Redact the
  team, device, certificate, profile, and account identifiers from evidence.
- Do not replace physical/TestFlight evidence with a simulator screenshot.
- If the required Apple device is not visible, locked, or needs trust/login, stop and
  ask the owner for that exact connect/unlock/trust action, then resume the same
  test. Missing device access is not a final pending verdict or a reason to park
  a ticket in `testing`.
- Compare with mobile web or Android only when the assigned iOS task explicitly
  investigates a cross-platform regression or parity defect. Ordinary
  iOS-specific acceptance does not require either client as an extra gate.
- A denied optional permission must leave unrelated browsing usable. A missing
  capability, AASA response, APNs delivery, or Apple backend contract is a
  concrete blocker, not a mocked pass.
- Confirmed iOS bugs run `$metravel-problem-memory`, then create/reuse a linked
  `area=front` task with an `[IOS-...]` title in the active sprint;
  backend/API/server causes use a linked `area=back` task. The accepted current
  ticket is closed rather than parked for that separate defect.
- Do not build, upload, assign TestFlight groups, submit to review, or release a
  version without the exact authorization owned by `$metravel-ios-release-operator`.

## Output Contract

```md
## iOS QA Pass

Build and environment:
Layer: iPhone simulator | iPad simulator | physical iPhone | physical iPad | TestFlight
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
