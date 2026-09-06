---
name: metravel-e2e-runner
description: "Run or debug metravel Playwright and browser-smoke flows with safe .env.e2e handling. Use for real-web regression, console, screenshot, trace, or flaky-flow evidence."
---

# Metravel E2E Runner

`AGENTS.md` is inherited. Load the matching feature contract and only the
relevant e2e/auth/operation sections from `docs/TESTING.md` and
`docs/WORKFLOW_OPERATIONS.md`.

## Runtime entry

For a changed-code acceptance pass, require reviewed code in `testing` before
runtime probes. Default to the local stack and perform the session's backend
refresh/readiness procedure from `docs/WORKFLOW_OPERATIONS.md` →
`3.0 Локальный стек и обновление бэкенда перед тестированием` before the first
probe. Use dev or production only when explicitly requested; record the actual
API target. This skill does not grant permission to message other people.

## When to use

- Playwright smoke or regression runs in `e2e/`
- Browser validation for visible web UI changes
- Reproducing flaky user flows or console/runtime regressions
- Re-testing fixes that must be proven in a real browser

## Execution rules

- Before Playwright/e2e/browser-smoke runs, apply the operation coordination rule from `AGENTS.md`/`docs/RULES.md`. If an e2e/full/preflight quality gate is active, stop your duplicate launch without waiting, polling, bypassing, or retrying. `validation delegated/skipped: active gate pid/name` is coordination only. Request the owner result and resume acceptance; do not close from delegation or park the task in `testing`.
- Use `.env.e2e` credentials when present and never print secrets.
- Prefer the narrowest Playwright spec or `--grep` scope that proves the scenario.
- For visible web UI, check browser console errors and confirm the final state with screenshot or trace evidence when useful.
- Store traces, screenshots, videos, and temporary reports only in ignored folders such as `.codex-temp/`, `playwright-report/`, or `test-results/`.
- If the scenario is blocked by local server health or external instability, report the blocker and the next concrete re-run step.

## Repo specifics

- Do not treat missing production-hosted media in local dev as a frontend regression by itself.
- Do not rewrite product behavior to satisfy an outdated e2e expectation; update the test when the project rule is authoritative.
- For travel performance or Lighthouse work, hand off to `$metravel-performance-analyst`.

## Typical commands

- `npm run e2e`
- `npm run check:e2e:changed`
- `node scripts/run-with-quality-gate-lock.js e2e:targeted -- node node_modules/playwright/cli.js test e2e/<spec>.ts --project=chromium --workers=1`
