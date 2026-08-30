---
name: metravel-ios-reviewer
description: "Independently review and repair metravel iOS/shared source changes before testing: Expo/Xcode contracts, privacy, auth/storage, links/APNs, maps/media, i18n/a11y, and regressions."
---

# Metravel iOS Reviewer

Use this skill as the independent review-and-fix gate after iOS implementation
and before tester or release handoff. It supplements and may satisfy the
project-wide `$metravel-code-reviewer` gate when the complete task diff is provided.

This is a code-only `review` stage. Inspect source/configuration and run only
static guards, lint, type checks, and focused unit tests. Do not launch Xcode
runtime, simulator, physical devices, or TestFlight; hand those scenarios to
`$metravel-ios-tester` after the reviewed commit enters `testing`.

`AGENTS.md` is inherited. Read `$metravel-code-reviewer`, the changed iOS
subsystem in `$metravel-ios-developer`, and only the native/feature/OpenSpec
contract implicated by the complete task diff.

## Review Focus

- Runtime correctness, startup/lifecycle, WebView/native boundaries, safe areas,
  permissions, error recovery, and unsupported-device behavior.
- Bundle identity/version, resolved Expo/Xcode parity, plist, entitlements,
  privacy manifest, production origins, placeholders, and secret leakage.
- Universal device family, iPad full-screen/resizable portrait-landscape scene
  geometry, and responsive behavior without fixed phone compatibility framing.
- Apple login server boundary, Keychain lifecycle, Universal Link host/route
  validation, APNs permission/token/update/removal, and WebView message trust.
- RU/BE/UK/PL/EN copy and persistence, VoiceOver/Dynamic Type/reduced motion,
  44-point targets, and keyboard/focus order.
- Cross-platform containment for shared files through affected-path automated
  or web controls; do not require Android device evidence for an iOS-specific
  change unless the task investigates a cross-platform regression.
- Test quality: no mocked proof for the primitive under review, no skipped
  tests, and no simulator-only claim for physical/TestFlight behavior.

## Workflow

1. Start from the original task, task-owned paths, full diff, and validation evidence.
2. Read changed functions and configuration in context, including callers and generated/resolved state.
3. Fix every confirmed in-scope finding without rewriting unrelated user changes.
4. Add or update regression coverage when behavior changes.
5. Run the narrowest reliable source-level checks with the operation gate, then
   re-read the entire resulting diff and repeat review/fix/validation until no
   fixable finding remains.
6. Do not recursively launch another reviewer. Return unresolved external state
   as an explicit blocker and owner.

## Boundaries

- Do not mutate backend code, Apple portal state, TestFlight, or App Store state.
- Do not approve a signed build, upload, or submission from source inspection alone.
- Read-only mode is allowed only when the user explicitly requests review without fixes.

## Output Contract

Return `iOS Review and Repair`: fixed findings, open findings, tests and runtime
testing handoff, platform/localization coverage, release blockers, and residual
risk. Never claim simulator/device/TestFlight behavior from review evidence.
