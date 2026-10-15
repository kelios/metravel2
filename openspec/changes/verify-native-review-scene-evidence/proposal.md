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

## Phased authentication extension

Add a rehearsal-only host flow orchestrator for frozen ordered public assertion phases and private diagnostic phases. Only the reviewed whole flow may declare login, registration, or account-delete coverage; individual post-login phases cannot. Bind manifests, scenarios, reports, orchestrator and runner identities, candidate/environment, opaque random account reference, ordered receipts, predecessors and timestamps. Private input requires a matching independently reviewed dummy-canary receipt before dispatch. Registration activation is an explicit external prerequisite tied to the disposable fixture; delete and failed re-login use that same fixture. No source/fixture placeholders count as real E2E or capture readiness.

Native rejection attestations explicitly distinguish observed response body from source-classified native UI plus correlated server 401; the latter must declare that no raw body was observed and bind source/execution evidence. Real /api endpoint parity and retained native form consent/whole-field replacement are enforced for the declared composed disposable deletion path. Exact system edit menus and dummy-only replacement canary still require runtime qualification, with no app, Swift or driver behavior change.

Invoke runner phases in-process so their existing device locks and bounded subprocess cleanup survive phase timeouts. Require both attachment lifetimes to be keepNever in every auth phase, including public failure boundaries, through a strict optional runner policy; reject missing/downgraded policy in receipts. This narrowly changes run.js and its unit coverage, with no Swift/helper behavior change or cache bypass. Fresh source-bound helper and canary qualification is mandatory before auth execution. Public already-signed-in LOCAL content scenarios enter no credentials and retain their independently qualified pinned runner; they claim no auth coverage.

## Concrete authentication sequencing

Preserve the intentional incoming-link allowlist and AASA policy. Email registration has no native session; use five stages: pre-register, registration-input, post-register after externally confirmed activation, activation-login-input with the same disposable fixture, registered. Add a safe exact non-secret EN rejection tap before leaving failed re-login, with public stale-error absence and validator-enforced step order. Require independently reviewed actual native response correlation for prior valid login, deletion and rejected re-login; a separate host POST cannot substitute. Publish a unique atomic private-permission public context before each phase dispatch so an independent observer knows the opaque run/account references and phase hashes in advance. Draft scripts remain unqualified until review, dummy-canary and exact-candidate E2E.
