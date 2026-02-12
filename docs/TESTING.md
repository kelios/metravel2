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

- `schema-contract-checks` (PR selective gating):
  - runs only on `pull_request`
  - checks changed files and runs targeted schema contract tests only when relevant files changed
  - uses `scripts/run-schema-contract-tests-if-needed.js`
  - writes decision summary to job summary (`run` / `skip`, matched files preview, category breakdown)
  - fail-safe: if changed-files input is unavailable, forced `run` is used to avoid false `skip`
  - publishes `schema-selective-decision` artifact (`test-results/schema-selective-decision.json`)
  - validates artifact schema via `scripts/validate-selective-decision.js`
- `validator-contract-checks` (PR selective gating):
  - runs only on `pull_request`
  - checks changed files and runs targeted validator contract tests only when relevant files changed
  - uses `scripts/run-validator-contract-tests-if-needed.js`
  - writes decision summary to job summary (`run` / `skip`, matched files preview, category breakdown)
  - fail-safe: if changed-files input is unavailable, forced `run` is used to avoid false `skip`
  - publishes `validator-selective-decision` artifact (`test-results/validator-selective-decision.json`)
  - validates artifact schema via `scripts/validate-selective-decision.js`
- `runtime-config-diagnostics` (gating):
  - validates runtime env contract via `yarn config:diagnostics:json`
  - uploads `runtime-config-diagnostics` artifact (`test-results/runtime-config-diagnostics.json`)
- PR jobs that need changed files use shared helper:
  - `scripts/collect-changed-files.js` (`BASE_SHA` + `HEAD_SHA` -> `changed_files.txt`)
  - selective runners consume `changed_files.txt` via `scripts/changed-files-utils.js` (with `CHANGED_FILES` env fallback)
  - selective runner CLI args (`--changed-files-file`, `--dry-run`, `--json`) are parsed by `scripts/selective-runner-args.js`
  - `--json` is decision-only output mode and is supported only together with `--dry-run`
  - shared decision contract payload is built by `scripts/selective-runner-output.js` (`contractVersion: 1`)
  - aggregate snapshot is assembled by `scripts/collect-selective-decisions.js` into `test-results/selective-decisions.json`
  - aggregate schema is validated by `scripts/validate-selective-decisions.js` (`schemaVersion: 1`)
