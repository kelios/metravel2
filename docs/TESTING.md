# Testing Guide

Canonical policy reference: see [docs/RULES.md](./RULES.md) for mandatory project-wide development and governance rules.

## Default verification target and local-stack preflight

- The default target of every verification run is the **local stack** of this
  machine: local Django backend on `http://localhost:8000` plus Expo web
  (`npx expo start --web`). The dev stand `192.168.50.36` and production
  `metravel.by` are opt-in per command, on the owner's explicit request only —
  never by editing the defaults in `.env` or `metro.config.js`.
- **Update the backend before the first probe of every testing session.** The
  local checkout drifts silently while the API keeps answering `200` (measured
  2026-08-29: 26 commits behind `origin/master`, six unapplied migrations), and
  a stale backend produces false frontend defects that end up on the board.

  ```bash
  git -C ../metravel-backend fetch origin master
  git -C ../metravel-backend reset --hard origin/master
  ```

  Then apply migrations if the range touched `migrations/`, run
  `uv sync --frozen --dev --no-install-package gdal` if it touched
  `pyproject.toml`/`uv.lock`, and restart
  `bash /Users/juliasavran/Sites/metravel/run-backend.sh` — the dev server
  reloads code, but not migrations or containers.
- Readiness is proven by probes, not by "the page opened": backend HEAD equals
  `origin/master`, `showmigrations --plan` reports zero unapplied migrations,
  `http://localhost:8000/api/travels/` returns `200`, and `.env` still holds
  `EXPO_PUBLIC_API_URL=http://localhost:8000` with `EXPO_PUBLIC_IS_LOCAL_API=false`
  — `build-prod.sh` copies `.env.prod` over `.env`, so a frontend that silently
  talks to production is the normal state after a prod deploy. Exact commands:
  `docs/WORKFLOW_OPERATIONS.md` → «3.0 Локальный стек и обновление бэкенда перед
  тестированием».
- Known local-stack limits are not defects: S3 is the `metravellocal` bucket, so
  media of older production articles 404 (use your own test article), and there
  is no SSG shell, production cache or production nginx — performance, LCP/CLS
  and SEO claims about production still require production evidence per
  `docs/WORKFLOW_OPERATIONS.md` → «3.3.1».

## Platform-scoped validation and board status

- `review` is a code-only stage: diff/source inspection plus relevant static
  guards, lint, type checks, and focused unit tests. Browser/API runtime,
  simulator, physical-device, and TestFlight evidence is collected only after
  the reviewed commit enters `testing`.

- Common/shared UI, layout and interaction changes are verified in a real
  browser on desktop web and mobile web during `testing`. Mobile parity with
  Android/iPhone/iPad is a product/design invariant, not an automatic device
  gate.
- Android build/install/device evidence is required only for Android-specific
  behavior: platform files, native modules, permissions, intents, system Back,
  WebView/map engine, storage/lifecycle, build/runtime or Android release work.
- iPhone/iPad simulator, physical-device, or TestFlight evidence is required
  only for iOS/iPadOS-specific behavior or an explicitly assigned Apple mobile
  release gate. Choose simulator vs physical device vs TestFlight by the
  capability being tested.
- Backend/API/server tasks are accepted through the strongest available
  backend evidence: source/config inspection, tests already supplied by the
  backend owner, HTTP/API probes, payload/mutation checks, logs and temporal
  observation. Client-device evidence is not a backend Done gate; any required
  platform-specific client integration is accepted in a linked `area=front`
  task.
- A failed in-scope check that requires implementation work returns the task to
  `in_progress`/`todo` with the concrete defect. A validation-only gap does not.
  A still-running temporal gate, such as a 72-hour observation window, remains
  in `testing`. Irrelevant or out-of-scope device evidence does not block
  `done`; if every in-scope check passes and no work remains, close the task.

## Governance commands

Run canonical governance checks from repo root:

