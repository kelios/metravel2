## 1. Baseline and Regression Harness

- [ ] 1.1 Reproduce the fill-only scroll window in the local production-like `/search` build with the agreed 1280×900 and 390×844 throttled traces, recording visible image readiness, source ownership, requests, downloaded bytes, duplicate URLs, and response failures.
- [ ] 1.2 Add a focused real-browser regression scenario that drives the actual virtualized search list and fails on any visible fill-only cover, stale/wrong-photo swap, geometry shift, duplicate effective image URL, or exceeded request/byte budget.
- [x] 1.3 Preserve and run the recycled-source negative control proving that a cell identity change never exposes the previous travel's decoded cover.

## 2. Bounded Lookahead Implementation

- [x] 2.1 Update the web virtualization model to start with a 720 px desktop and 600 px mobile lookahead while retaining the existing 560 dp native value and documenting the row-height/buffer invariant.
- [x] 2.2 Update focused model tests to prove that each web mode retains at least one full row behind and prepares at least two full rows ahead, and that the Android value remains unchanged.
- [ ] 2.3 Tune the web values only to the smallest distances that pass both browser readiness scenarios without exceeding six additional initial cover requests or 400,000 additional initial cover bytes; stop for a design revision if no bounded value passes.
- [x] 2.4 Confirm the implementation leaves `ImageCardMedia`, its stale-photo reveal gate, responsive source manifest, pagination, and one-slot/one-raster behavior unchanged; if measurement requires a broader edit, stop and revise the OpenSpec design before proceeding.

## 3. Automated Verification

- [ ] 3.1 Run the focused virtualization-model tests, recycled-source media test, and new browser regression scenario until all assertions pass without skips.
- [x] 3.2 Run `npm run check:image-architecture` and verify one raster and one effective network URL per visible card slot.
- [x] 3.3 Run `npm run check:fast`, classify any unrelated pre-existing failures without changing user-owned files, and fix all failures in the task-owned scope.

## 4. Active-Platform Validation

- [ ] 4.1 Validate desktop web at 1280×900 with the agreed throttled 1160 px downward-and-return trace and save ignored screenshot/network evidence showing zero fill-only or stale-photo samples within the resource budget.
- [ ] 4.2 Validate mobile web at 390×844 with the equivalent row-by-row downward-and-return trace and confirm desktop-equivalent card hierarchy, readiness, touch scrolling, stable geometry, and resource bounds.
- [ ] 4.3 Check `adb devices -l`, locally build and install the Android debug app, then run `AND-USB-01..03` and the search-list portion of `AND-USB-05`, including forward/return scrolling with zero empty stop frames or stale covers and no fatal/runtime logcat errors.

## 5. Review and Handoff

- [ ] 5.1 Run the mandatory `metravel-code-reviewer` review-and-fix pass over the full task diff, correcting confirmed bugs, duplication, unnecessary abstractions, or regressions without touching unrelated user changes.
- [ ] 5.2 Re-run every affected automated check and the desktop/mobile-web/Android scenarios after reviewer fixes, then run `openspec validate --all` and update this checklist with the final evidence.
- [ ] 5.3 Record the result as `local fix ready; production verification pending`; do not claim production resolution unless a later separately authorized deploy is followed by the exact live production before/after trace.