- `lint` (gating): runs `yarn lint:ci`, publishes summary + `eslint-results` artifact.
- `smoke-critical` (gating): runs `yarn test:smoke:critical:ci`, publishes summary + `jest-smoke-results` artifact.
- `quality-summary` (aggregation): downloads both artifacts and publishes one combined quality summary.
  - On every run, validates workflow artifact/step/output contracts via `scripts/validate-ci-smoke-workflow-contract.js`, publishes summary via `scripts/summarize-ci-smoke-workflow-contract-validation.js` (default max-items comes from `scripts/ci-smoke-workflow-contract.js`, currently `5`), and uploads `ci-smoke-workflow-contract-validation` snapshot (`test-results/ci-smoke-workflow-contract-validation.json`).
  - Workflow contract summary includes grouped top missing entries plus actionable hints (what to restore in workflow when contracts drift).
  - Workflow contract hint priorities:
    - `[P1]` critical wiring issues that typically block artifact URL derivation or summary behavior (`summary settings`, `output refs`).
    - `[P2]` high-impact contract drift that commonly breaks downstream references (`step ids`, `artifact names`).
    - `[P3]` lower-risk path-level drift (`artifact paths`) that is still required for full contract compliance.
  - Workflow Hint Rules Contract (stable order):
    - `missingSummarySettings` -> `[P1]`
    - `missingOutputRefs` -> `[P1]`
    - `missingStepIds` -> `[P2]`
    - `missingArtifactNames` -> `[P2]`
    - `missingArtifactPaths` -> `[P3]`
    - Source of truth: `scripts/summarize-ci-smoke-workflow-contract-validation.js` (`ACTION_HINT_RULES`).
  - `quality-summary` sets `CI_WORKFLOW_CONTRACT_SUMMARY_MAX_ITEMS=5` to keep triage details concise and consistent across runs.
  - In PR runs, also downloads selective decision artifacts and includes them in summary + `quality-summary.json`.
  - In PR runs, validates downloaded selective decision artifacts before publishing summary (missing artifacts are reported as summary warnings).
  - In PR runs, builds and validates a single selective decisions aggregate before calling `scripts/summarize-quality-gate.js`.
  - In PR runs, uploads aggregate selective decisions snapshot as `selective-decisions` artifact (`test-results/selective-decisions.json`).
  - In PR runs, guard validator contract step also emits machine-readable `validator-guard` artifact (`test-results/validator-guard.json`) via `scripts/guard-validator-contract-change.js --json`.
  - In PR runs, quality-summary also renders a markdown comment preview from guard payload and uploads `validator-guard-comment` artifact (`test-results/validator-guard-comment.md`).
  - In PR runs, quality-summary validates publish-body markdown contract via `scripts/validate-validator-guard-comment.js` before PR comment upsert.
  - Shared URL/placeholder checks for validator comment and incident validators are centralized in `scripts/validation-rules.js`.
  - Validator comment validation also emits machine-readable snapshot `test-results/validator-guard-comment-validation.json` and summary section via `scripts/summarize-validator-guard-comment-validation.js`.
  - End-to-end consistency for validator comment validation payload and summary is covered by `__tests__/scripts/validator-guard-comment-validation-pipeline.test.ts`.
  - Validator comment error codes are standardized in `scripts/validator-error-codes.js` under `ERROR_CODES.validatorGuardComment`.
  - CI contract guard includes `__tests__/scripts/validator-error-codes-centralization.test.ts` to prevent new literal validation error-code strings in `scripts/validate-*.js`.
  - CI contract guard enforces namespace prefix policy via `__tests__/scripts/validator-error-codes-prefix-policy.test.ts`.
  - CI contract guard also enforces unique `ERROR_CODES` values via `__tests__/scripts/validator-error-codes-uniqueness.test.ts`.
  - Validator error-codes docs table consistency is enforced via `scripts/validate-validator-error-codes-doc-table.js` and `__tests__/scripts/validate-validator-error-codes-doc-table.test.ts`.
  - In PR runs, quality-summary emits `validator-error-codes-doc-table-validation` snapshot (`test-results/validator-error-codes-doc-table-validation.json`) and summary via `scripts/summarize-validator-error-codes-doc-table-validation.js`.
  - In PR runs, quality-summary emits `validator-error-codes-policy-validation` snapshot (`test-results/validator-error-codes-policy-validation.json`) and summary via `scripts/summarize-validator-error-codes-policy-validation.js`.
  - In PR runs, quality-summary also emits an aggregate validator contracts summary + snapshot via `scripts/summarize-validator-contracts.js` (`test-results/validator-contracts-summary.json`).
  - In PR runs, quality-summary validates aggregate summary schema via `scripts/validate-validator-contracts-summary.js` and emits `validator-contracts-summary-validation` snapshot (`test-results/validator-contracts-summary-validation.json`) + summary via `scripts/summarize-validator-contracts-summary-validation.js`.
  - quality-summary also consumes runtime diagnostics snapshot via `--runtime-config-diagnostics-file test-results/runtime-config/runtime-config-diagnostics.json`.
  - Local helper commands:
    - `yarn validator:error-codes:docs:check`
    - `yarn validator:error-codes:docs:update`
    - `yarn validator:contracts:check`
    - `yarn validator:contracts:summary`
    - `yarn validator:contracts:summary:validate`
    - `yarn ci:workflow:contract:validate`
    - `yarn ci:workflow:contract:validate:json`
    - `yarn ci:workflow:contract:summarize`
    - `yarn config:diagnostics`
    - `yarn config:diagnostics:json`
    - `yarn config:diagnostics:strict`
  - In PR runs, CI manages a marker-based PR comment lifecycle for validator guard:
    - when `ok=false`: creates or updates comment from `validator-guard-comment.md`
    - when `ok=true`: updates existing marker comment into resolved/pass status
    - fallback comment body reuses shared template from `scripts/validator-guard-comment-template.js`
    - fallback + rendered publish paths are integration-checked in `__tests__/scripts/validator-guard-comment-pipeline.test.ts`
    - comment includes direct links to workflow run and artifacts
    - quality-summary link uses artifact-id URL when available (falls back to run `#artifacts`)
    - validator-guard-comment link uses uploaded artifact-id URL when available (falls back to run `#artifacts`)
    - best-effort and non-blocking (`continue-on-error`).

