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
4. Restore article 544 route-block shifts to the committed CLS gate. Do not loosen budgets or compensate growth with a scroll jump.

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
- In testing: mobile 390×844 first, desktop 1280×800. Hexenstieg 544: 12 traversals each at 400px/220ms. TMB 470: desktop 8 at 220ms + 8 at 450ms, mobile 5. Each CLS ≤0.1 with no route-point/route-map sources; slow mobile shows profiles as soon as parsed; 967/zero count leaves no profile slot. Screenshots and console/network evidence required.
- Reuse previous shared-flow shrink controls unchanged; rerun nearest affected DOM tests. No Android/iOS binary or locale matrix: no native boundary or copy changes.
