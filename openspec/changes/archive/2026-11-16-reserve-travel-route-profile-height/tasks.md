## 1. Source implementation

- [x] 1.1 Preserve and validate the optional article count; share the early reserve between deferred map and route-profile frames.
- [x] 1.2 Bind preview completion to current article/files; keep reserve through parsing and chart Suspense, release through existing measured shrink.
- [x] 1.3 Restore article 544 route-block CLS accounting and document the causal delta in Problem Memory.

## 2. Source evidence and review

- [x] 2.1 Add/run focused normalization, readiness, first-frame/Suspense and DOM surplus-release regressions via the quality wrapper.
- [x] 2.2 Run scoped lint/type/guards and OpenSpec strict validation; obtain independent review-auditor and code-review-gate verdicts.

Source evidence: `.codex-temp/sprint35-frontend/source-review.md`. Both independent reviews PASS after the earliest-placeholder fix. Full source and scoped CLS types pass; full e2e types report six errors in three unchanged specs (`e2e-typecheck.log`) and are not claimed green.

## 3. Coordinator delivery and acceptance

- [x] 3.1 Coordinator commits explicit paths, pushes reviewed source, enters testing, deploys and verifies the published revision.
- [x] 3.2 Run the contracted real-production 544/470 CLS matrix, slow-reader and zero-count controls with screenshots/console/network; record the runtime verdict.
- [x] 3.3 Renew the bilateral slider 2-case and slider-perf 37-case gates against the SVG sizing contract; verify actual mobile touch/swipe and vertical scroll.

Runtime app/test snapshot: `4c1de3a60d4ecfbf62d2ae60f46f541b0d9f3532`.
The exact production matrix is 544 mobile390/desktop1280 12/12 at 220 ms;
470 mobile390 5 at 220 ms and desktop1280 8/8 at 220/450 ms, 400px from TOP.
45/45 PASS, max CLS `0.009893247492972202`, original points/map and extended
`route-elevation-*` sources 0. All selected runs reach the real bottom with
profiles loaded, reserve absent and real SSR count equal to live API.

Original cases 43/45 are resource-invalid because foreign quality work
overlapped them. Parent verified the peer's full chronology: cases 1–42 and
44 are valid. Two fresh replacements for 43/45 PASS with the same harness
SHA256 `57c8ac8cd51577a2bc3e239d7b0b68620c2f18663c42cd26904f650a57255aa5`;
aggregate = 43 original + 2 replacements, with no product-failure retry or
old partial reuse. Original 45 JSON/44 PNG are byte-for-byte archived read-only.
Evidence: `.codex-temp/sprint35-frontend/fresh45-aggregate-4c1.json`.

Live controls PASS: slow390/GPX-visible 544, natural surplus release, real 967
count0 without a profile/reserve, actual touch 2→3→2 plus vertical scroll.
Renewed `verify:slider` 2/2 and `verify:slider-perf` 37/37 PASS on QA4c1,
workers1/retries0/skipped0/flaky0; own browsers closed and resources released.
Evidence: `.codex-temp/sprint35-frontend/controls-runtime-4c1.json`.

Console is retained rather than claimed empty: the 45 selected raw records
contain 216 unknown-feature policy warnings, 355 unload-policy console errors,
19 NotSameOrigin resource errors and one Instagram embed GET500 in case18.
That external embed is the only HTTP ≥400 in the selected request ledgers;
pageErrors/unexpected writes are0. Controls retain two NotSameOrigin console
errors. The retained request ledger also records 324 same-origin
`/proxy/tiles/osm/9/*` GET failures `net::ERR_ABORTED` across 27 desktop samples
(24 URLs, ResourceTiming initiator
`img`); their cancellation cause is not established by this snapshot. All
NotSameOrigin failures identify the external Tripvenue logo. The unchanged
harness did not retain request.resourceType or console.location.url; those
fields are unavailable, not inferred. Exact ownership table:
`.codex-temp/sprint35-frontend/fresh45-console-network-ownership-4c1.json`.
The coordinator classifies these observations as nonblocking for the unchanged
CLS/profiles/count/reserve/bottom/pageErrors0/writes0 contract, which does not
require blanket console0. Their cause remains unassessed; tiles are not claimed
fully healthy, and task source did not change native/Leaflet cancellation code.
There is no new runtime retry, guard relaxation or suppressed raw evidence;
the same-origin cancellation ambiguity remains available to the auditor.

## 4. Durable guard and closure

- [x] 4.1 Review and validate the new real-GET SSR/API count cases for 544/470/967 in the existing production-smoke spec, with exact identity, integer/nonnegative count and equality; retain the target guard and require the actual app SHA.
- [x] 4.2 Run only the focused new guard on published app4c1; record its separate as-tested source base/diff fingerprint. Do not redeploy or repeat45 for this test-only change.
- [ ] 4.3 Obtain bounded final closure-metadata confirmation, commit/push explicit owned paths through normal hooks, record the immutable test/docs SHA separately from app4c1, and complete the board only after this publication gate passes.

Guard source audit/final gate PASS, findings0. Actual scoped E2E TypeScript,
ESLint1file, OpenSpec strict, diffcheck and normal checkfast6/1lint+governance PASS.
The three new GET-only cases PASS3/3 (544 SSR/API1/1, 4701/1, 9670/0), workers1,
retries0/skipped0/flaky0, app4c1 pins before and after each case. Only fresh
guest API request contexts ran; no browser, older five-case CLS or45 replay.
As-tested source base: `eb4f7e25e909b5f4b36c92aea64f1849ca3ad1cd`; fingerprint:
`706e47d83f1139a16d36c002a80093e2460d69aa8cd542c7d605966ec90b2da3`.
The npm wrapper's explicit-grep syntax rejection is retained as exit2/NOTRUN;
its documented direct-Playwright command through the normal quality wrapper
preserved the production target/classifier/opt-in and passed3/3. Evidence:
durable-guard-worktree/.codex-temp/sprint35-3436-guard/checks-summary.json.

The installed `openspec archive reserve-travel-route-profile-height --yes`
synchronized the one added requirement into the existing canonical spec and
archived this change as `2026-11-16-reserve-travel-route-profile-height`.
It reported 10/11 tasks and one incomplete-task warning: future publication
task4.3 remains unchecked; it was not marked complete to suppress that warning.
No `--skip-specs` or `--no-validate` was used. Full e2e
TypeScript remains NOT PASS: six existing diagnostics in three unchanged specs
(`ai-assistant-ask`, `ai-assistant-plan`, `travel-full-flow`); scoped checks do
not turn that result green. Live remains4c1; newer #3440 Map and #3442 API source
is not described as deployed. The task remains testing until final closure.
