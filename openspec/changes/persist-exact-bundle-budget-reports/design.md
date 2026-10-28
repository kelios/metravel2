## Context

See proposal.md. `guard-bundle-budget.js` already owns full-file and metadata-stripped exact measurements but serializes rounded KiB and only failing per-route requests. `build-prod.sh` calls it before publication; `deploy-prod.sh` deletes its worktree in EXIT cleanup. The shared build-lock root already resolves the main checkout.

## Goals / Non-Goals

Preserve exact evidence through the existing lifecycle. Do not add another analyzer, alter guard arithmetic, retain dist or expose environment variables.

## Decisions

- Add `diagnostic_report` to legacy `--json`; retain all legacy fields. A helper owns metadata, schema validation, atomic persistence, retention and comparison. Guard supplies already-calculated sizes and decisions.
- Track named file sizes separately from full-file sizes during the existing loop. Track every route's request count during existing HTML analysis; unavailable values use null/status rather than plausible zero.
- Eager evidence identifies its `html_routes` or `configured_chunks` source and complete/incomplete/not-configured status. Missing route assets make maximum eager bytes unavailable. Configured-chunk diagnostics sum existing full-file measurements; the legacy fallback guard still compares named bytes, and its breaches explicitly identify that basis.
- Preserve rounded-KiB comparisons. Exact byte breaches record the actual byte measurement and the effective integer upper boundary of the existing rounded 0.1 KiB policy, plus that policy/configured limit, so reporting does not silently tighten the guard.
- `--report` installs synchronous exit persistence early enough for missing/config errors; fatal failures produce error verdicts with unavailable measurements. Diagnostic failure is logged without replacing the original guard exit status.
- `build-prod.sh` enables reports. `deploy-prod.sh` supplies its main-checkout deploy directory; direct builds resolve the same directory through the existing shared-root helper. Atomic sibling temp creation and rename complete before the calling shell's cleanup.
- Own archive names identify version/SHA/time/nonce; validate own report before retention removal. Maximum 20 reports, 30 days and 8 MiB each. Comparison reads/validates only reports, never dist.

Rejected: parsing rounded console logs or a second analyzer, because either loses precision or drifts from the canonical verdict.

Affected paths: guard, bundle report helper, comparison CLI, build/deploy scripts, focused report/release fixtures. No package or product config changes.

## Risks / Trade-offs

- Rounded guard semantics are easy to change accidentally → preserve original comparisons and add boundary tests.
- Missing input could look green → explicit unavailable/error state and fail-closed guard coverage.
- Filesystem failure could replace original result → catch/log only diagnostics, preserve original code.
- Concurrent writers → exclusive temporary files and unique final names; canonical deploys already share a build lock.
- Real artifact evidence needs the next required export → root coordinates #2738; do not create a duplicate export.

## Migration Plan

Additive schema and CLI need no migration. Run focused fixtures, scoped lint and shell syntax checks, independent review, then normal task commit/push. Reuse the next already-required canonical production export to verify SHA/verdict/path/cleanup. Roll back by reverting only task-owned paths; existing deployment guards remain unchanged.
