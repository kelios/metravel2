# Testing guide

## Project root

- Current project: `metravel2`
- Run all commands from the `metravel2/` app root (this folder contains `package.json`).

## Package manager

- This repo uses Yarn v1 (`packageManager: yarn@1.22.x`). Prefer `yarn ...`.
- `npm run ...` usually works too, but examples below use Yarn.

## Node.js version

- React Native `0.81.5` requires Node `>= 20.19.4`.
- Recommended: use `nvm` and the repo `.nvmrc`.

```bash
nvm install
nvm use
yarn install
```

## Unit / integration tests (Jest)

Commands:

```bash
yarn test        # watchAll
yarn test:run    # single run (recommended for CI/local checks)
yarn test:coverage
```

Related config:

- `jest.config.js`
- `jest.expo-globals.js`
- `__tests__/setup.ts`

Notes:

- Test environment is `jsdom`.
- Aliases: `@/*` resolves to the project root (`tsconfig.json` + `jest.config.js`).
- Many native/web APIs are mocked in `__tests__/setup.ts`. If a new test fails due to missing browser/native APIs, add a targeted mock there.

### API base URL rule for Jest

- **Jest must never rely on `window.location.origin` for API calls.**
- In unit/integration tests the API base must come from `EXPO_PUBLIC_API_URL`.
- The local webserver origin (usually `http://127.0.0.1:8085`) is an **E2E concern** (Playwright) and must not leak into Jest.

Defaults:

- `jest.expo-globals.js` and `__tests__/setup.ts` set a safe default `EXPO_PUBLIC_API_URL` to the dev server: `http://192.168.50.36`.
- If you need a different server for tests, override before running Jest (shell env wins).

If you see an error like:

- `Forbidden API base in Jest: http://127.0.0.1:8085/api/...`

it means some code path is building API URLs from `window.location.origin` instead of `process.env.EXPO_PUBLIC_API_URL`.

## E2E tests (Playwright)

### Test strategy

Tests are split into three tiers using tags in `test.describe()`:

| Tier | Tag | Purpose | ~Time |
|------|-----|---------|-------|
| **Smoke** | `@smoke` | Critical path — pages load, API works | 2 min |
| **Perf** | `@perf` | CLS, Web Vitals, performance budgets | 5 min |
| **Regression** | _(all)_ | Full suite | 15 min |

### Commands

```bash
yarn e2e                          # full regression (default)
E2E_SUITE=smoke yarn e2e          # smoke only (pre-deploy gate)
E2E_SUITE=perf  yarn e2e          # perf audits only
yarn e2e:headed                   # with visible browser
yarn e2e:ui                       # Playwright UI mode
```

### Parallelization

- `fullyParallel: true` — tests within a file run independently.
- **Local:** 50% of CPU cores.
- **CI:** 2 workers (stability over speed).
- Tests that share state use `test.describe.serial()`.

### How it works

- Config: `playwright.config.ts`
- By default it builds a static web export and serves `dist/` via `scripts/e2e-webserver.js` (then Playwright runs against it).
- Default port is `8085` (override via `E2E_WEB_PORT`).

### Shared helpers (`e2e/helpers/`)

| File | Purpose |
|------|---------|
| `navigation.ts` | `gotoWithRetry`, `preacceptCookies`, `assertNoHorizontalScroll`, `navigateToFirstTravel`, `waitForMainListRender`, `tid` |
| `auth.ts` | `isAuthenticated`, `getCurrentUser`, `waitForAuth`, `simpleEncrypt`, `ensureAuthedStorageFallback` |
| `e2eApi.ts` | Direct API calls, test data creation/cleanup |
| `consoleGuards.ts` | Console error detection |
| `layoutAsserts.ts` | `expectNoOverlap`, `expectFullyInViewport`, `expectNoHorizontalScroll` |
| `storage.ts` | `seedNecessaryConsent`, `hideRecommendationsBanner` (used internally by `navigation.ts`; specs should use `preacceptCookies` instead) |
| `routes.ts` | `getTravelsListPath` |