- `yarn governance:verify`
- `npm run governance:verify`
- `yarn guard:external-links`
- `npm run guard:external-links`
- `yarn guard:seo-cli-contract`
- `npm run guard:seo-cli-contract`
- `yarn guard:text-row-sizing`
- `npm run guard:text-row-sizing`
- `yarn guard:locale-number-format`
- `npm run guard:locale-number-format`
- `npm run guard:type-debt`

## Local selective checks

Use the same changed-file selective rules locally before a full run:

Before/during `review`, use only type/static checks, guards, and Jest commands.
`check:e2e:changed` and the e2e portion of `check:preflight` run only in
`testing`. The `review → testing` push is the one exception for the wrapper:
`PREFLIGHT_SKIP_E2E=1 git push origin main` keeps its static/unit/guard portion
and suppresses Playwright.

- `npm run typecheck`
- `npm run typecheck:e2e`
- `npm run check:fast`
- `npm run check:fast:dry`
- `npm run check:fast:json`
- `npm run check:preflight`
- `npm run check:preflight:dry`
- `npm run check:e2e:changed`
- `npm run check:e2e:changed:dry`
- `npm run check:e2e:changed:json`
- `npm run check:changed`
- `npm run check:changed:dry`
- `npm run check:changed:json`
- `node scripts/run-local-selective-checks.js --base-ref origin/main --dry-run --json`

Behavior:

