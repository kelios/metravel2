## Why

The public-pages performance gate cannot fail on the regressions it exists to
catch. It measures one layout only — every test in `e2e/pages-perf-budget.spec.ts`
sets a 1440×900 viewport and the Playwright config declares a single `chromium`
project — so a mobile-only regression is never observed. Its layout-shift budget
is also mostly decorative: only Home carries the per-page `0.1` introduced by
board task #1282; `/search`, `/map`, `/places` and `/quests` still fall back to
the blanket `PERF_CLS_MAX = 0.3`, three times the Google "good" threshold. The
concrete cost is recorded in #1282: the home page shipped a measured CLS of
0.2431, stayed inside 0.3 and the gate reported green. There is no first-screen
DOM budget anywhere in the repository, so hydration-time DOM growth is not gated
at all.

Board task #1287 already corrected the measurement side of the neighbouring
Lighthouse gate (`--preset=desktop` plus the `assertMeasuredProfile` report check
in `scripts/lighthouse-produrl.js`, a refreshed non-redirecting baseline URL) and
gave Home its real per-page budget. This change closes the remaining gap: the
Playwright pages gate must run both layouts, must prove which profile it actually
measured, and must stop treating a known debt as free headroom for new
regressions.

## What Changes

- Add a second, first-class mobile profile to the pages performance gate so that
  desktop web and mobile web are both measured, from one standard command.
- Replace the single blanket `PERF_CLS_MAX = 0.3` with an explicit per-page,
  per-profile threshold table: healthy routes are held at `<= 0.1`, and a route
  with known unresolved debt gets a temporary baseline pinned at its measured
  value with no headroom plus a mandatory reference to its own defect card.
- Introduce a first-screen DOM budget per page and profile, measured at the same
  ready checkpoint as the Core Web Vitals, and fail the gate when it is exceeded.
- Make each report state the profile it actually measured (viewport, device pixel
  ratio, pointer/touch capability, mobile user-agent token) and fail when the
  observed profile does not match the requested one — the Playwright equivalent
  of the Lighthouse `assertMeasuredProfile` check.
- Turn instability into a measured value instead of a lowered bar: repeat the
  Core Web Vitals pass and assert the median, and fail an unmeasurable run
  explicitly as invalid rather than letting it pass or time out silently.
- Add governance/unit coverage for profile selection, the threshold table and the
  DOM budget, plus a negative probe that must fail when CLS or first-screen DOM
  exceeds its budget.
- Carry the regression control requested by board task #1298: assert that the
  header logo and the header language switcher no longer appear as layout-shift
  sources on any measured page or profile.

### Goal and user-visible result

CI stops a new mobile-web, first-screen-DOM or layout-shift regression on the
public pages before it reaches production. For the end user this preserves the
visual stability of `/`, `/search`, `/map`, `/places` and `/quests` on phones as
well as desktops; there is no intended change to any rendered screen.

### Platform impact

- **Desktop web:** the existing desktop measurement stays, with per-page CLS and
  a new first-screen DOM budget.
- **Mobile web:** newly measured surface. This is the substance of the change.
- **Android:** not exercised by this web gate. The Android app is unaffected: no
  shared runtime code changes, and the Android/mobile-web validation pair is
  satisfied because no user-visible behavior changes on either.
- iOS is inactive and out of scope.

### Localization impact

`none`. No app-owned UI copy, translation key, locale persistence, formatting,
SEO locale or accessibility copy is added, changed or removed. Measurement runs
in the default RU locale, which is representative because the gate asserts
geometry and resource numbers, not text.

### Dependencies and fallback/mock policy

- Board task #1287 (kind `bug`, urgency `medium`, area `front`, sprint 2). #1282
  is `done` and is the source of the per-page Home budget. #1290 is related but
  does not block. #1298 is the consumer of the header layout-shift regression
  control described below.
- No backend, API or data-contract dependency. The gate consumes the same local
  production export (`dist/prod`) and the same deterministic route mocks it uses
  today; `../metravel-backend` stays read-only and no `area=back` task is needed.