First-time setup:

```bash
npx playwright install
```

Environment:

- `E2E_API_URL` — if set, Playwright web server will use it as `EXPO_PUBLIC_API_URL`.
- If you want to run against an already running server:
  - set `E2E_NO_WEBSERVER=1` and `BASE_URL`.

Local proxy (used by `scripts/serve-web-build.js`):

- `E2E_API_PROXY_TARGET` (default `https://metravel.by`) — upstream API host for `/api/*` and media routes.
- `E2E_API_PROXY_INSECURE=true` — allow insecure HTTPS proxy (helpful for local cert issues).
- `E2E_API_PROXY_TIMEOUT_MS` (default `20000`) — upstream request timeout. Proxy can log `Proxy timeout...` even when tests still pass.

Cleanup (created travels):

- `E2E_API_CLEANUP_TIMEOUT_MS` (default `20000`) — per-request timeout for teardown deletes.
- `E2E_API_CLEANUP_BUDGET_MS` (default `60000`) — total teardown budget.

## CI-style test run

```bash
yarn test:ci
```

Includes `npm run check:image-architecture` and then runs Jest in CI mode.

## CI Smoke quality gate

Workflow:

- `.github/workflows/ci-smoke.yml`

Jobs:

- `lint` (gating): runs `yarn lint:ci`, publishes summary + `eslint-results` artifact.
- `smoke-critical` (gating): runs `yarn test:smoke:critical:ci`, publishes summary + `jest-smoke-results` artifact.
- `quality-summary` (aggregation): downloads both artifacts and publishes one combined quality summary.
  - For failed PR gates, also prints a ready-to-copy incident snippet into job summary.
  - Also writes a machine-readable snapshot at `test-results/quality-summary.json` (for downstream CI steps).
  - Snapshot includes `schemaVersion` (current: `1`).
  - Validates snapshot schema/version before upload via `scripts/validate-quality-summary.js`.
  - Uploads `quality-summary` artifact with this snapshot for post-run diagnostics.

Schema change checklist (`quality-summary.json`):

1. Decide if change is backward-compatible:
   - Non-breaking (optional field): keep `schemaVersion` unchanged.
   - Breaking (required field/type/semantics change): bump `schemaVersion`.
2. Update producer:
   - `scripts/summarize-quality-gate.js`
3. Update consumer validator:
   - `scripts/validate-quality-summary.js`
   - `SUPPORTED_SCHEMA_VERSION`
4. Update tests:
   - `__tests__/scripts/summarize-quality-gate.test.ts`
   - `__tests__/scripts/validate-quality-summary.test.ts`
5. Update docs:
   - this section in `docs/TESTING.md` (current schema version and compatibility note)
6. Add compatibility note in PR:
   - mention `schemaVersion` change and expected impact on downstream steps/artifacts.

Policy:

- For `pull_request`, smoke duration budget is warning-only.
- For `push` to `main`, smoke duration budget strict mode is enabled and may fail the quality gate.

Smoke trend baseline (`SMOKE_DURATION_PREVIOUS_SECONDS`):

- Source: GitHub repository variable `SMOKE_DURATION_PREVIOUS_SECONDS`.
- Used by `quality-summary` to print trend: `previous -> current`.
- Recommended value: stable recent baseline (for example, median smoke duration from last 7 successful `main` runs).
- Update cadence: weekly or after meaningful CI test-scope changes.
- If variable is missing/empty, trend line is skipped (budget checks still work).
- Helper command (local recommendation from report files):

```bash
yarn smoke:baseline:recommend
# optional: custom folder/limit
node scripts/recommend-smoke-baseline.js --dir test-results --limit 7
```

Runbook: update `SMOKE_DURATION_PREVIOUS_SECONDS` in GitHub:

1. Generate recommendation locally:

```bash
yarn smoke:baseline:recommend
```

2. Copy numeric value from output line:
   - `Recommended SMOKE_DURATION_PREVIOUS_SECONDS: <value>`
