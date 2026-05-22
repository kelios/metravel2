---
name: metravel-e2e-runner
description: Run and debug metravel Playwright and browser smoke scenarios, use .env.e2e safely, collect trace or screenshot evidence in ignored folders, and validate real web flows without exposing secrets.
---

# Metravel E2E Runner

Read `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, and `docs/CODEX.md` before running browser or Playwright flows. Load the matching feature doc from `docs/features/` for the tested area.

## When to use

- Playwright smoke or regression runs in `e2e/`
- Browser validation for visible web UI changes
- Reproducing flaky user flows or console/runtime regressions
- Re-testing fixes that must be proven in a real browser

## Execution rules

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
- `npx playwright test e2e/<spec>.ts --project=chromium --workers=1`