- `typecheck` is the production TypeScript audit; `typecheck:e2e` is the non-emitting Playwright contract check for every `e2e/**/*.ts` file;
- `guard:type-debt` compares production `as any`, TypeScript suppression and ESLint-disable counts against `scripts/type-debt-baseline.json` per domain and per file. Any increase fails. `guard:type-debt:update` is reserved for an explicitly reviewed baseline change after the new debt is justified;
- `guard:text-row-sizing` AST-scans Android-relevant shared/native TSX for the high-signal `NATIVE-TEXT-ROW-001` shape: wrapping rows with at least three direct children and at least two direct dynamic `Text` siblings that are concurrently present. Safe contracts are one positive-`flex` outlet, bounded widths/direct wrappers, or explicit product ellipsis. Standalone `flexShrink` and positive `flex` on multiple competing labels are rejected because both clipped real Pixel layouts. Translation calls remain dynamic even without interpolation because RU/BE/UK/PL/EN widths differ. Web/iOS-only files, mutually exclusive JSX branches, nested row groups and literal app-owned icon labels are excluded deliberately; the governance suite asserts that both fixture and clean-checkout scans are non-vacuous;
- `guard:locale-number-format` enforces `LOCALE-NUMBER-FORMAT-001`: a displayed number goes through `i18n/format.ts` (`formatNumber`, `formatInteger`, `formatCompactNumber`, `formatCurrency`) or a domain wrapper over it (`utils/distanceCalculator.ts` for distance, `utils/ratingHelpers.ts` for a rating, `utils/fileSize.ts` for a file size), and its unit comes from a translation key. Three shapes fail: (1) a `.toFixed(0..2)` result that reaches a display position — JSX text, a display prop, a translation argument, or through variables and formatter functions of the same file, followed to a fixpoint across plain expressions; (2) a computed number glued to a hardcoded unit or compact suffix (`K`, `M`, `тыс.`, `км`, `KB`), whether it came from `.toFixed()`, `Math.round()` or arithmetic — that suffix is user-visible text wherever it is written; (3) `numeric-translation-argument` (`#1468`) — a raw number handed to a translation placeholder whose RU string puts a unit right after it (`{{value1}} км`). Shape 3 reads the unit from the RU catalogue (`i18n/locales/ru`, the typed baseline), not from a template literal: it resolves the key, finds the placeholder, and fails when the value did not come from `i18n/format.ts` or a domain wrapper — the fix is to hand the argument an already-formatted string. Coordinates (`lat`/`lng`/`lon` receivers), precision above two digits, ISO-8601 durations (`PT45M`), machine props (`points`, `style`, `testID`, `href`, `data-*`, event handlers), placeholders with no trailing unit (counters, indexes, years, page numbers) and i18next's plural `count` are excluded structurally rather than by allowlist, because a locale decimal comma would itself be the defect there — or, for shape 3, because nothing marks the value as a measured quantity. Known limit: the alias fixpoint does not cross a function or `useMemo` body — following those would call half a file displayed. `services/` joined the scanned roots in `#1465` and `constants/` in `#1468`; both extensions surfaced real call sites, not a deliberate boundary. Four tickets in a row — `#1433`, `#1440`, `#1449`, `#1457` — fixed this same root in one more domain each, `#1465` extended the scan to PDF export, and `#1468` added the third shape; the guard exists so the next domain fails at development time. The governance suite keeps the allowlist empty and rejects a vacuous scan — for shape 3 through the `catalogueSize` and `unitPlaceholderCount` counters, so it cannot pass by scanning an empty catalogue;
- `guard:seo-cli-contract` enforces `SEO-OPS-001`: every `scripts/seo-*.js`, `scripts/indexnow-*.js`, `scripts/index-status.js`, `scripts/test-seo-prod.js` and `scripts/post-deploy-seo-check.js` parses its arguments through `scripts/lib/seo-cli-contract.js`, runs through `runSeoCli`, holds no hand-rolled flag lookup (`argv.includes('--all')`, `args.indexOf('--limit')`, `arg === '--json'`, `case '--json'`, a locally aliased `argv.slice(2)`) and never exits zero explicitly (`process.exit(0)`, `process.exit()`, `process.exit(failed ? 1 : 0)`, `process.exitCode = 0`). Those shapes answer a typo with the widest default — that is how `#1389` submitted 544 URLs, how `#1325` reported a green "0 checked", and how `test-seo-prod.js --ur https://dev.metravel.by` used to check production instead. The covered set is walked from the filesystem under `scripts/` at any depth except `scripts/lib/`, so a new script of that family — or one moved into a subfolder — is guarded without editing an allowlist. There is deliberately no skip-when-unclear path: an empty or unreadable covered file fails, and a scan that matched zero files fails too, because a clean report over nothing is the very defect this guard exists for. Since `#1398` a covered script also declares in its CLI spec what it works on — `selection: 'articles'` for a run over a list, `selection: 'none'` for one that takes a single named target such as `seo-edit --id 641`. A missing or empty declaration fails; a declared selection must call `requireNonEmptySelection()`, because rule four only catches the loud spelling of the green report and a script that simply returns from `main()` over an empty list still exits zero; and a `'none'` declaration next to a flag that means many targets (`--all`, `--ids`, `--limit`, `--map-file`, `--urls-file`) fails as a stale declaration. Every rule reads the file through one scanner that blanks what is not executable code, character for character, so line numbers still point at the source. Comments are blanked for every rule — whole-line, trailing or inline block — so a comment neither satisfies a requirement nor triggers a ban. String, template and regex contents are blanked only for `empty-selection-guard`, the one rule that asks whether a call is there: `requireNonEmptySelection(` named in the USAGE text is prose, while the same call inside a `${…}` interpolation still counts. The other four rules read literals as written, so text in USAGE can still satisfy their needles — narrowing that is `#1442`, not this guard's contract today. The declaration is read only from a top-level `CLI_SPEC`: a `selection` nested in a flag config, a local `CLI_SPEC` inside a function, or one quoted in a string does not answer for the script;
- `check:fast` is the default lightweight workflow for a finished logical block: it runs selective checks, `guard:external-links`, `guard:type-debt`, and ESLint only for changed lintable files;
- the `check:fast` ESLint step uses a local cache and `--max-warnings=0`, so repeat runs stay fast while new warnings in touched files still fail the block;
- local selective checks now include targeted app Jest suites for travel/map/account/messages changes in addition to schema/validator selective runners;
- `check:e2e:changed` selects Playwright specs by changed area (travel/search/map/account/messages/quests/places/articles/calendar/trips/roulette/export/i18n-security), always includes a directly changed regression spec, and fans shared E2E infrastructure changes out to the complete deterministic regression set;
- `check:preflight` extends `check:fast` with changed-file complexity validation and selective Playwright smoke coverage in `testing`; the review-stage pre-push invocation sets `PREFLIGHT_SKIP_E2E=1`, so no browser-level gate runs before the ticket enters `testing`;
- `check:preflight` resolves changed files once and reuses the same scope for fast checks, complexity guard, and selective e2e;
- Cross-session quality gate: `check:fast`, `check:changed`, `check:e2e:changed`, `check:preflight`, `test:run`, `e2e`, and `release:check` acquire the same atomic `.codex-temp/ops/quality-gate.lock` through `scripts/run-with-quality-gate-lock.js`. A concurrent session exits immediately with code `0`, owner PID/name, and an explicit `SKIPPED` message instead of starting another Jest/Playwright/build pipeline. That session must stop its own launch: do not wait, poll, monitor the owner, rerun after release, or start a narrower bypass check. `validation delegated/skipped: active gate pid/name` is coordination evidence only, never `passed` or a final Testing verdict. If the result is required for acceptance, request it from the active owner and resume the same acceptance pass; do not close from delegation alone and do not park the task in `testing`. Nested commands in `release:check` reuse the parent lock; dead-owner locks are recovered automatically. Jest `globalSetup` applies the same non-waiting contract to direct targeted `npx jest` runs. Do not bypass the wrapper with direct Playwright commands.
- Production deploys additionally keep `.codex-temp/ops/web-build.lock` for the full `build-prod.sh` lifecycle (export, SEO post-processing, upload, graceful Nginx activation, and public readiness), not only for the Expo child process. The lock lives outside `dist` so Expo cannot delete it while recreating the export directory. This prevents an E2E web server or another export from reusing `dist` while a release is still being prepared.
- the repository `pre-push` hook invokes `check:preflight` against the current upstream diff (`HEAD` vs upstream); the mandatory review-stage command passes `PREFLIGHT_SKIP_E2E=1`, preserving code-level checks while deferring selective Playwright to `testing`;
- without args, the command scans staged, unstaged, and untracked files from the current git working tree;
- `--base-ref <ref>` compares `HEAD` against `git merge-base HEAD <ref>`;
- `--changed-files-file <path>` reuses an explicit newline-separated file list;
- dry-run JSON returns both selective decisions in one payload, which makes CI/local diagnostics easier to compare.

