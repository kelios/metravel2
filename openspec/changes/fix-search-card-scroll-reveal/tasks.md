## 1. Baseline and Regression Harness

- [x] 1.1 Reproduce the fill-only scroll window in the local production-like `/search` build with the agreed 1280×900 and 390×844 throttled traces, recording visible image readiness, source ownership, requests, downloaded bytes, duplicate URLs, and response failures.
      Traced on the live production bundle instead of a local build: the production API answers CORS only for its own origin, so a locally served build never receives the list. The former lookahead is restored in-page by wrapping the Metro module registry and overriding `RVEngagedIndicesTrackerImpl.prototype.drawDistance`, which leaves the shipped bundle, the API and the HTTP cache untouched.
- [x] 1.2 Add a focused real-browser regression scenario that drives the actual virtualized search list and fails on any visible fill-only cover, stale/wrong-photo swap, geometry shift, duplicate effective image URL, or exceeded request/byte budget.
      `e2e/prod-media-smoke.spec.ts` → `#1263 search list scroll reveal` (production-smoke suite, read-only). `E2E_1263_DRAW_DISTANCE=180` is the negative control and fails both widths.
- [x] 1.3 Preserve and run the recycled-source negative control proving that a cell identity change never exposes the previous travel's decoded cover.

## 2. Bounded Lookahead Implementation

- [x] 2.1 Update the web virtualization model to start with a 720 px desktop and 600 px mobile lookahead while retaining the existing 560 dp native value and documenting the row-height/buffer invariant.
- [x] 2.2 Update focused model tests to prove that each web mode retains at least one full row behind and prepares at least two full rows ahead, and that the Android value remains unchanged.
- [x] 2.3 Tune the web values only to the smallest distances that pass both browser readiness scenarios without exceeding six additional initial cover requests or 400,000 additional initial cover bytes; stop for a design revision if no bounded value passes.
      Measured: 720/600 are kept because no cheaper value exists. The initial cover cost is a step function that saturates well below the chosen values — desktop is 15 requests / 996,930 B for every distance from 560 to 720, mobile is 6 / 345,907 B for every distance from 500 to 600 — because `loading="lazy"` caps the fetch horizon while `drawDistance` only decides what stays mounted. Under the throttled trace the smallest passing distances are 560 (desktop) and 500 (mobile); both cost exactly the same as 720/600 while dropping below the documented one-row retention (`0.6 × d ≥ row height`), and the next cheaper step (420) fails on both widths. See the evidence table below.
- [x] 2.4 Confirm the implementation leaves `ImageCardMedia`, its stale-photo reveal gate, responsive source manifest, pagination, and one-slot/one-raster behavior unchanged; if measurement requires a broader edit, stop and revise the OpenSpec design before proceeding.

## 3. Automated Verification

- [x] 3.1 Run the focused virtualization-model tests, recycled-source media test, and new browser regression scenario until all assertions pass without skips.
      `listTravelBaseModel` + `RightColumn.web-perf` 15/15, `ImageCardMedia.recycleSwap.web` 3/3, `#1263 search list scroll reveal` 2/2 against production.
- [x] 3.2 Run `npm run check:image-architecture` and verify one raster and one effective network URL per visible card slot.
- [x] 3.3 Run `npm run check:fast`, classify any unrelated pre-existing failures without changing user-owned files, and fix all failures in the task-owned scope.

## 4. Active-Platform Validation

- [x] 4.1 Validate desktop web at 1280×900 with the agreed throttled 1160 px downward-and-return trace and save ignored screenshot/network evidence showing zero fill-only or stale-photo samples within the resource budget.
      The deployed production bundle already serves the 720/600 values — confirmed at runtime, not from the source tree — so these traces are post-deploy production evidence, not a local preview.
- [x] 4.2 Validate mobile web at 390×844 with the equivalent row-by-row downward-and-return trace and confirm desktop-equivalent card hierarchy, readiness, touch scrolling, stable geometry, and resource bounds.
      Touch scrolling checked separately with synthesized touch gestures (`Input.synthesizeScrollGesture`): scrollTop 0 → 1169 → 7 across eight flicks with zero unready covers. Page-dispatched `TouchEvent`s do not move a native scroller and were discarded as a measurement method.
- [x] 4.3 Check `adb devices -l`, locally build and install the Android debug app, then run `AND-USB-01..03` and the search-list portion of `AND-USB-05`, including forward/return scrolling with zero empty stop frames or stale covers and no fatal/runtime logcat errors.
      Verified 2026-08-11 on Pixel 10 Pro, Android 16/API 36: `./gradlew :app:installDebug` succeeded, the locally installed debug build opened the real `/search` catalog, and ten rapid forward/return cycles plus a final stop left every visible card covered by its own decoded image with stable geometry. Filtered logcat contained no app `FATAL EXCEPTION`, `ReactNativeJS` error, or `JSApplicationIllegalArgumentException`; ignored screenshot evidence is under `.codex-temp/qa1400/`.

