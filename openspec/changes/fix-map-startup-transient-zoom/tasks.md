## 1. Instrumented Baseline

- [x] 1.1 Build a startup probe (kept in an ignored local folder) that subscribes to the map's `zoomstart`, `zoomend`, `load` and `moveend` events and records `(event, zoom, timestamp)`; do not poll `getZoom()`, since a level entered and left between samples is exactly the defect under investigation.
- [x] 1.2 Extend the probe to collect the base-tile inventory from real transfer sizes, grouped by full request URL and then by the `z` segment of `/proxy/tiles/osm/{z}/{x}/{y}.png`, and to report the single pre-hydration warm-up tile as its own line rather than folding it into a zoom level.
- [x] 1.3 Run the probe cold (empty cache) at least five times per viewport at 1350×940 and 412×823 against the current build, and record the median per-level table (level, tile count, bytes), the totals, the settled centre/zoom and the time to the settled view.
- [x] 1.4 Confirm the baseline reproduces #1291 — desktop levels 8+9+13 at 66 tiles / 1,748 KB, mobile at 20 tiles / 750 KB — and confirm from the zoom-event trace that the radius-derived level is settled on before the final fit; if it does not reproduce, stop and report instead of implementing. **Resolved by the owner-approved revision of 2026-08-10 (see below): the defect reproduces, two premises were corrected.**
- [x] 1.5 Capture the pre-change settled-view screenshot on both viewports as the visual baseline for the final centre/zoom comparison.

### Baseline evidence — 2026-08-08

Five live-production cold runs per viewport were recorded in
`.codex-temp/board-1291/baseline-live-v2.json`; the event trace comes from
Leaflet's `zoomstart`/`zoomend`/`load`/`moveend` events and the byte inventory
comes from CDP `Network.dataReceived`/`loadingFinished`. The one head warm-up
tile (`z11`, median 42,715 bytes) is excluded from the tables below.

| Viewport | Level | Median requests | Median transferred bytes |
|---|---:|---:|---:|
| desktop 1350×940 | z8 | 20 | 903,834 |
| desktop 1350×940 | z9 | 16 | 575,955 |
| desktop 1350×940 | z13 | 30 | 272,307 |
| desktop total | — | 66 | 1,752,096 |
| mobile 412×823 | z8 | 12 | 540,647 |
| mobile 412×823 | z13 | 8 | 0 (all eight requests aborted before body transfer) |
| mobile total | — | 20 | 540,647 |

Desktop reproduces the reported levels, request count and ~1,748 KB transfer.
Mobile reproduces the reported levels and 20-request inventory, and the event
trace still settles on z13 before final z8, but current real transfer is 540,647
bytes rather than the required 750 KB because the obsolete z13 requests are
cancelled before body bytes arrive. Per Task 1.4, implementation is paused until
the artifact is revised or the 750 KB mobile baseline is reproduced. Settled
views were stable at desktop z9 / centre 53.97870,27.46015 and mobile z8 /
centre approximately 53.83470,27.46033; both pre-change screenshots are stored
next to the JSON report.

### Owner-approved revision — 2026-08-10

Task 1.4 blocked implementation because the recorded baseline contradicted two
premises of the original artifact. The owner approved the revision below; the
defect itself is confirmed and unchanged.

1. **Primary invariant is request-level, not byte-level.** Mobile initiates 20
   requests, of which 8 obsolete radius-zoom (z13) requests are aborted with 0
   body bytes, so the real transfer is 540,647 B and the original 750 KB mobile
   premise is wrong. The invariant is therefore **zero initiated requests at the
   radius-derived level**; mobile `≤ 650 KiB` stays only as a non-regression
   bound.
2. **The mobile final zoom is no longer 8.** #1348 floors the compact-pane fit
   at `COMPACT_MIN_FIT_ZOOM = 11`, so requiring a final z8 would revert accepted
   behaviour. The mobile requirement is now the compact floor, i.e. **final zoom
   ≥ 11**; desktop final z9 is unchanged.
3. **#1350 is explicitly preserved:** a viewport the user set by hand is not
   refitted when a later results page or a background refetch arrives.

Desktop evidence (66 tiles / 1,752,096 B across z8+z9+z13) is unaffected and
remains the byte baseline for the desktop budget.

## 2. Remove the Transient Startup View