### Validator Error Codes Table

<!-- validator-error-codes-table:start -->
| Namespace | Key | Code |
| --- | --- | --- |
| prCiException | EXCEPTION_REQUIRED | PR_EXCEPTION_REQUIRED |
| prCiException | REQUIRED_FIELD_PLACEHOLDER | PR_REQUIRED_FIELD_PLACEHOLDER |
| incidentSnippet | MISSING_HEADER | INCIDENT_MISSING_HEADER |
| incidentSnippet | INVALID_WORKFLOW_RUN | INCIDENT_INVALID_WORKFLOW_RUN |
| incidentSnippet | INVALID_BRANCH_PR | INCIDENT_INVALID_BRANCH_PR |
| incidentSnippet | INVALID_FAILURE_CLASS | INCIDENT_INVALID_FAILURE_CLASS |
| incidentSnippet | INVALID_RECOMMENDATION_ID | INCIDENT_INVALID_RECOMMENDATION_ID |
| incidentSnippet | MISSING_SELECTIVE_REFERENCE | INCIDENT_MISSING_SELECTIVE_REFERENCE |
| incidentSnippet | MISSING_VALIDATOR_REFERENCE | INCIDENT_MISSING_VALIDATOR_REFERENCE |
| incidentPayload | INVALID_SCHEMA_VERSION | INCIDENT_PAYLOAD_INVALID_SCHEMA_VERSION |
| incidentPayload | INVALID_PAYLOAD_OBJECT | INCIDENT_PAYLOAD_INVALID_PAYLOAD_OBJECT |
| incidentPayload | INVALID_FAILURE_CLASS | INCIDENT_PAYLOAD_INVALID_FAILURE_CLASS |
| incidentPayload | INVALID_RECOMMENDATION_ID | INCIDENT_PAYLOAD_INVALID_RECOMMENDATION_ID |
| incidentPayload | INVALID_ARTIFACT_SOURCE | INCIDENT_PAYLOAD_INVALID_ARTIFACT_SOURCE |
| incidentPayload | INCONSISTENT_ARTIFACT_URL | INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_URL |
| incidentPayload | INCONSISTENT_ARTIFACT_SOURCE | INCIDENT_PAYLOAD_INCONSISTENT_ARTIFACT_SOURCE |
| incidentPayload | INCONSISTENT_MARKDOWN_ARTIFACT | INCIDENT_PAYLOAD_INCONSISTENT_MARKDOWN_ARTIFACT |
| incidentPayload | INCONSISTENT_VALIDATOR_ARTIFACT_URL | INCIDENT_PAYLOAD_INCONSISTENT_VALIDATOR_ARTIFACT_URL |
| incidentPayload | INCONSISTENT_VALIDATOR_ARTIFACT_SOURCE | INCIDENT_PAYLOAD_INCONSISTENT_VALIDATOR_ARTIFACT_SOURCE |
| incidentPayload | INCONSISTENT_MARKDOWN_VALIDATOR_ARTIFACT | INCIDENT_PAYLOAD_INCONSISTENT_MARKDOWN_VALIDATOR_ARTIFACT |
| incidentPayload | INVALID_PRIMARY_ARTIFACT_KIND | INCIDENT_PAYLOAD_INVALID_PRIMARY_ARTIFACT_KIND |
| incidentPayload | INCONSISTENT_PRIMARY_ARTIFACT_KIND | INCIDENT_PAYLOAD_INCONSISTENT_PRIMARY_ARTIFACT_KIND |
| validatorGuardComment | MISSING_MARKER | VALIDATOR_GUARD_COMMENT_MISSING_MARKER |
| validatorGuardComment | MISSING_HEADER | VALIDATOR_GUARD_COMMENT_MISSING_HEADER |
| validatorGuardComment | INVALID_STATUS | VALIDATOR_GUARD_COMMENT_INVALID_STATUS |
| validatorGuardComment | INVALID_REASON | VALIDATOR_GUARD_COMMENT_INVALID_REASON |
| validatorGuardComment | INVALID_WORKFLOW_RUN | VALIDATOR_GUARD_COMMENT_INVALID_WORKFLOW_RUN |
| validatorGuardComment | INVALID_GUARD_ARTIFACT | VALIDATOR_GUARD_COMMENT_INVALID_GUARD_ARTIFACT |
| errorCodesDoc | MISSING_MARKERS | ERROR_CODES_DOC_MISSING_MARKERS |
| errorCodesDoc | OUTDATED_TABLE | ERROR_CODES_DOC_OUTDATED_TABLE |
| errorCodesPolicy | PREFIX_MISMATCH | ERROR_CODES_POLICY_PREFIX_MISMATCH |
| errorCodesPolicy | DUPLICATE_VALUE | ERROR_CODES_POLICY_DUPLICATE_VALUE |
| validatorContractsSummary | INVALID_JSON | VALIDATOR_CONTRACTS_SUMMARY_INVALID_JSON |
| validatorContractsSummary | INVALID_PAYLOAD_OBJECT | VALIDATOR_CONTRACTS_SUMMARY_INVALID_PAYLOAD_OBJECT |
| validatorContractsSummary | INVALID_SCHEMA_VERSION | VALIDATOR_CONTRACTS_SUMMARY_INVALID_SCHEMA_VERSION |
| validatorContractsSummary | INVALID_OVERALL_STATUS | VALIDATOR_CONTRACTS_SUMMARY_INVALID_OVERALL_STATUS |
| validatorContractsSummary | INVALID_COUNT_FIELD | VALIDATOR_CONTRACTS_SUMMARY_INVALID_COUNT_FIELD |
| validatorContractsSummary | INVALID_CHECKS_ARRAY | VALIDATOR_CONTRACTS_SUMMARY_INVALID_CHECKS_ARRAY |
| validatorContractsSummary | INVALID_ERROR_CODES_ARRAY | VALIDATOR_CONTRACTS_SUMMARY_INVALID_ERROR_CODES_ARRAY |
| validatorContractsSummary | INVALID_CHECK_ENTRY | VALIDATOR_CONTRACTS_SUMMARY_INVALID_CHECK_ENTRY |
| validatorContractsSummary | COUNT_MISMATCH | VALIDATOR_CONTRACTS_SUMMARY_COUNT_MISMATCH |
| validatorContractsSummary | STATUS_MISMATCH | VALIDATOR_CONTRACTS_SUMMARY_STATUS_MISMATCH |
| validatorContractsSummary | ERROR_CODES_MISMATCH | VALIDATOR_CONTRACTS_SUMMARY_ERROR_CODES_MISMATCH |
| suiteBaselineRecommendation | INVALID_PAYLOAD_OBJECT | SUITE_INVALID_PAYLOAD_OBJECT |
| suiteBaselineRecommendation | INVALID_SOURCE_SNAPSHOT | SUITE_INVALID_SOURCE_SNAPSHOT |
| suiteBaselineRecommendation | INVALID_SUITE_COUNT | SUITE_INVALID_SUITE_COUNT |
| suiteBaselineRecommendation | INVALID_FORMAT | SUITE_INVALID_FORMAT |
| suiteBaselineRecommendation | INVALID_BASELINE_VALUE_EMPTY | SUITE_INVALID_BASELINE_VALUE_EMPTY |
| suiteBaselineRecommendation | INVALID_BASELINE_VALUE_JSON_ARRAY | SUITE_INVALID_BASELINE_VALUE_JSON_ARRAY |
| suiteBaselineRecommendation | INVALID_BASELINE_VALUE_JSON_PARSE | SUITE_INVALID_BASELINE_VALUE_JSON_PARSE |
| suiteBaselineRecommendation | INVALID_BASELINE_VALUE_CSV | SUITE_INVALID_BASELINE_VALUE_CSV |
| suiteBaselineRecommendation | INVALID_GH_COMMAND_EMPTY | SUITE_INVALID_GH_COMMAND_EMPTY |
| suiteBaselineRecommendation | INVALID_GH_COMMAND_CONTENT | SUITE_INVALID_GH_COMMAND_CONTENT |
<!-- validator-error-codes-table:end -->

  - For failed PR gates, also prints a ready-to-copy incident snippet into job summary via `scripts/publish-ci-incident-snippet.js`.
  - Validates incident snippet structure and required auto fields via `scripts/validate-ci-incident-snippet.js`.
  - Uploads `ci-incident-snippet` artifact (`test-results/ci-incident-snippet.md`) for incident/audit trail.
  - Validates incident payload contract via `scripts/validate-ci-incident-payload.js` and uploads `ci-incident-payload-validation` artifact (`test-results/ci-incident-payload-validation.json`).
  - Includes `Smoke Composition` section (critical suite/test counts and suite files preview).
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
7. PR guard behavior:
   - In `pull_request`, CI runs `scripts/guard-quality-schema-change.js`.
   - If schema files changed without companion tests/docs, guard fails.
   - Guard writes decision summary (`pass`/`fail`, matched files, missing companions) to job summary.
   - Emergency override token in PR body:
     - `schema-guard: skip - <reason>`
