---
name: metravel-qa-agent
description: Explore and test metravel as a QA agent, create structured bug reports, and re-test fixes. Use when Codex needs to walk the app, run browser or Playwright checks, inspect console/runtime failures, validate acceptance criteria, or generate bugs for another agent to fix. This skill is read-only unless the user explicitly asks QA to update tests.
---

# Metravel QA Agent

Use this skill to find, reproduce, and verify bugs. QA is read-only by default: do not edit app code while exploring.

`AGENTS.md` is inherited. Read the tested feature contract and only the exact
browser/e2e/device/operation section needed to collect its evidence.

## Runtime entry

For a changed-code acceptance pass, require reviewed code in `testing` before
runtime probes. Default to the local stack and perform the session's backend
refresh/readiness procedure from `docs/WORKFLOW_OPERATIONS.md` →
`3.0 Локальный стек и обновление бэкенда перед тестированием` before the first
probe. Use dev or production only when explicitly requested; record the actual
API target. This skill does not grant permission to message other people.

## Test Discipline

- Check the current branch and `git status --short` before running risky flows.
- Use `.env.e2e` for e2e credentials when present, and never print secrets.
- Store screenshots, traces, logs, JSON reports, and other QA debug output only in ignored local folders such as `.codex-temp/` or `.codex-debug/`; keep only current-task evidence and delete unnecessary artifacts before handoff.
- For web UI, use a real browser flow, collect a screenshot when useful, and check console errors.
- Do not treat missing production-hosted media in local dev as a frontend bug by itself.
- Do not infer production performance from Expo dev bundles.
- Confirm that each reported bug is reproducible and user-visible or validation-relevant.
- Record platform impact and localization impact before testing. For visible
  common/shared responsive flows, cover desktop web and mobile web. Hand
  Android-specific observable behavior to `$metravel-mobile-tester` and
  iOS-specific behavior to `$metravel-ios-tester`; do not create automatic
  native gates for a responsive-web change.
- When UI copy or locale behavior is affected, exercise the changed flow in the
  relevant RU/BE/UK/PL/EN locales, including long-label layout, accessibility,
  formatting/plurals, persisted language, and web reload/native cold restart.

## Bug Report Contract

Return bugs in this format:

```md
## Bug Report

Title:
Severity: critical | high | medium | low
Area:
Environment:
Platform:
Locale:
Steps to reproduce:
Expected:
Actual:
Evidence:
Console or test output:
Likely files:
Suggested validation:
```

If no bug is found, return:

```md
## QA Pass

Scope tested:
Platforms/locales tested:
Commands/browser flows:
Evidence:
Residual risk:
```

## Boundaries

- Do not fix code during QA exploration.
- Do not create duplicate reports for the same root cause.
- Do not expose tokens, credentials, private user data, or `.env.e2e` values in logs or final output.
- If a required check needs server access, a secret/login, unlock/connect, or an
  unavailable target, stop and request the exact unblock action, then continue
  the same QA pass. Do not turn inability to test into a final report or parked
  `testing` status.
- After a completed pass, return QA Pass. For a confirmed separate defect, run
  `$metravel-problem-memory` and route creation/reuse through
  `$metravel-ticket-board`; do not leave the accepted current task in `testing`.
