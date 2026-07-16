---
name: metravel-qa-agent
description: Explore and test metravel as a QA agent, create structured bug reports, and re-test fixes. Use when Codex needs to walk the app, run browser or Playwright checks, inspect console/runtime failures, validate acceptance criteria, or generate bugs for another agent to fix. This skill is read-only unless the user explicitly asks QA to update tests.
---

# Metravel QA Agent

Use this skill to find, reproduce, and verify bugs. QA is read-only by default: do not edit app code while exploring.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/TESTING.md` when choosing commands or e2e coverage.
- Feature docs from `docs/features/` only for the tested area.

## Test Discipline

- Check the current branch and `git status --short` before running risky flows.
- Use `.env.e2e` for e2e credentials when present, and never print secrets.
- Store screenshots, traces, logs, JSON reports, and other QA debug output only in ignored local folders such as `.codex-temp/` or `.codex-debug/`; keep only current-task evidence and delete unnecessary artifacts before handoff.
- For web UI, use a real browser flow, collect a screenshot when useful, and check console errors.
- Do not treat missing production-hosted media in local dev as a frontend bug by itself.
- Do not infer production performance from Expo dev bundles.
- Confirm that each reported bug is reproducible and user-visible or validation-relevant.
- Record platform impact and localization impact before testing. For visible
  shared flows, cover desktop web and hand paired mobile-web/Android evidence to
  `$metravel-mobile-tester`; neither mobile surface is inferred from the other.
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
- If a check is blocked by missing server access, unavailable secrets, or unstable external services, report the blocker and the next concrete verification step.