8. Validator contract guard behavior:
   - In `pull_request`, CI runs `scripts/guard-validator-contract-change.js`.
   - If validator contract files changed without companion tests/docs, guard fails.
   - Guard writes decision summary (`pass`/`fail`, matched files, missing companions) to job summary.
   - Contract files:
     - `scripts/validator-error-codes.js`
     - `scripts/validator-output.js`
   - Emergency override token in PR body:
     - `validator-guard: skip - <reason>`

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

Smoke suite baseline (`SMOKE_SUITE_FILES_BASELINE`):

- Optional GitHub repository variable used for suite drift signal in `Smoke Composition`.
- Format:
  - CSV list of suite paths, or
  - JSON array string (example: `["__tests__/app/export.test.tsx","__tests__/api/travels.test.ts"]`)
- Summary output includes:
  - `Suite drift vs baseline: +N / -M`
  - preview lists of added/removed suite files.
- In `CI Smoke` summary:
  - workflow step `Publish suite baseline recommendation` runs `scripts/publish-smoke-suite-recommendation.js`.
  - when drift is detected (`+N / -M`, where `N+M > 0`), summary prints a ready baseline recommendation and `gh variable set` command generated via `--json` mode.
- CI artifact:
  - when drift is detected, workflow uploads `smoke-suite-baseline-recommendation` artifact with `test-results/smoke-suite-baseline-recommendation.json`.
  - artifact is validated before upload by `scripts/validate-smoke-suite-baseline-recommendation.js`.
