## Context

See proposal.md. The map composition owns height via `TravelDetailsMeasuredFlow`; its `growthOrigin="end"` deliberately preserves a reader on the map instead of following late route points. The old reserve was keyed to a late route-list response, so the reserve itself caused the shift. `useRouteFilePreviews` also has a render between list completion and its passive parsing effect: `isRoutePreviewLoading=false` alone cannot mean settled.

## Goals / Non-Goals

- Reserve in `TravelDetailsDeferredSectionsSkeleton` (before the outer deferred chunk), `TravelDetailsDeferred.tsx` (before its section chunk) and `TravelRouteMapBlock.tsx` (before parsing/chart chunks), using one lightweight reserve primitive.
- Keep `TravelDetailsDeferredTransition.tsx` and native components unchanged; rely on their existing shrink, anchoring and clipping mechanisms.
- Preserve API and parser request timing; no extra count/list request.

## Decisions

1. Add optional integer field to `Travel`, sanitize it in `normalizeTravelItem`, and retain it in the initial SSR loader projection so the reserve does not depend on the background detail request. A small profile-reserve primitive uses 560 px per declared file, covering the observed mobile maximum 547 px and desktop 441 px without a second layout-guess branch. The temporary overestimate is removed through measured shrink. Zero/absent/invalid values return no placeholder. Reject discovering count from the late route list and blanket reserves on articles without tracks.
2. Add completion metadata in `useRouteFilePreviews`, bound to current travel id and supported-file snapshot. It becomes ready only after the current list has settled and that snapshot's parsing has completed (or a settled empty/error response needs no parsing). Keep a stable empty-list default. Existing profile contents/loading flags remain unchanged. A stale asynchronous task cannot mark a new snapshot ready.
3. The route-profile wrapper holds minimum height while previews are unresolved. The same reserve remains in the chart Suspense fallback, preventing a chunk-load gap. Existing profiles are not hidden while refreshing. Once resolved, natural height enters the unchanged outer measured flow, whose shrink rule owns surplus. Add the same reserve to the earlier map placeholder so lazy section mount does not reintroduce the late-slot mechanism.

4. The web chart SVG explicitly retains `CHART_HEIGHT`, matching its first-frame reserve. The shared critical media reset otherwise overrides SVG height attributes with `height:auto`, shrinking the actual chart (120 → 108.3125 px on 390) and shifting internal point cards during the width-measurement handoff. This inherited #3430 boundary is covered by a real DOM SVG test under the actual critical CSS; native SVG sizing and profile data geometry stay unchanged.
5. Restore article 544 route-block shifts to the committed CLS gate. Do not loosen budgets or compensate growth with a scroll jump.
6. Keep a durable GET-only SSR/API comparison in the existing production-eligible CLS spec. Read the original loader JSON and actual detail response for 544/470/967, assert exact identity, nonnegative integer counts and equality, and pin the published app SHA. Browser hydration must not repair a missing field before the assertion; no mock, new allowlist or helper exception is needed.

## Risks / Trade-offs

- A file can yield multiple profiles → count is a lower-bound estimate; preserve existing growth behavior for excess profiles, test count/rendered-profile mismatch, and retain production CLS acceptance for 544/470.
- Conservative height adds temporary slack → existing shrink must hold it only while needed; a real DOM regression checks first frame, profile fill and surplus release.
- Cached lists / navigation / delayed parsing → source-bound completion and hook tests with real parser and controlled transport.
- SSR HTML can lack the new field for 24 hours → old payload has no reserve; acceptance must record actual embedded/article data, not silently substitute a count.

## Migration Plan

Backend #3435 is already deployed. No migration or dependency install. Local writer runs focused source tests/static checks and independent review. Coordinator commits explicit task paths, pushes, enters testing, deploys and verifies live revision before production acceptance. Roll back only this task's frontend diff; backend field remains compatible.

## Validation selection

- New completion metadata: focused hook behavior tests with real GPX/KML parsing; existing hook/model tests cover native-compatible behavior.
- Web geometry: first-frame component tests and DOM measured-flow regression; no runtime before review/publish/testing.
- In testing: mobile 390×844 first, desktop 1280×800. Hexenstieg 544: 12 traversals each at 400px/220ms. TMB 470: desktop 8 at 220ms + 8 at 450ms, mobile 5. Each complete traversal starts at TOP, reaches the real bottom and has CLS ≤0.1 with no route-point/route-map or `route-elevation-*` sources; real embedded counts equal the API. Slow mobile shows profiles as soon as parsed; 967/zero count leaves no profile slot. Screenshots and console/network evidence required.
- Reuse previous shared-flow shrink controls unchanged; rerun nearest affected DOM tests. No Android/iOS binary or locale matrix: no native boundary or copy changes.

## Recorded runtime acceptance and remaining closure

App/test snapshot `4c1de3a60d4ecfbf62d2ae60f46f541b0d9f3532`: fresh45 PASS,
max CLS `0.009893247492972202`, forbidden sources 0. Two original samples
(43 and 45) overlapped independently confirmed foreign quality work and are
excluded. The other 43 originals plus two new uncontended replacements with
the unchanged harness `57c8ac8cd51577a2bc3e239d7b0b68620c2f18663c42cd26904f650a57255aa5`
form the exact 12/12/5/8/8 matrix; no product-failure retry or old partial reuse.
The complete original raw folder is preserved byte-for-byte in a read-only
archive. The aggregate includes per-case source/count/bottom/profile/CLS evidence,
selected hashes and peer chronology. Live slow-reader/surplus/967 controls and
touch/swipe PASS; renewed bilateral slider 2/2 and slider-perf 37/37 PASS.

The SSR count guard passed independent audit/final gate, scoped E2E TypeScript,
ESLint, OpenSpec strict, diffcheck and normal checkfast6. Its three real GET-only
production cases passed (544 SSR/API1/1, 4701/1, 9670/0) with app4c1 checked
before and after each case; no browser or old CLS replay was needed. The initial
npm runner rejected explicit grep before Playwright (exit2/NOTRUN); the runner's
documented direct-Playwright invocation through the normal quality wrapper kept
the same safety configuration and completed3/3, workers1/retries0.

As-tested source base is `eb4f7e25e909b5f4b36c92aea64f1849ca3ad1cd`, diff
fingerprint `706e47d83f1139a16d36c002a80093e2460d69aa8cd542c7d605966ec90b2da3`.
The installed CLI synchronized/archived the change on 2026-11-16, retaining one
incomplete future publication task with an explicit warning. Normal final confirmation,
explicit commit/push and board completion remain pending. The future committed
test SHA is not the deployed app SHA; these test/docs changes do not publish
unreleased Map/API source. Full e2e TypeScript remains NOT PASS with six known
diagnostics in three unchanged specs.
