## Context

See [proposal.md](proposal.md) for the production symptom and recurrence history.
The search result list uses FlashList with a shared configuration model. On web,
its current `drawDistance` is 180 px on desktop and 160 px on mobile, while the
declared intrinsic row sizes are 420 px and 340 px. FlashList v2 distributes its
two-sided buffer as approximately `0.6 × drawDistance` behind and
`1.4 × drawDistance` ahead of the scroll direction, so the current web buffer
does not retain one complete row behind or prepare two complete rows ahead.

Android already uses a 560 dp distance from board task #1263. Separately,
`ImageCardMedia` records the last painted source identity and hides a recycled
web `<img>` until its next source has decoded. That #1294 correctness gate is
required to prevent a briefly visible photo belonging to another travel. The
media architecture also permits only one raster and one effective network URL
per visual slot; the solid dominant color is the only loading/error layer.

Expected frontend paths are:

- `components/listTravel/rightColumnModel.ts`
- `__tests__/components/listTravel/listTravelBaseModel.test.ts`
- a focused real-browser regression scenario for `/search`

`components/listTravel/RightColumn.tsx` and `components/ui/ImageCardMedia.tsx`
remain outside the expected edit set unless measurements prove the model-only
change cannot meet both readiness and resource constraints.

The existing `/api/travels/` response and
`media.cover.{src,srcset,sizes,dominant_color}` contract remain unchanged. The
backend checkout is read-only and no backend work is planned.

## Goals / Non-Goals

**Goals:**

- Keep at least one complete row behind the viewport and prepare at least two
  complete rows ahead on web, using the smallest measured bounded lookahead.
- Preserve stale-photo prevention, one-raster ownership, stable layout, and the
  established Android configuration.
- Lock the observable lifecycle with a browser-level scroll regression and a
  request/byte budget, rather than relying only on model constants.

**Non-Goals:**

- Reworking image reveal state, replacing the media primitive, or adding another
  preview source.
- Changing pagination, row geometry, responsive source selection, cache URLs,
  image quality, or server processing.
- Using a timer to conceal the symptom or disabling virtualization.

## Decisions

### 1. Increase only the bounded web list lookahead

The first implementation will change the shared virtualization model to start
at 720 px for desktop web and 600 px for mobile web, while retaining 560 dp for
native. The values come from the existing row contract and FlashList buffer
split:

- desktop retention floor: `420 / 0.6 = 700`; two-row forward floor:
  `(2 × 420) / 1.4 = 600`
- mobile retention floor: `340 / 0.6 ≈ 567`; two-row forward floor:
  `(2 × 340) / 1.4 ≈ 486`

The initial rounded values satisfy both bounds without an unbounded window. The
browser trace will then tune them down only if the smaller value still passes
all readiness assertions; it will tune them up only while remaining within the
spec's maximum six additional initial requests and 400,000 additional initial
cover bytes. If no value satisfies both constraints, implementation stops for a
design revision instead of expanding scope silently.

Alternatives considered:

- Keeping 160/180 and changing only reveal timing cannot make the correct source
  decode before entry into the viewport.
- Removing virtualization or mounting every page would make the network and
  memory cost grow with result count.
- Copying Android's 560 value to both web modes fails the 420 px desktop
  retention bound (`0.6 × 560 = 336`).

### 2. Preserve the recycled-source reveal gate unchanged

The painted-identity check remains the owner of stale-photo correctness. A
recycled node may show the neutral color while its next source is genuinely not
ready, but the larger list window should make that state occur offscreen. This
separates source correctness from scheduling and avoids weakening #1294.

Alternatives considered:

- Showing the previous decoded pixels until the next decode recreates the wrong
  travel photo defect.
- Forcing an immediate opacity change can reveal an empty or partially decoded
  image and does not solve readiness.

### 3. Keep one raster; do not introduce an LQIP or duplicate source