- Update when smoke scope is intentionally changed and accepted as new baseline.

Runbook: update `SMOKE_SUITE_FILES_BASELINE`:

1. Download `quality-summary` artifact from the latest successful `CI Smoke` run.
2. Extract suite list from snapshot:

```bash
yarn smoke:suite-baseline:recommend
```

3. Choose variable format:
   - Preferred: JSON array string.
   - Alternative: CSV string.
   - Machine-readable output (for scripts/automation):

```bash
node scripts/recommend-smoke-suite-baseline.js --file test-results/quality-summary.json --format json --json
```
   - For CSV output:

```bash
node scripts/recommend-smoke-suite-baseline.js --file test-results/quality-summary.json --format csv
```
4. Update GitHub variable:
   - UI: `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`
   - Name: `SMOKE_SUITE_FILES_BASELINE`
   - Value: output from step 2 (or CSV)
5. CLI alternative:

```bash
yarn smoke:suite-baseline:recommend
# copy the generated gh command from output

# validate generated recommendation artifact
yarn smoke:suite-baseline:validate

# machine-readable validation result
yarn smoke:suite-baseline:validate:json
```

6. Verify on next run:
   - `Quality Gate Summary` should show `Suite drift vs baseline: +0 / -0` (or expected intentional drift).

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
- Failure Class: <infra_artifact|inconsistent_state|lint_only|smoke_only|mixed|performance_budget|selective_contract|validator_contract|config_contract>
  - For aggregate selective-decision contract issues use `selective_contract`.
  - For validator aggregate-summary contract issues use `validator_contract`.
- Recommendation ID: <QG-001..QG-009>
- Impact: <what is blocked / affected>
- Owner: <person-or-team>
- ETA: <expected resolution time>
- Immediate action taken: <one-line summary>
- Follow-up required: <yes/no + short note>
- Selective decisions artifact: <optional artifact URL; recommended for selective_contract>
- Validator contracts artifact: <optional artifact URL; recommended for validator_contract>
- Runtime config diagnostics artifact: <optional artifact URL; recommended for config_contract>
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

# Publish incident snippet to GITHUB_STEP_SUMMARY from local quality snapshot
LINT_RESULT=failure SMOKE_RESULT=success yarn ci:incident:publish -- \
  --workflow-run "https://github.com/org/repo/actions/runs/123" \
  --branch-pr "https://github.com/org/repo/pull/42"

