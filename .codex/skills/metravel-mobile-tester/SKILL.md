---
name: metravel-mobile-tester
description: Test metravel mobile behavior across mobile web and Android/native surfaces. Use when Codex needs a mobile tester role for touch targets, responsive layouts, mobile navigation, native smoke checks, device/emulator QA, mobile browser evidence, or regression reports before Android release or mobile UI handoff.
---

# Metravel Mobile Tester

Use this skill for read-only mobile QA across mobile web and Android/native. Do not edit code unless the user explicitly asks to update tests.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/TESTING.md`
- `docs/NATIVE_COMPAT_RULES.md` for Android/native checks
- Relevant `docs/features/*` files for the tested flow.

## What To Test

- Mobile web responsive flows: home, search/list, map, travel details, places, profile/auth, editor flows when in scope.
- Android/native smoke: app launch, tabs/navigation, map, travel details, search, login/token persistence, favorites, image/media flows, permissions, push prompt, external links.
- Interaction quality: no covered CTAs, no horizontal scroll, stable sheets/modals, reachable close buttons, touch targets near 44px, no broken placeholders, no emoji icons in production UI.
- Runtime health: console errors on web, Metro/runtime errors on native, and relevant `adb logcat` crash lines when available.

## Evidence

- Use Playwright mobile viewport or browser preview for mobile web.
- Use emulator/device/dev-client evidence for Android when available.
- Store screenshots, traces, logs, and temporary captures only in ignored folders such as `.codex-temp/`, `.codex-debug/`, `test-results/`, or `playwright-report/`.
- Never print `.env.e2e` credentials, auth tokens, EAS secrets, or Google Play keys.

## Rules

- Stay read-only by default.
- Use `.env.e2e` auth values if already configured, but never echo them.
- Do not treat missing production-hosted media in local dev as a frontend bug by itself.
- Distinguish mobile web from Android/native; a web viewport pass is not Android device verification.
- Confirmed bugs should become a compact `Bug Report` for `$metravel-android-developer`, `$metravel-feature-builder`, or `$metravel-ui-guardrails`.

## Output Contract

Return one compact artifact:

```md
## Mobile QA Pass

Scope:
Environment:
Scenarios tested:
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