- **Thresholds may not be raised, routes may not be dropped and no assertion may
  be disabled to make the gate pass.** A page that cannot meet `0.1` gets a
  pinned no-headroom baseline plus a linked defect card, never a relaxed budget.
- **A desktop run is never accepted as mobile evidence**, and the reverse also
  holds. A run whose observed profile does not match the requested one is a
  failure, not a warning.
- No mock may stand in for the primitive under test: the negative probe must
  drive the real measurement path in a browser, not only the comparison function.
- Measurement noise is handled with repeats/median and a recorded headroom, never
  by widening a budget.

### Existing behavior to preserve

- The current desktop budgets that already pass: per-page LCP, FCP, TBT, long
  tasks, JS/total transfer, first-party request count, and the "no media request
  without `w`" assertion from #1161.
- The Home per-page CLS budget of `0.1` from #1282, and the exclusion of map tile
  proxy requests from the `/map` network budget.
- The deterministic `/search` API stubbing that keeps the gate independent of
  live catalog data.
- Every run continues to go through the shared quality-gate lock, and the
  `verify:slider` / `verify:slider-perf` bilateral contract keeps working.

### Out of scope / Non-goals

- Fixing any page that turns out to exceed its new CLS or DOM budget. Findings
  are recorded as pinned baselines with linked defect cards; the corrective work
  belongs to those cards (for the header, #1298).
- Changing the Lighthouse gate, its budgets, `scripts/lighthouse-produrl.js`, or
  any production Lighthouse workflow — that half of #1287 is already done.
- Adding new routes to the gate, changing the travel-details perf spec's own
  budgets, or reworking the separate `@perf` CLS audit spec.
- Any Android device gate, native perf budget or CI workflow change.
- Deploying, publishing, or moving board state; this change is planning only and
  its implementation stays local.

### Open questions

None that materially change scope or acceptance. Two values are deliberately
left to be measured rather than guessed during implementation: the per-page
first-screen DOM ceilings and any pinned CLS baseline for a route that cannot
reach `0.1` today. Both are derived from a recorded production-build run with an
explicitly documented headroom, and the threshold table is the single place they
are written down.

## Capabilities

### New Capabilities

- `web-performance-budget-gate`: the observable contract of the public-pages
  performance gate — which profiles it measures, how it proves the measured
  profile, the per-page layout-shift and first-screen DOM budgets, how known
  debt is pinned, and how it must fail.

### Modified Capabilities

None. `openspec/specs/` currently holds no living capability for the performance
gate, so this change introduces the first one.

## Impact

- **Expected frontend scope:** `e2e/pages-perf-budget.spec.ts`,
  `e2e/helpers/perfBudget.ts`, a new threshold-table module and negative fixture
  under `e2e/`, the `projects` array in `playwright.config.ts`, the
  `e2e:perf-budget:pages` and `verify:slider-perf` entries in `package.json`, and
  new unit/governance tests under `__tests__/e2e-helpers/`. `scripts/` is a
  protected path and is not expected to change; see `design.md` for the
  no-`scripts/` route and the fallback that would require explicit permission.
- **Data/API:** unchanged. No request, response, field, pagination or error-code
  change; only the QA contract and the emitted perf reports change.
- **SEO:** unchanged. No route, canonical, redirect, sitemap, robots, metadata,
  structured-data or SSG output is touched; the gate only observes pages.
- **Accessibility:** no product change. Indirectly protected, because a stable
  first screen and a bounded DOM keep focus order and reading position stable.
- **Performance:** this is the performance contract itself. Target end state:
  every measured page/profile is asserted against a real CLS budget of `0.1`
  unless it carries a pinned baseline with a linked defect card, and against a
  measured first-screen DOM ceiling. Baselines are recorded from a production
  build run of the current `main`, on both profiles, before any threshold is
  written into the table.
- **Security:** none. No new input, URL construction, redirect, storage, token or
  network destination; test-only code that runs against a local build.
- **Analytics:** none. No event, parameter or goal is added, changed or removed.
