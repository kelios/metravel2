## Context

See proposal.md. Reuse the pending physical runner, native-recording-readiness validator and existing authoritative scene catalog. Root-approved requirement/design boundary precedes segment implementation. Foreign streamline-native-scenario-automation artifacts remain unchanged.

## Goals / Non-Goals

Goals: independently validate normalized execution receipts; permit exact assigned children without inventing parent coverage. Non-goals: full scripts/fixtures, video verifier, provenance attestation, device takeover or entire foreign-change adoption.

## Decisions

- Reuse/export a narrow normalized execution validator from tools/ios-device-uitests/run.js; readiness checks actual counts/identity and received script SHA256 against JSON.stringify(scenario.steps), plus completed steps/assertions. Reject only-status reports rather than retaining a weak legacy pass fallback.
- Add requiredSegments only to ugc-flag-content in .codex/skills/metravel-app-review-evidence/scenes.json: travel,comment,message,trip-chat,quest-review,photo. Reject arbitrary aliases. Plan entries use id=parent plus optional segment; completeReviewSegments is an array of exact parent/segment strings. Reject segments in regression plans and invalid/duplicate declarations.
- Uniqueness is parent/segment, so distinct children coexist. A child requires its exact declaration and its own report/hash checks; full parent still requires completeReviewScenes including parent AND all six segment declarations in the same complete scenario. Reject promotion by combining separate child reports.
- Preserve scenario/source/candidate/environment/freshness validation for every request. Console success counts full scenes and child segments separately and qualifies that video/privacy are not verified.
- Ownership: readiness JS/test, catalog, narrow existing run.js export; previous exact3path execution patch is separate reviewed boundary. New OpenSpec directory only. No package/docs/app/other foreign edits.

## Risks / Trade-offs

- Previously label-only synthetic reports fail: intended safety tightening; fixtures must include honest synthetic execution marked as unit-only.
- Future result schema may differ: fail closed; adapt only from real offline result and new tests.
- Declarations require source review, not proof of semantic full coverage: real matching candidate/role/production fixtures and assertions remain mandatory.
- No API/backend, auth, external URL, WebView, SEO, accessibility, bundle performance or analytics change. Security: receipt contains only digest/counts; no raw payload or secrets. Physical source/TestFlight verification remains separate.

## Migration Plan

Preserve original files/hashes in ignored driver-adoption baseline; implement and unit-check source; independent full relevant diff review before any adoption. Reverse only owned patch against matching after hashes for rollback; do not reset foreign edits. No runtime until testing and sole target handoff.

## Validation matrix

Native readiness/execution: focused Jest with positive and missing/zero/skipped/failed/wrong-case/wrong-hash/incomplete negative receipts; two child success, duplicate/unknown/mismapped declaration, missing full-parent flag/segments, child candidate/hash/age mismatch; preserve all existing regression tests. Exact changed JS/test lint and syntax; catalog JSON parse. Swift existing parse/typecheck remains valid if unchanged. Other platforms/locales/app UI have no runtime gate because behavior is unchanged. After independent review, testing owner verifies actual helper positive/missing-state and complete assigned candidate scenes; no unit mock counts as readiness of real footage. Validate this OpenSpec strictly before apply and all before eventual archive.