- [x] 2.1 Remove the radius-derived pre-fit view application in `components/MapPage/Map/MapLogicComponent.tsx`, including its `!isTestEnv` divergence, so the browser and the test environment follow the same startup path.
- [x] 2.2 Remove the radius-derived view application in the results-gated block and drop `getInitialRadiusZoom` (plus the now-unused `lastPreFitKeyRef`) once it has no remaining consumer, leaving the auto-fit effect as the single owner of the startup view.
- [x] 2.3 Keep the initialization bookkeeping intact — `hasInitializedRef`, `lastModeRef`, `lastRadiusKeyRef`, `lastUserLocationKeyRef`, `lastAutoFitKeyRef` and `syncZoomFromMap` still govern when a re-fit is allowed — and leave route mode's own initial view unchanged.
- [ ] 2.4 Re-run the probe from Task 1 on both viewports and check which level the base tile layer attaches at; if base tiles still settle on the container mount zoom, apply only the bounded follow-up from design Decision 2 (align the container's initial zoom with the computed startup zoom) and re-measure.
- [ ] 2.5 If neither the removal alone nor the bounded follow-up meets the level and byte budget, stop and revise the OpenSpec design instead of widening the scope, delaying the base layer or lowering the final zoom.

### Implementation note — 2026-08-10

The auto-fit effect already runs on a valid circle alone
(`canAutoFitRadiusView = hasRadiusResults || hasValidRadiusCircle`), so the
removed pre-fit was never what made the circle visible before results — it only
inserted a radius-derived zoom that the fit immediately overwrote. `disableFitBounds`
is `useState(false)` in `Map.web.tsx` and never set, so no surface loses its
startup view by relying on the removed `setView`. `hasInitializedRef` is created
in `Map.web.tsx` and only passed down; nothing outside `MapLogicComponent` reads
it, so its radius-mode bookkeeping change is contained.

## 3. Tests and Regression Control

- [ ] 3.1 Rewrite `__tests__/components/MapPage/MapLogicComponent.zoom-radius.test.tsx` so it asserts observable final behaviour — no `setView` carrying a radius-derived zoom before the startup fit, one startup fit for a valid circle, and a re-fit when the radius changes — replacing the assertion of the now-removed call at line 87.
- [ ] 3.2 Preserve the existing stability cases in the same file (no re-fit on small user-location drift, viewport stable on a later live-location tick) and review `__tests__/components/MapPage/MapLogicComponent.test.tsx` for the same coupling, updating only what genuinely changed; leave no `.skip`.
- [ ] 3.3 Add the startup tile-cardinality regression assertion on a surface that does **not** mock tiles — neither `e2e/map-page.spec.ts` (mocks `**/proxy/tiles/osm/**`) nor `e2e/pages-perf-budget.spec.ts` (excludes `/proxy/tiles/` from the MAP budget) can carry this evidence — asserting the number of distinct startup zoom levels and the per-viewport byte budget.
- [ ] 3.4 Prove the regression control actually catches the defect: temporarily restore the removed radius-zoom view locally, confirm the new assertions fail, then revert the temporary restoration.
- [ ] 3.5 Run the focused Jest suite for `__tests__/components/MapPage/**` and confirm zero failures and zero skipped tests.

## 4. Active-Platform Validation

- [ ] 4.1 Validate desktop web at 1350×940 with at least five cold runs: record the full per-level tile table, confirm one settled zoom level (at most one Leaflet-produced neighbour), zero tiles at the radius-derived level, median startup tile bytes ≤ 900 KiB, final zoom 9, and an unchanged settled centre.
- [ ] 4.2 Validate mobile web at 412×823 with the same run count and evidence: median startup tile bytes ≤ 650 KiB, final zoom 8, unchanged centre, and the radius circle visible in the first settled view.
- [ ] 4.3 Compare the settled-view screenshots on both viewports against the Task 1.5 baselines and confirm the map content does not shift; differences may only be tile decode timing.
- [ ] 4.4 Re-check the post-startup behaviours in the browser on both viewports: radius change re-fit, "show all", marker and cluster focus, search-this-area, route-mode startup, a zero-result startup and a denied-geolocation startup, with no new console errors.
- [ ] 4.5 Check `adb devices -l`, build and install the Android debug app locally over USB, open the map screen and run the paired mobile-web/Android comparison as a regression check of the general map configuration — startup view, radius circle and points render as before, with no blank map, missing base layer or new runtime error; if the device is unavailable, record the exact command, result and next safe step as `verify pending`.
- [ ] 4.6 Confirm the neighbouring tile-provider consumers are untouched — travel details map, quest full map and trip-plan route map still render with the same single tile source and no new requests or errors.

## 5. Quality Gate, Review and Handoff

- [ ] 5.1 Run `npm run guard:external-links` and `npm run check:fast` through the shared quality-gate wrapper; if a live gate is already held by another session, record `validation delegated`/`validation skipped` per the project rule instead of waiting, polling or starting a narrower bypass run.
- [ ] 5.2 Run the mandatory `metravel-code-reviewer` review-and-fix pass over the full task diff, fixing confirmed correctness, duplication, dead-code and reuse findings inside the task scope without touching unrelated dirty changes.
- [ ] 5.3 Re-run the focused tests, the tile-cardinality regression and the desktop/mobile-web checks after any reviewer fix, and confirm the level and byte budgets still hold.
- [ ] 5.4 Run `openspec validate --all` and update this checklist with the final per-level evidence table for both viewports.
- [ ] 5.5 Report the outcome as `local fix ready; production verification pending`; do not claim production resolution unless a separately authorised deploy is followed by the exact live production before/after trace, and note that backend task #1292 remains an independent byte-per-tile improvement.