## Playwright suite safety

- `npm run e2e` runs the deterministic regression suite in `E2E_AUTH_MODE=guest`. It defaults API traffic to `http://127.0.0.1:8000`; an omitted E2E API target never falls through to production. Specs that need an authenticated UI must seed/mock that contract themselves.
- Specs that create, update, upload, reset, or delete real backend records are classified in `scripts/e2e-suite-classification.js` and excluded from the default suite. Run them only with an explicit non-production target and mutation opt-in: `E2E_API_URL=http://... E2E_ALLOW_LIVE_MUTATIONS=1 npm run e2e:live-contract`.
- Production browser/API targets are blocked unless both `E2E_SUITE=production-smoke` and `E2E_ALLOW_PRODUCTION_API=1` are set. `npm run e2e:production-smoke` selects only the read-only production specs.
- Missing/unreachable `baseURL` and a configured-but-invalid required account session fail global setup instead of creating an empty state and reporting authenticated scenarios as passed. `live-contract` forces `E2E_AUTH_MODE=required`.
- `test-quality-governance.test.ts` rejects focused/disabled tests, literal boolean assertions, and diagnostic/manual filenames in the automated spec tree.

## High-risk coverage slices

- `npm run test:coverage:export-settings` is the reproducible branch/function/line
  baseline for `BookSettingsModal` and its focused helpers. The modal is no longer
  hidden by `coveragePathIgnorePatterns`; its existing interaction, validation and
  premium-gate tests now contribute to ordinary Jest coverage.
- The old `components/ArticleEditor.web.tsx` exclusion was stale after the editor
  moved to `components/article/`; current editor modules are already measurable.