3. Open repository settings:
   - `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`
4. Create or update variable:
   - Name: `SMOKE_DURATION_PREVIOUS_SECONDS`
   - Value: `<recommended value>` (for example `18.6`)
   - CLI alternative:

```bash
# Preflight
gh auth status
gh repo view --json nameWithOwner

# Update variable
gh variable set SMOKE_DURATION_PREVIOUS_SECONDS --body "<recommended value>"
```

   - Example:

```bash
gh auth status
gh repo view --json nameWithOwner
gh variable set SMOKE_DURATION_PREVIOUS_SECONDS --body "18.6"
```
5. Save and verify on next `CI Smoke` run:
   - `Quality Gate Summary` should show `Smoke trend: ... vs previous <value>s`.
6. Cadence:
   - Update weekly, or right after significant changes to smoke test scope.

Common `gh` errors:

- `not logged in`
  - Check: `gh auth status`
  - Fix: `gh auth login`

- `resource not accessible by integration`
  - Usually token/SSO/repo access issue.
  - Check:
    - `gh auth status`
    - `gh repo view --json nameWithOwner`
  - Fix:
    - refresh auth (`gh auth login`)
    - confirm you have write access to repository variables.

- `insufficient OAuth scopes`
  - Check current scopes via `gh auth status`.
  - Fix:
    - re-auth with required scopes (for repo variables, ensure repo/admin access as per org policy)
    - if your org uses SSO, ensure token/session is authorized for the org.

Owner handoff:

- Baseline owner:
  - Responsible for updating `SMOKE_DURATION_PREVIOUS_SECONDS` on schedule.
  - Recommended SLA: weekly update or within 1 business day after major smoke scope change.

- CI exception approver:
  - Reviews `CI Exception` block in PR when `Failure Class != pass`.
  - Confirms business reason, risk statement, rollback plan, owner, and deadline are concrete.

- Follow-up accountability:
  - The `Owner` field in PR exception is responsible for delivering the fix by `Fix deadline`.
  - If deadline is missed, reopen triage and re-evaluate merge risk.

Escalation path:

- Repeated `inconsistent_state` (`QG-002`)
  - Trigger: 2+ occurrences within 7 days.
  - Escalate to: CI/workflow maintainer + repository admin.
  - Target response time: within 1 business day.
  - First actions:
    - inspect artifact upload/download steps
    - inspect runner/job cancellation/timeouts
    - verify job result propagation in `quality-summary`

- Persistent `performance_budget` (`QG-006`)
  - Trigger: strict budget failure on `main` in 2+ consecutive runs.
  - Escalate to: test owner + platform/infra owner.
  - Target response time: same business day.
  - First actions:
    - identify slowest suites/tests in smoke scope
    - split or optimize heavy tests
    - reassess budget only with explicit approval and note in PR/issue

- Exception process escalation
  - Trigger: missing owner/deadline or repeated deadline misses.
  - Escalate to: engineering lead for decision on merge freeze vs rollback.
  - Target response time: within 1 business day.

Incident template (minimum):

Use this template in PR comment, issue, or incident log when escalation is triggered.

```md
### CI Smoke Incident
- Date (UTC): YYYY-MM-DD HH:MM
- Workflow run: <link>
- Branch / PR: <branch-or-pr-link>
- Failure Class: <infra_artifact|inconsistent_state|lint_only|smoke_only|mixed|performance_budget>
- Recommendation ID: <QG-001..QG-006>
- Impact: <what is blocked / affected>
- Owner: <person-or-team>
- ETA: <expected resolution time>
- Immediate action taken: <one-line summary>
- Follow-up required: <yes/no + short note>
```

Generator helper:

```bash
# Print template with placeholders
yarn ci:incident:template

# Example with prefilled fields
yarn ci:incident:template -- \
  --failure-class inconsistent_state \
  --recommendation-id QG-002 \
  --owner "CI Team" \
  --impact "Merge blocked" \
  --eta "2026-02-12 12:00 UTC"
```