The current responsive cover remains the only raster for each card. The dominant
color stays a paint-only fallback and does not become an accepted successful
state in the scroll test.

Alternatives considered:

- A blurred thumbnail or duplicated CSS background would violate the image
  architecture and add bytes while preserving a visible replacement.
- Cache-busting or parallel URL variants would weaken deduplication and cannot
  guarantee decode timing.

### 4. Test the lifecycle at both model and real-list layers

Focused model tests will lock the row-derived retention and preparation
invariants and the unchanged native value. A browser scenario will exercise the
actual virtualized result list, inspect visible image ownership/readiness at
scroll checkpoints, and record requests and transferred image bytes. Network
delay may be deterministic in local automation, but the scenario must use the
real image node and recycling lifecycle rather than a mocked media component.

The existing recycled-source unit test remains as the negative control: changing
travel identity cannot expose the previous cover. Production-like desktop and
mobile web validation repeats the same trace. Android uses a locally built app
installed on the connected USB device and repeats the paired search-scroll
scenario to prove that the shared model change did not reduce native behavior.

### 5. Treat performance evidence as a page-level constraint

Validation records initial and post-scroll cover request count, downloaded bytes,
duplicate effective URLs, 4xx/5xx responses, and visible readiness. It compares
against the proposal's production baseline and the spec budgets. A passing image
opacity assertion alone is insufficient if it achieves readiness by downloading
too much or duplicating sources.

No analytics events are added or changed. SEO output, alt text, focus behavior,
and card semantics are preserved. No new input, redirect, storage, token, or URL
construction surface is introduced.

## Risks / Trade-offs

- **Higher web lookahead increases initial downloads and retained DOM nodes** →
  enforce the request/byte ceilings, tune to the smallest passing value, and
  inspect the full page trace rather than a single card.
- **Variable network or decode time can make a fixed distance flaky** → use an
  agreed throttled trace in automation and confirm with production-like runs at
  both desktop and mobile widths.
- **Row sizes can drift without updating the lookahead** → derive test
  expectations from the exported intrinsic row-size contract and fail when the
  configured distance no longer retains one row and prepares two.
- **A broad media change could reintroduce stale pixels** → keep
  `ImageCardMedia` out of the normal implementation set and retain its negative
  recycling test.
- **Shared code can regress Android despite a web-only branch** → assert the
  native value in unit tests, locally build/install Android, and repeat the
  search-scroll device scenario.

## Validation Matrix

| Surface | Scenario and evidence | Required result |
|---|---|---|
| Desktop web | 1280×900, throttled 1160 px scroll trace; image-node samples plus network inventory | Zero visible fill-only covers, zero stale swaps, resource budget passes |
| Mobile web | 390×844, equivalent row-by-row trace; image-node samples plus network inventory | Same card ownership/readiness semantics and bounded loading |
| Android | Local debug build installed on connected USB device; paired search scroll and return | No empty stop frames or stale cover; native lookahead unchanged |
| Local automated checks | Focused model/recycling tests, browser regression, image architecture guard, fast project checks | All relevant checks pass without skipped assertions |

Localization impact is `none`: RU/BE/UK/PL/EN resources and locale-sensitive
behavior are untouched, so a single representative locale is sufficient for
this visual lifecycle validation.

## Migration Plan

1. Capture the same local pre-change browser trace and confirm that it reproduces
   the production fill-only window.
2. Update the bounded web distances and focused invariant tests while leaving
   native and media ownership logic unchanged.
3. Run the automated checks and the desktop/mobile/Android validation matrix.
4. Complete the mandatory review-and-fix pass and rerun affected checks.
5. If a production deploy is later authorized, deploy through the project-owned
   frontend workflow and repeat the exact production trace before claiming the
   issue fixed in production.

Rollback is a single frontend configuration revert to 160/180, followed by the
same checks. The media gate, API contract, data, and backend require no rollback.
Without an authorized deploy, the handoff remains `local fix ready; production
verification pending`.