# Optional for selective_contract: if artifact id is known, publisher can build direct artifact URL
LINT_RESULT=success SMOKE_RESULT=success yarn ci:incident:publish -- \
  --workflow-run "https://github.com/org/repo/actions/runs/123" \
  --branch-pr "https://github.com/org/repo/pull/42" \
  --artifact-id "456"

# Optional for validator_contract: pass validator contracts artifact id/url
LINT_RESULT=success SMOKE_RESULT=success yarn ci:incident:publish -- \
  --workflow-run "https://github.com/org/repo/actions/runs/123" \
  --branch-pr "https://github.com/org/repo/pull/42" \
  --validator-artifact-id "789"

# Optional for config_contract: pass runtime diagnostics artifact url/id
LINT_RESULT=success SMOKE_RESULT=success yarn ci:incident:publish -- \
  --workflow-run "https://github.com/org/repo/actions/runs/123" \
  --branch-pr "https://github.com/org/repo/pull/42" \
  --runtime-artifact-url "https://github.com/org/repo/actions/runs/123#artifacts"

# Publish and print machine-readable payload (JSON)
LINT_RESULT=failure SMOKE_RESULT=success yarn ci:incident:publish:json -- \
  --workflow-run "https://github.com/org/repo/actions/runs/123" \
  --branch-pr "https://github.com/org/repo/pull/42"

# Save JSON payload and validate cross-field consistency
LINT_RESULT=failure SMOKE_RESULT=success yarn ci:incident:publish:json -- \
  --workflow-run "https://github.com/org/repo/actions/runs/123" \
  --branch-pr "https://github.com/org/repo/pull/42" \
  > test-results/ci-incident-payload.json
yarn ci:incident:payload:validate

# JSON payload fields for artifact provenance:
# - schemaVersion: incident payload schema version (current: 1)
# - artifactUrl: resolved artifact link (if available)
# - artifactSource: explicit | run_id | fallback | none
# - validatorArtifactUrl: validator-contract artifact link (if available)
# - validatorArtifactSource: explicit | run_id | fallback | none
# - runtimeArtifactUrl: runtime-config diagnostics artifact link (if available)
# - runtimeArtifactSource: explicit | run_id | fallback | none
# - primaryArtifactKind: none | selective_decisions | validator_contracts | runtime_config_diagnostics

# Incident payload schema checklist:
# 1) breaking shape/semantic change -> bump schemaVersion in publisher + validator
# 2) keep validator compatible with current schemaVersion only
# 3) update tests:
#    - __tests__/scripts/publish-ci-incident-json-contract.test.ts
#    - __tests__/scripts/validate-ci-incident-payload.test.ts
# 4) refresh docs error-code table:
#    yarn validator:error-codes:docs:update

# Validate generated snippet file
yarn ci:incident:validate

# machine-readable validation result
yarn ci:incident:validate:json

# machine-readable payload validation result
yarn ci:incident:payload:validate:json

# render a short human-readable summary from payload validation json
node scripts/summarize-ci-incident-payload-validation.js --file test-results/ci-incident-payload-validation.json
```

Expected `Incident Payload Validation` summary snippets:

```md
# OK payload
### Incident Payload Validation
- OK: true
- Error count: 0
- File: test-results/ci-incident-payload.json

# Missing validation file
### Incident Payload Validation
- Result file not found: `test-results/ci-incident-payload-validation.json`

