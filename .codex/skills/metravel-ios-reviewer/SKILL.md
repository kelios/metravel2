---
name: metravel-ios-reviewer
description: Review and repair MeTravel iOS and shared-code changes before iPhone testing or release. Use for an independent review-and-fix pass over iOS runtime code, Xcode and Expo configuration, entitlements, privacy manifests, permissions, authentication, storage, links, notifications, maps, media, localization, accessibility, cross-platform regressions, and release-readiness claims.
---

# Metravel iOS Reviewer

Use this skill as the independent review-and-fix gate after iOS implementation
and before tester or release handoff. It supplements and may satisfy the
project-wide `$metravel-code-reviewer` gate when the complete task diff is provided.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `.codex/skills/metravel-code-reviewer/SKILL.md`
- `.codex/skills/metravel-ios-developer/SKILL.md`
- `docs/NATIVE_COMPAT_RULES.md`
- Relevant OpenSpec and feature contracts.

## Review Focus

- Runtime correctness, startup/lifecycle, WebView/native boundaries, safe areas,
  permissions, error recovery, and unsupported-device behavior.
- Bundle identity/version, resolved Expo/Xcode parity, plist, entitlements,
  privacy manifest, production origins, placeholders, and secret leakage.
- Apple login server boundary, Keychain lifecycle, Universal Link host/route
  validation, APNs permission/token/update/removal, and WebView message trust.
- RU/BE/UK/PL/EN copy and persistence, VoiceOver/Dynamic Type/reduced motion,
  44-point targets, and keyboard/focus order.
- Cross-platform containment for every shared file: desktop web plus the same
  mobile-web/Android control flow.
- Test quality: no mocked proof for the primitive under review, no skipped
  tests, and no simulator-only claim for physical/TestFlight behavior.

## Workflow

1. Start from the original task, task-owned paths, full diff, and validation evidence.
2. Read changed functions and configuration in context, including callers and generated/resolved state.
3. Fix every confirmed in-scope finding without rewriting unrelated user changes.
4. Add or update regression coverage when behavior changes.
5. Run the narrowest reliable checks with the operation gate, then re-read the
   entire resulting diff and repeat review/fix/validation until no fixable finding remains.
6. Do not recursively launch another reviewer. Return unresolved external state
   as an explicit blocker and owner.

## Boundaries

- Do not mutate backend code, Apple portal state, TestFlight, or App Store state.
- Do not approve a signed build, upload, or submission from source inspection alone.
- Read-only mode is allowed only when the user explicitly requests review without fixes.

## Output Contract

Return `iOS Review and Repair`: fixed findings, open findings, tests and runtime
evidence, platform/localization coverage, release blockers, and residual risk.