Local reproduction:

```bash
yarn lint:ci
yarn test:smoke:critical:ci
node scripts/summarize-eslint.js test-results/eslint-results.json
node scripts/summarize-jest-smoke.js test-results/jest-smoke-results.json
node scripts/summarize-quality-gate.js test-results/eslint-results.json test-results/jest-smoke-results.json --fail-on-missing
```

### PR Exception format

Used by validator: `scripts/validate-pr-ci-exception.js`.

Validation rules:

- Required only when CI gate is not green for PR (`lint` or `smoke-critical` failed).
- `Exception requested` checkbox must be checked.
- Required fields must be filled with concrete values:
  - `Business reason`
  - `Risk statement`
  - `Rollback plan`
  - `Owner`
  - `Fix deadline (YYYY-MM-DD)`
- Placeholders like `TBD`, `N/A`, `-`, `todo`, `<...>`, `[...]` are treated as invalid.

Template snippet:

```md
## CI Exception (Only if Failure Class != pass)

- [x] Exception requested
- Business reason: <why merge is still needed now>
- Risk statement: <explicit risk>
- Rollback plan: <exact rollback action>
- Owner: <person/team responsible>
- Fix deadline (YYYY-MM-DD): <date>
```

### Troubleshooting by Failure Class

<a id="qg-001"></a>
- `infra_artifact` (`QG-001`)
  - Meaning: one of required reports is missing (`eslint-results` or `jest-smoke-results`).
  - Check:
    - upload steps in `lint` / `smoke-critical`
    - download steps in `quality-summary`
  - Re-run locally:
    - `yarn lint:ci`
    - `yarn test:smoke:critical:ci`

<a id="qg-002"></a>
- `inconsistent_state` (`QG-002`)
  - Meaning: upstream job status and report content contradict each other.
  - Check:
    - `needs.lint.result` / `needs.smoke-critical.result`
    - whether report files contain expected failures
    - infra errors in job logs (timeout, canceled step, artifact mismatch)
  - Re-run locally:
    - `yarn lint:ci`
    - `yarn test:smoke:critical:ci`

<a id="qg-003"></a>
- `lint_only` (`QG-003`)
  - Meaning: lint report has violations, smoke report is green.
  - Re-run locally:
    - `yarn lint:ci`
    - `node scripts/summarize-eslint.js test-results/eslint-results.json`

<a id="qg-004"></a>
- `smoke_only` (`QG-004`)
  - Meaning: smoke report has failing suites/tests, lint is green.
  - Re-run locally:
    - `yarn test:smoke:critical`
    - `yarn test:smoke:critical:ci`
    - `node scripts/summarize-jest-smoke.js test-results/jest-smoke-results.json`

<a id="qg-005"></a>
- `mixed` (`QG-005`)
  - Meaning: both lint and smoke contain failures.
  - Suggested order:
    1. Fix lint first (`yarn lint:ci`).
    2. Re-run smoke (`yarn test:smoke:critical:ci`).
    3. Re-run combined summary script.

<a id="qg-006"></a>
- `performance_budget` (`QG-006`)
  - Meaning: smoke duration exceeded configured budget in strict mode.
  - Check:
    - `SMOKE_DURATION_BUDGET_SECONDS`
    - `SMOKE_DURATION_BUDGET_STRICT`
    - suite growth in `test:smoke:critical`
  - Re-run locally:
    - `yarn test:smoke:critical:ci`
    - `SMOKE_DURATION_BUDGET_SECONDS=10 SMOKE_DURATION_BUDGET_STRICT=true node scripts/summarize-quality-gate.js test-results/eslint-results.json test-results/jest-smoke-results.json --fail-on-missing`

## Known peer dependency warnings

You may see warnings during `yarn install`:

- `react-leaflet@4.x` declares peer deps for React 18, while this repo uses React 19.
- `@react-pdf/renderer@3.x` declares peer deps up to React 18.

At the moment we keep them as-is because the app works and tests pass, but treat these as “watch items” after upgrades.
