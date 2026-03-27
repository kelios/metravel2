# Testing Guide

Canonical policy reference: see [docs/RULES.md](./RULES.md) for mandatory project-wide development and governance rules.

## Governance commands

Run canonical governance checks from repo root:

- `yarn governance:verify`
- `npm run governance:verify`
- `yarn guard:external-links`
- `npm run guard:external-links`

## Local selective checks

Use the same changed-file selective rules locally before a full run:

- `npm run typecheck`
- `npm run check:fast`
- `npm run check:fast:dry`
- `npm run check:fast:json`
- `npm run check:preflight`
- `npm run check:preflight:dry`
- `npm run check:changed`
- `npm run check:changed:dry`
- `npm run check:changed:json`
- `node scripts/run-local-selective-checks.js --base-ref origin/main --dry-run --json`

Behavior:

- `typecheck` is currently an explicit full-project audit command; use it before wider refactors and debt-reduction work;
- `check:fast` is the default lightweight workflow for a finished logical block: it runs selective checks, `guard:external-links`, and ESLint only for changed lintable files;
- `check:preflight` extends `check:fast` with changed-file complexity validation, so oversized touched feature files are caught before a PR grows further;
- without args, the command scans staged, unstaged, and untracked files from the current git working tree;
- `--base-ref <ref>` compares `HEAD` against `git merge-base HEAD <ref>`;
- `--changed-files-file <path>` reuses an explicit newline-separated file list;
- dry-run JSON returns both selective decisions in one payload, which makes CI/local diagnostics easier to compare.

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
