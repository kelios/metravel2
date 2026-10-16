## Why

Device acceptance and App Review recording repeatedly turn into exploratory debugging. The tracked physical XCTest helper has no business assertions, rebuilds on every invocation, silently chooses a device and has no overall deadline; the Maestro flows have no suite owner or relationship to the App Review scene catalog. The active 2137 session independently found a menu close/reopen failure while trying to finish physical acceptance.

## What Changes

- Audit all project-owned agent/skill/prompt families and repair the native test-authoring, QA and recording entry points and their generated mirrors.
- Add strict, bounded native suite execution and physical XCTest assertions, explicit device selection, reusable helper builds and collision-safe evidence.
- Track reusable regression scenarios and distinguish partial coverage, missing scenarios and physical-only requirements.
- Require an assertion-bearing rehearsal on the exact candidate/environment before recording; preserve completed work and stop repeated operational failures with a precise unblock.

## Capabilities

### New Capabilities

- `native-scenario-readiness`: reproducible native scenario execution and exact-candidate rehearsal before recording.

### Modified Capabilities

None. Existing application behavior and backend contracts remain unchanged.

## Impact

- Platform impact: Android and iOS testing infrastructure; desktop/mobile web application unchanged.
- Localization impact: none in application UI. Scenarios declare their supported locale; RU text-based legacy flows cannot claim all-locale coverage.
- User-visible result: regression failures are found before recording; reports identify the first failed operation instead of requiring open-ended manual replay.
- Paths: native test tools, e2e scenarios, scripts, package commands, project agent/skill prompts, canonical testing/operations docs and OpenSpec artifacts.
- Dependencies: installed Maestro/Xcode tooling and an explicitly selected available target for later runtime verification. The physical device is currently owned by the 2137 session and must not be interrupted.
- Fallback/mock policy: fake process drivers are allowed only for runner unit tests; they never count as application/runtime coverage. Missing scenarios and unavailable hardware remain explicit gaps.
- API/data, SEO, app accessibility, bundle performance and analytics: unchanged. Test data setup/cleanup and hardware-only behaviors retain their existing gates.
- Security: no automatic provisioning mutations, no credentials in reports/scripts, no auto-lock changes, unique ignored evidence, no substitution of simulator evidence for a physical candidate.
- Preserve: existing private clipboard/canary, explicit permission choices, exact-build provenance, existing board/review/store stage authority.
- Non-goals: fixing application defects owned by the active 2137 session; backend changes; store build/upload/submit; capturing video or taking over an occupied device; claiming comprehensive runtime coverage from static validation.
- Open questions: none blocking infrastructure implementation. Full App Review runtime acceptance still depends on executed scenario and attestation coverage.