# Parse error in validation file
### Incident Payload Validation
- Failed to parse `test-results/ci-incident-payload-validation.json`: <parse error>
```

Local reproduction:

```bash
yarn lint:ci
yarn test:smoke:critical:ci
node scripts/summarize-eslint.js test-results/eslint-results.json
node scripts/summarize-jest-smoke.js test-results/jest-smoke-results.json
node scripts/summarize-quality-gate.js test-results/eslint-results.json test-results/jest-smoke-results.json --fail-on-missing
```

### Summary Infrastructure

- Shared helper for CI summaries:
  - `scripts/summary-utils.js`
- Scripts expected to use this helper:
  - `scripts/summarize-eslint.js`
  - `scripts/summarize-jest-smoke.js`
  - `scripts/summarize-quality-gate.js`
  - `scripts/summarize-ci-incident-payload-validation.js`
  - `scripts/summarize-validator-guard.js`
  - `scripts/render-validator-guard-comment.js`
- Regression requirement:
  - summary script changes should include/refresh CLI integration tests in `__tests__/scripts/summarize-*.test.ts`.
  - changes to `scripts/summary-utils.js` should include `__tests__/scripts/summary-utils.test.ts`.
  - guard requirement: if `scripts/summarize-*.js` changes, include matching
    `__tests__/scripts/summarize-<name>.test.ts` and `docs/TESTING.md`
    (or explicit `validator-guard: skip - <reason>` override in PR body).
    - guard failure output includes explicit expected test path hint for each changed summary script.
  - guard requirement: if `scripts/summary-utils.js` changes, include
    `__tests__/scripts/summary-utils.test.ts`,
    `__tests__/scripts/run-validator-contract-tests-if-needed.test.ts`,
    and `docs/TESTING.md` (or explicit `validator-guard: skip - <reason>` override in PR body).

Guard machine-readable mode:

```bash
CHANGED_FILES="scripts/summarize-jest-smoke.js" node scripts/guard-validator-contract-change.js --json
node scripts/summarize-validator-guard.js --file test-results/validator-guard.json
node scripts/render-validator-guard-comment.js --file test-results/validator-guard.json --output-file test-results/validator-guard-comment.md
# optional links for triage context
node scripts/render-validator-guard-comment.js --file test-results/validator-guard.json --output-file test-results/validator-guard-comment.md --run-url "https://github.com/org/repo/actions/runs/123" --artifact-url "https://github.com/org/repo/actions/runs/123#artifacts" --quality-summary-url "https://github.com/org/repo/actions/runs/123#artifacts"
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

Machine-readable validator output:

```bash
yarn pr:ci-exception:validate:json
```

Validator JSON contract:

- All validator `--json` outputs include:
  - `contractVersion` (current: `1`)
  - `ok`, `errorCount`, `errors` (array of objects with `code`, `field`, `message`)
- Error code prefixes:
  - `PR_...` for PR exception validator
  - `INCIDENT_...` for incident snippet validator
  - `INCIDENT_PAYLOAD_...` for incident JSON payload validator
  - `SUITE_...` for smoke suite baseline recommendation validator

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

<a id="qg-007"></a>
- `selective_contract` (`QG-007`)
  - Meaning: aggregate selective decisions payload is missing/invalid while lint+smoke are otherwise green.
  - Check:
    - `test-results/selective-decisions.json`
    - `scripts/collect-selective-decisions.js`
    - `scripts/validate-selective-decisions.js`
  - Re-run locally:
    - `node scripts/collect-selective-decisions.js --schema-file test-results/selective/schema/schema-selective-decision.json --validator-file test-results/selective/validator/validator-selective-decision.json --output-file test-results/selective-decisions.json`
    - `node scripts/validate-selective-decisions.js --file test-results/selective-decisions.json`

<a id="qg-008"></a>
- `validator_contract` (`QG-008`)
  - Meaning: validator contracts aggregate summary validation failed/missing while lint+smoke are otherwise green.
  - Check:
    - `test-results/validator-contracts-summary.json`
    - `test-results/validator-contracts-summary-validation.json`
    - `scripts/summarize-validator-contracts.js`
    - `scripts/validate-validator-contracts-summary.js`
  - Re-run locally:
    - `yarn validator:contracts:summary`
    - `yarn validator:contracts:summary:validate`

<a id="qg-009"></a>
- `config_contract` (`QG-009`)
  - Meaning: runtime config diagnostics report failed/missing while lint+smoke are otherwise green.
  - Check:
    - `test-results/runtime-config/runtime-config-diagnostics.json` (downloaded in `quality-summary`)
    - `test-results/runtime-config-diagnostics.json` (uploaded by `runtime-config-diagnostics` job)
    - `scripts/runtime-config-diagnostics.js`
    - shared diagnostics contract: `utils/runtimeConfigContract.js`
  - Re-run locally:
    - `yarn config:diagnostics:json`
    - `yarn config:diagnostics:strict`

## Known peer dependency warnings

You may see warnings during `yarn install`:

- `react-leaflet@4.x` declares peer deps for React 18, while this repo uses React 19.
- `@react-pdf/renderer@3.x` declares peer deps up to React 18.

At the moment we keep them as-is because the app works and tests pass, but treat these as “watch items” after upgrades.
