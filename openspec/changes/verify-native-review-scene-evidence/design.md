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

## Phased authentication decision

Reuse the existing public runner with --rehearsal and its private QA_PRIVATE_INPUT=1 diagnostic mode through its exported in-process main. Host owns one quality gate; each runner phase reuses that legitimate gate and acquires/releases its existing non-reentrant device lock. Do not take a host device lock or put the runner inside a second process-group timeout that could kill its cleanup while detached xcodebuild remains active. Give each phase the remaining budget minus a bookkeeping reserve; refuse dispatch below the runner's minimum rather than extending the deadline. Validate total budget and the named registration activation receipt path before output or any phase starts. The host checks installed version/build through devicectl before and after every private phase and records separate observations, never fabricating observedCandidate in the diagnostic report. Each phase must have intended XCTest completion, script hash and exact counts; zero private assertions are permitted, empty dispatch and skipped tests are not.

All authentication phases require IOS_QA_ATTACHMENTS=none, including public assertions immediately after private input: both system and user attachments use keepNever even on failure. This strict optional runner policy also rejects explicit shot/tree operations before activation, patches only the runtime xctestrun copy and records both lifetimes in the report; the whole-flow validator rejects missing or downgraded policies. Unrelated runner calls retain their existing defaults. Runner source hashes change legitimately and require a fresh qualified helper/cache and dummy-canary receipt; no existing pinned helper or canary is promoted. This prevents the first public credential-form absence failure from retaining automatic credential screenshots. Independent canary/privacy verification remains required.

A strict receipt binds ordered manifest phases, report/scenario hashes, predecessor entry hash, device model, opaque random account reference, candidate version/build/source/origin, API/locale/role and current orchestrator/runner hashes. Phase execution times must be fresh, sequential and nonoverlapping. A private phase binds the exact credential form selector: preceding public phase ends with that form present/hittable, private dispatch submits then explicitly navigates away and clears clipboard, and the next public phase starts with the same form absent; no capture, tree, assertion or literal input operations are permitted in private phases. No recording is orchestrated. A separate matching dummy-canary privacy attestation is mandatory before secret input. External activation receipt is tied to the disposable account and the flow before activated signed-in assertions. The host waits only for an explicitly named receipt file within the existing total deadline; an independently authorized external activation owner must write it atomically after registration. Missing evidence times out, stale/malformed/wrong-fixture evidence fails immediately; the host never activates or accesses email. Hash consistency cannot independently prove TestFlight provenance, source, transport, account role or privacy.

Draft manifests have no coverage. Execution is allowed only after literal production fixture selectors, private exit boundary, and coverage are reviewed and frozen. Whole auth coverage is limited to explicit complete stage sequences; isolated public phases cannot self-promote. Preserve single scene and six-child UGC validation without aggregation.
