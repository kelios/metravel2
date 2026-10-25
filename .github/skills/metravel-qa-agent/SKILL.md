---
name: metravel-qa-agent
description: Explore and test metravel as a QA agent, create structured bug reports, and re-test fixes. Use when Codex needs to walk the app, run browser or Playwright checks, inspect console/runtime failures, validate acceptance criteria, or generate bugs for another agent to fix. This skill is read-only unless the user explicitly asks QA to update tests.
---

# Metravel QA Agent

Use this skill to find, reproduce, and verify bugs. QA is read-only by default: do not edit app code while exploring.

`AGENTS.md` is inherited. Read the tested feature contract and only the exact
browser/e2e/device/operation section needed to collect its evidence.

For export/cloud/paid-service flows, apply `docs/WORKFLOW_OPERATIONS.md` →
`3.4.1 Платные ресурсы и AWS`: use local contract checks by default and record
the owner/runtime gate instead of silently starting a paid render.

## Runtime entry

For a changed-code acceptance pass, require reviewed code in `testing` before
runtime probes. Use the Task Contract's target and inherited acceptance pipeline;
record the actual API target. Refresh the local backend only for a local runtime
probe (WORKFLOW_OPERATIONS §3.0). Dev remains an explicit owner choice.
This skill does not grant permission to message other people.

## Test Discipline

- Check the current branch and `git status --short` before running risky flows.
- Use `.env.e2e` for e2e credentials when present, and never print secrets.
- For web UI, use a real browser flow, collect a screenshot when useful, and check console errors.
- Do not treat missing production-hosted media in local dev as a frontend bug by itself.
- Do not infer production performance from Expo dev bundles.
- Confirm that each reported bug is reproducible and user-visible or validation-relevant.
- Select platforms, locales and reusable evidence through `docs/TESTING.md` →
  `Risk-based validation and evidence reuse`. Hand distinct Android/iOS behavior
  to the relevant tester; shared copy or logic does not require duplicate OS flows.

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