- Stale blanket exclusions for maps, upload, gallery, and export layout were removed.
  Their existing tests now contribute to ordinary Jest coverage; missing branches must
  remain visible in coverage reports instead of being hidden by configuration.

## Validator Contracts

- Local helper commands:
- `yarn validator:error-codes:docs:check`
- `yarn validator:error-codes:docs:update`
- `yarn validator:contracts:check`
- `yarn validator:contracts:summary`
- `yarn validator:contracts:summary:validate`
- `yarn ci:workflow:contract:validate`
- `yarn ci:workflow:contract:validate:json`
- `yarn ci:workflow:contract:summarize`
  - In PR runs, CI manages a marker-based PR comment lifecycle for validator guard:

## Smoke Suite Baselines

`npm run test:smoke:critical` is intentionally a compact 10-suite product matrix
(auth, travel, profile, subscriptions, export, map, quests, places, filters, theme).
Quality-pipeline and documentation-contract tests remain in governance/full Jest and
are not counted as critical user-flow smoke.

Smoke trend baseline (`SMOKE_DURATION_PREVIOUS_SECONDS`):

- yarn smoke:baseline:recommend
- yarn smoke:suite-baseline:recommend
- yarn smoke:suite-baseline:validate
- yarn smoke:suite-baseline:validate:json

Common `gh` errors:

- Missing auth token: run `gh auth login`.
- Missing repo scope for variables/artifacts: ensure token permissions include `repo`.

## CI Incident Template

Incident template (minimum):

- Failure Class: <infra_artifact|inconsistent_state|lint_only|smoke_only|mixed|performance_budget|selective_contract|validator_contract|config_contract>
- Recommendation ID: <QG-001..QG-009>
- Workflow run: <required URL>
- Branch / PR: <required identifier>
- Selective decisions artifact: <optional artifact URL; recommended for selective_contract>
- Validator contracts artifact: <optional artifact URL; recommended for validator_contract>
- Runtime config diagnostics artifact: <optional artifact URL; recommended for config_contract>

# - primaryArtifactKind: none | selective_decisions | validator_contracts | runtime_config_diagnostics

Generator helper:

- yarn ci:incident:template
- yarn ci:incident:publish
- yarn ci:incident:publish:json
- yarn ci:incident:validate
- yarn ci:incident:validate:json
- yarn ci:incident:payload:validate
- yarn ci:incident:payload:validate:json

Expected `Incident Payload Validation` summary snippets:

- `### Incident Payload Validation`
- `- OK: true|false`
- `- Error count: N`

## Workflow Contract

Workflow Hint Rules Contract (stable order):

Source of truth: `scripts/summarize-ci-smoke-workflow-contract-validation.js` (`ACTION_HINT_RULES`).

- `missingSummarySettings` -> `[P1]`
- `missingOutputRefs` -> `[P1]`
- `missingStepIds` -> `[P2]`
- `missingArtifactNames` -> `[P2]`
- `missingArtifactPaths` -> `[P3]`

## Quality Gate Recommendations

<a id="qg-001"></a>
- `infra_artifact` (`QG-001`)

<a id="qg-002"></a>
- `inconsistent_state` (`QG-002`)

<a id="qg-003"></a>
- `lint_only` (`QG-003`)

<a id="qg-004"></a>
- `smoke_only` (`QG-004`)

<a id="qg-005"></a>
- `mixed` (`QG-005`)

<a id="qg-006"></a>
- `performance_budget` (`QG-006`)

<a id="qg-007"></a>
- `selective_contract` (`QG-007`)

<a id="qg-008"></a>
- `validator_contract` (`QG-008`)

<a id="qg-009"></a>
- `config_contract` (`QG-009`)
Meaning: runtime config diagnostics report failed/missing while lint+smoke are otherwise green.
- `yarn config:diagnostics:json`
- `yarn config:diagnostics:strict`

## Known peer dependency warnings

- Keep this section for stable test anchors.

## Validator Error Codes Table

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
