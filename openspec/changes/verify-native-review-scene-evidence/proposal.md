## Why

#2137 needs two replacement content-report segments, but the native recording gate currently accepts a passed label without positive execution evidence and recognizes only a full six-type UGC scene. The goal is independently verified execution and honest readiness for explicitly assigned child segments.

## What Changes

- Require actual intended-test success counts and matching received-script hash/completion counts before rehearsal readiness.
- Add closed six-type required segments under ugc-flag-content and separate parent/segment identities.
- Require each child to bind its own complete scenario, hash, report, candidate/environment and freshness. Two children never imply a complete parent.
- Keep full-parent coverage declaration mandatory and require all six required segment declarations for that parent.
- Reject old label-only evidence, unsupported mappings, stale/mismatched identities and incomplete execution.

## Capabilities

### New Capabilities

- `native-review-evidence`: verifiable native rehearsal readiness with explicit full-scene versus child-segment boundaries.

### Modified Capabilities

None. Existing foreign unarchived native-scenario-readiness artifacts remain untouched.

## Impact

Platform impact: iOS testing infrastructure only; localization impact: none. User-visible app behavior, frontend/backend API/data, SEO, app accessibility, bundle performance and analytics are unchanged because this only validates local evidence. Security: retain no secrets/raw scripts in receipts; exact source, installed TestFlight provenance and production transport still require independent operational proof.

Dependencies: reviewed physical runner execution receipt; authoritative scene catalog. Root architect approved the closed mapping. Source preparation needs no device; actual candidate13, qualified production fixtures/reset, full executable scenes and a separately reviewed video verifier remain blockers for real capture, not for this implementation.

Mock policy: pure synthetic reports are unit tests only; never real rehearsal or recording-ready evidence. Preserve existing whole-scene requirements, valid historical clips/local QA, ignored pinned helper, candidate/environment/freshness checks and foreign changes. No full scene scripts, device/build/signing/store/board operations, video verification, production writes or adoption of the entire foreign change. No unresolved scope questions.