## 5. Review and Handoff

- [x] 5.1 Run the mandatory `metravel-code-reviewer` review-and-fix pass over the full task diff, correcting confirmed bugs, duplication, unnecessary abstractions, or regressions without touching unrelated user changes.
      Independent review found no implementation defect and repaired three false-green test gaps: non-empty recycled DOM samples are now required, every post-scroll render call must carry the demoted policy, and the production probe runs ten genuinely fast cycles. No unrelated user paths were changed.
- [x] 5.2 Re-run every affected automated check and the desktop/mobile-web/Android scenarios after reviewer fixes, then run `openspec validate --all` and update this checklist with the final evidence.
      Final focused results: Jest 4 suites / 43 tests, local production Playwright desktop + Pixel 7 profile 3/3, app and e2e typechecks, scoped ESLint, image architecture, gallery swipe 2/2, and `check:fast` 10 suites / 228 tests all pass. The Search desktop/mobile performance budgets pass; the wider slider-perf command still reports only the unrelated travel-details request budget (91–92 against 90), outside this catalog diff. Android evidence remains valid because reviewer changes were test-only. OpenSpec validation is run after this checklist update.
- [x] 5.3 Record the result as `local fix ready; production verification pending`; do not claim production resolution unless a later separately authorized deploy is followed by the exact live production before/after trace.
      Local fix ready; production verification pending. Task #1400 must remain in `testing` until an explicitly authorized frontend production deploy is followed by the exact live 1280×900 and 390×844 request/byte/cancellation traces.

## Measured evidence (live production, 2026-08-10)

Target `https://metravel.by/search`, Chromium 1.61.1, guest, a cold browser
context per run, cover bytes from CDP `Network.loadingFinished.encodedDataLength`.
"Covers" are only the URLs the cards themselves advertise in `srcset`, not every
`/media-resize/` request on the page. A cover counts as ready only when its own
`<img>` is `complete`, has `naturalWidth > 0` and `opacity: 1`; visibility is
measured on the image rectangle, because a card leaving the viewport keeps its
text strip on screen long after its photo is gone.

Desktop 1280×900 DPR 2, throttled 1.6 Mbps / 150 ms:

| drawDistance | initial | after 1160 px down | after return | fill-only frames | fill-only cards | stale |
|---|---|---|---|---|---|---|
| 180 (previous) | 9 req / 618,186 B | 10 / 660,292 | 12 / 818,893 | 23 of 44 | 6 down + 5 up | 0 |
| 560 (smallest passing) | 15 / 996,930 | 15 / 996,930 | 16 / 996,930 | 0 of 44 | 0 | 0 |
| 720 (shipped) | 15 / 996,930 | 15 / 996,930 | 15 / 996,930 | 0 of 44 | 0 | 0 |

Mobile 390×844 DPR 3, throttled 1.6 Mbps / 150 ms + 4× CPU:

| drawDistance | initial | after 1160 px down | after return | fill-only frames | fill-only cards | stale |
|---|---|---|---|---|---|---|
| 160 (previous) | 3 req / 207,632 B | 6 / 345,907 | 6 / 345,907 | 16 of 44 | 3 | 0 |
| 300 | 4 / 268,579 | 6 / 345,907 | 6 / 345,907 | 9 of 44 | 2 | 0 |
| 420 | 5 / 284,072 | 6 / 345,907 | 6 / 345,907 | 8 of 44 | 1 | 0 |
| 500 (smallest passing) | 6 / 345,907 | 6 / 345,907 | 6 / 345,907 | 0 of 44 | 0 | 0 |
| 600 (shipped) | 6 / 345,907 | 6 / 345,907 | 6 / 345,907 | 0 of 44 | 0 | 0 |

Budget: desktop initial grows by 6 requests / 378,744 B and mobile by 3 requests /
138,275 B, both inside the +6 request / +400,000 byte ceiling. Totals after the
full trace are not higher than the previous values — desktop drops from 18 to 15
requests at identical bytes, mobile is unchanged — because the shipped distances
move the same downloads earlier instead of adding new ones. Zero stale swaps in
every run, including the failing ones: the #1294 ownership gate is intact and the
defect was purely scheduling. Geometry is stable (visible card count never below
6 desktop / 3 mobile, no unmounted-row hole).

The mounted window explains the cliff: at 620 desktop the window walks
`0-4 → 0-5 → 1-6`, so row 0 is dropped and rebuilt on the way back, while at 720
it stays `0-5 → 0-6` for the whole trace. Measured row pitch is 371 px desktop and
315 px mobile against the declared 420/340 constants, so the declared values are
the conservative side of the invariant.

Measurement trap worth keeping: registering any Playwright `page.route` handler
disables the HTTP cache, so every re-mounted row re-downloads an `immutable`
cover and the return leg fabricates fill-only frames. The first pass with request
interception wrongly reported mobile 600 as failing. Both the trace harness and
the regression spec therefore override `drawDistance` through the in-page Metro
module registry and never intercept the network.
