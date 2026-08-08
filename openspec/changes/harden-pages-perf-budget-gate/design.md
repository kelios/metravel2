## Context

See [proposal.md](proposal.md) for motivation; see
[specs/web-performance-budget-gate/spec.md](specs/web-performance-budget-gate/spec.md)
for the behavior contract. This section records only the current state that
shapes the approach.

**How the gate works today.** `e2e/pages-perf-budget.spec.ts` loops over five
route targets (`/`, `/search`, `/map`, `/places`, `/quests`) and creates two
tests per route inside a `test.describe.configure({ mode: 'serial' })` block: a
Core Web Vitals test and a network transfer test. Both open with
`page.setViewportSize({ width: 1440, height: 900 })`. Measurement is delegated to
`e2e/helpers/perfBudget.ts`: `injectPerfObservers` installs `PerformanceObserver`
collectors for `layout-shift`, `largest-contentful-paint` and `longtask` and
pre-accepts cookies; `beginPostReadyClsCollection` splits total from post-ready
CLS; `collectMetrics` waits for `networkidle` and reads the accumulated values;
`createNetworkTracker` counts bytes, first-party requests and media requests
missing a `w` parameter (via `e2e/helpers/mediaRequestWidth.ts`, the #1161 rule).

**Where the thresholds live.** Module constants at the top of
`e2e/pages-perf-budget.spec.ts` (`TBT_MAX_MS`, `CLS_MAX`, `FCP_MAX_MS`,
`MAX_LONG_TASKS`, `MAX_JS_TRANSFER_KB`, `MAX_TOTAL_TRANSFER_KB`, `MAX_REQUESTS`),
plus a `clsMax`/`lcpMaxMs` field on each entry of the `PAGES` array. Only the
`HOME` entry sets a real layout-shift budget (`0.1`, from #1282); the other four
routes inherit `CLS_MAX`, whose default is `0.3`. Every threshold is read through
`envNum(...)`, which currently accepts any override in either direction.

**What already exists elsewhere and is not repeated here.**
`scripts/lighthouse-produrl.js` holds `assertMeasuredProfile` (line 120), which
compares `lhr.configSettings.formFactor` with the requested profile and warns on
a redirected baseline URL. That is the Lighthouse half of #1287 and is complete.
`e2e/travel-details-perf-budget.spec.ts` has a separate mobile block that only
calls `setViewportSize({ width: 375, height: 667 })`; `e2e/cls-audit.spec.ts` is
an independent `@perf` audit. Neither is in scope.

**Runner constraints.** `playwright.config.ts` declares exactly one project,
`chromium` with `devices['Desktop Chrome']`; `fullyParallel: true`,
`workers: '50%'` locally, `retries: 1` locally / `2` in CI. The gate command
`e2e:perf-budget:pages` in `package.json` starts Playwright through
`node scripts/run-with-quality-gate-lock.js`, and `verify:slider-perf` runs this
spec together with the swipe and travel-details specs. `scripts/e2e-webserver.js`
serves the local export from `dist/`, and `scripts/e2e-suite-classification.js`
decides which spec files the default suite runs.

**Header nodes relevant to #1298.** `components/layout/LanguageSwitcher.tsx:53`
sets `testID="header-language-switcher"`. `components/layout/Logo.tsx` marks the
logo image and wordmark with `dataSet` hooks (`data-header-logo-image`,
`data-header-logo-wordmark`) through `utils/webProps.ts`; the same
`[data-testid="header-language-switcher"]` hook is already used by
`utils/criticalCSSBuilder.ts:87`. RN-Web atomic class names (`r-…`) are
build-generated and must not be used as selectors.

**Ownership boundary.** `scripts/` is a protected path. The implementation route
chosen below requires no change inside `scripts/`; the fallback that would is
called out explicitly in Decision 8.

## Goals / Non-Goals

**Goals:**

- One standard command produces desktop *and* mobile results, with the mobile
  result carrying genuine mobile device characteristics, not just a narrow box.
- Every numeric budget is resolved from one table keyed by route and profile,
  testable without starting a browser.
- Layout-shift and first-screen DOM regressions fail the gate; known debt is
  pinned at its measured value with a defect-card reference.
- The gate is proven to fail through its real measurement path, and an
  unmeasurable run is a classified failure rather than a timeout or a pass.
- The #1298 header regression control rides on data the gate already collects.

**Non-Goals:**

- Repairing any page that turns out to be over budget, including the header.
- Restructuring the travel-details perf spec, the CLS audit spec, or the
  Lighthouse gate.
- Introducing a CI workflow, a reporting service, or a persisted budget history.
- Adding routes to the gate or changing which requests are counted.

## Decisions

### 1. The mobile profile is a Playwright project, not a viewport resize

Add a second project to `playwright.config.ts`:

- `chromium` — `devices['Desktop Chrome']` (unchanged, the desktop profile).
- `chromium-mobile` — a Chromium mobile device descriptor (`devices['Pixel 5']`
  as the starting choice), which supplies `viewport` 393×851, `deviceScaleFactor`
  2.75, `isMobile: true`, `hasTouch: true` and a mobile user-agent.

The spec resolves its profile from the project name and stops setting a viewport
by hand.

Alternatives considered:

- **A second `describe` block with `setViewportSize({ width: 390, height: 844 })`**
  — the pattern already used by `e2e/travel-details-perf-budget.spec.ts`. It
  changes the layout box only: device pixel ratio stays `1`, `hasTouch`/`isMobile`
  stay false, and the user agent stays a desktop agent. The responsive image
  ladder (`?w=`), coarse-pointer CSS and touch-only layout branches would then be
  measured under desktop characteristics — the exact defect class #1287 was
  opened for, where a report looks correct while another profile was measured.
  `isMobile` is a browser-context option and cannot be set by `setViewportSize`
  at all.
- **A separate mobile spec file** — duplicates the route table and drifts, and
  `scripts/e2e-suite-classification.js` would gain another filename to track.

Consequence to accept: two projects also remove today's coupling where a failed
desktop test marks its mobile twin "did not run" through `mode: 'serial'`.
`serial` stays inside a project so the two tests of one route do not compete for
the shared local server.

### 2. One budget table keyed by route and profile

Introduce `e2e/helpers/pagesPerfBudgets.ts` exporting the profile list, the
budget table and pure functions:

- `resolveBudget(routeKey, profile)` — returns the full numeric budget set, and
  throws when a route/profile pair has no entry (no permissive default).
- `evaluatePageBudget(measurement, budget)` — returns a list of violations
  instead of asserting, so the same logic is reachable from Jest.

Each entry carries **all** per-profile numbers: `clsMax`, `firstScreenDomMax`,
`lcpMaxMs`, `fcpMaxMs`, `tbtMaxMs`, `maxLongTasks`, `maxJsKB`, `maxTotalKB`,
`maxRequests`, and an optional `debt: { measured, taskRef, recordedAt }`.

Two invariants are enforced by unit tests, not by convention:

- an entry without `debt` must have `clsMax <= 0.1`;
- an entry with `debt` must have `clsMax === debt.measured` (pinned, zero
  headroom) and a non-empty `taskRef`.

Environment overrides keep their current names but become a one-way clamp:
`effective = Math.min(tableValue, envValue)` for ceilings. A value that would
loosen a budget is ignored and reported in the run output. This encodes the
task's "thresholds must not be raised" rule in code rather than in review.

Alternatives considered:

- **Keep the fields inline on the `PAGES` array.** The table then cannot be
  unit-tested without booting Playwright, and "every route has an entry on every
  profile" has no owner.
- **A JSON file under `config/`.** Loses typing and the discriminated
  healthy/debt shape; a TS module under `e2e/helpers/` is already proven to be
  jest-importable by `__tests__/e2e-helpers/media-request-width.test.ts`.

Note that transfer and request budgets must become per-profile too: at
`deviceScaleFactor` 2.75 the mobile run selects different `?w=` rungs, so a
single shared byte ceiling would be either meaningless on one profile or
spuriously red on the other.

### 3. Each result proves the profile it measured

Collect from inside the page at the ready checkpoint: `innerWidth`,
`innerHeight`, `devicePixelRatio`, `navigator.maxTouchPoints`,
`matchMedia('(pointer: coarse)').matches`, and whether the user agent carries a
mobile token. Compare against the requested profile's expectations and fail on
mismatch; embed both `requestedProfile` and `observedProfile` in the printed
report and in the test annotation.

This is deliberately the same defence as `assertMeasuredProfile` in
`scripts/lighthouse-produrl.js`: there, an unknown CLI flag was silently ignored
and two "different" form factors produced identical LCP and byte counts for
years. A Playwright project can be misconfigured the same way — a device
descriptor that no longer sets `isMobile`, or a `--project` argument dropped from
the command — and the report would still look plausible. Asserting the observed
characteristics is what makes "a desktop run is not mobile evidence" mechanical.

### 4. The DOM budget counts the first screen, at the ready checkpoint

Definition: the number of rendered elements whose border box intersects the
initial viewport rectangle at the same readiness checkpoint used for Core Web
Vitals, before any scrolling, excluding zero-area and non-rendered boxes. The
total document element count is also printed, informationally.

Rationale for scoping to the first screen: on `/search` and `/quests` the total
node count is dominated by the virtualized list and by however many results the
dataset returns, so a whole-document ceiling would drift with content and would
have to be set so high that it stops catching anything. The first screen is what
hydration must lay out, and it is what the CLS and TBT budgets in the same test
are paid for — the three numbers then describe one moment.

Ceilings are recorded from a baseline run of current `main` on both profiles and
written into the table together with the recording date and build identity, plus
an explicit headroom (proposed `+15 %`, rounded up to the next multiple of 25).
No ceiling is estimated; the baseline task runs before the table is filled in.

### 5. Forbidden layout-shift sources — this gate can carry the #1298 control

**Assessment: yes.** `injectPerfObservers` already retains `entry.sources` and
builds a per-shift fingerprint, and the site header is present on every gated
route, so the control costs one extra assertion over data the gate already
collects. Re-implementing an observer inside a dedicated header spec would
duplicate exactly the primitive this change is hardening. The control therefore
becomes a requirement of this capability, with two conditions.

**Condition A — the node identity must be stable.** The current fingerprint uses
tag name, `data-testid`, `aria-label` and the first two class names. The language
switcher is already identifiable (`button[testid=header-language-switcher]`). The
logo is not: it renders as an RN-Web `div`/`img` whose only stable hooks are the
`data-header-logo-image` / `data-header-logo-wordmark` attributes; its `r-…`
atomic classes are build-generated and are explicitly not allowed as selectors.
So the fingerprint gains a small allow-list of stable `data-*` attributes, and
forbidden nodes are matched on `data-testid` / `data-header-*`.

**Condition B — the check must not be able to pass vacuously.** "Node X is absent
from the shift sources" passes trivially once X can no longer be recognised. Each
profile therefore runs a positive control: resolve every forbidden selector on the
page after ready and fail when it matches nothing. Absence of the node is an
unenforceable check, not a green one — the fail-open ban from `docs/RULES.md`
applied to the assertion itself.

**Ownership stays split.** #1287 delivers the control; the header fix stays in
#1298. If the control is red when it is first enabled, its entry is pinned as
accepted debt referencing #1298 in the same table shape as a CLS baseline, and no
header component is edited by this change.

### 6. The negative probe drives the real measurement path

Two layers, both required:

1. **Jest** over `evaluatePageBudget` and `resolveBudget` with synthetic
   over-budget measurements, missing entries, debt entries without a `taskRef`,
   and loosening env overrides. Deterministic and fast.
2. **Browser** — a small `@perf` negative spec that serves a controlled document
   and runs the identical chain (`injectPerfObservers` → ready → `collectMetrics`
   → first-screen DOM → `evaluatePageBudget`), asserting that the produced
   violation list contains both a layout-shift and a DOM violation, and that a
   node carrying a forbidden marker is reported as a shift source.

`docs/RULES.md` rejects a test that mocks the primitive under investigation as
contract evidence, so layer 1 alone is insufficient: the defect being fixed is in
*measurement*, and only layer 2 exercises the real `PerformanceObserver` path.

Serving the fixture without touching `scripts/`: the probe intercepts a
same-origin URL under the existing `baseURL` (for example
`/__perf-budget-negative`) with `page.route(...)` and fulfils it from an HTML
fixture stored beside the existing files in `e2e/fixtures/`. The navigation is a
real same-origin document load, so observers, readiness and the DOM count behave
as they do on a gated route.

Alternatives considered:

- **Put the fixture in `public/`** — it would be copied into the production
  export and ship a test artifact to users.
- **Teach `scripts/e2e-webserver.js` to serve fixtures** — a protected-path edit
  for something `page.route` already does.

### 7. Instability is answered with repeats and a classified failure

- `PERF_BUDGET_RUNS` (default `3`) applies to the Core Web Vitals pass only; the
  budget is evaluated against the median and the report lists every sample. The
  network transfer pass stays single-run: its numbers are byte counts from a
  fixed build, not timings.
- The readiness wait is bounded. `collectMetrics` currently begins with
  `waitForLoadState('networkidle')`, and the recorded local failure mode is a
  120 s test timeout inside it — on a clean baseline as well as on a change, with
  a different set of routes each run, because the local export proxies API calls
  to a live backend. On expiry the helper throws a named
  `invalid measurement (route, profile)` error instead of dying in the runner's
  timeout. It still fails — fail-open is forbidden — but it fails *classified*,
  which is what makes the flake actionable and keeps it from being mistaken for a
  budget regression.
- No budget is ever derived from a run that produced an invalid measurement.

### 8. Command surface, and the `scripts/` protected-path boundary

`package.json` only:

- `e2e:perf-budget:pages` runs the pages spec and the negative spec with
  `--project=chromium --project=chromium-mobile`;
- `verify:slider-perf` gains the same projects, so the bilateral slider/perf
  contract from `docs/RULES.md` keeps covering both layouts.

Both keep starting through `node scripts/run-with-quality-gate-lock.js` — the
wrapper is invoked, never edited. `package.json` and `playwright.config.ts` are
not protected paths.

**Protected-path note.** No change inside `scripts/` is expected or planned. Two
places could pull the implementation there, and both have a no-`scripts/` route:

- serving the negative fixture → use `page.route` (Decision 6) instead of
  `scripts/e2e-webserver.js`;
- suite membership for the new negative spec → keep the filename outside
  `LIVE_CONTRACT_SPECS` and `PRODUCTION_SMOKE_SPECS`, so the default
  `testIgnore` in `scripts/e2e-suite-classification.js` already includes it and
  no edit is needed.

If implementation nevertheless proves that a `scripts/` edit is unavoidable, that
is a stop: record the exact file, the reason the no-`scripts/` route fails, and
request explicit permission before editing. Do not treat it as incidental cleanup.

## Affected frontend paths

Expected edits:

- `e2e/pages-perf-budget.spec.ts` — profile-driven tests, table-resolved budgets,
  repeats/median, DOM and forbidden-source assertions.
- `e2e/helpers/perfBudget.ts` — observed-profile collection, stable `data-*` in
  the shift-source fingerprint, first-screen DOM collector, bounded readiness with
  a classified invalid-measurement error, sample collection.
- `e2e/helpers/pagesPerfBudgets.ts` — **new**: profiles, budget table, resolvers.
- `e2e/pages-perf-budget-negative.spec.ts` — **new**: browser negative probe.
- `e2e/fixtures/perf-budget-regression.html` — **new**: controlled over-budget
  document.
- `playwright.config.ts` — add the `chromium-mobile` project.
- `package.json` — `e2e:perf-budget:pages` and `verify:slider-perf` project lists.
- `__tests__/e2e-helpers/pages-perf-budgets.test.ts` — **new**: threshold table,
  debt/`taskRef` invariants, clamp behavior, route/profile coverage.
- `__tests__/e2e-helpers/perf-budget-profile.test.ts` — **new**: profile
  selection and the observed-vs-requested mismatch rule.

Read-only references (not edited): `scripts/run-with-quality-gate-lock.js`,
`scripts/lighthouse-produrl.js`, `scripts/e2e-webserver.js`,
`scripts/e2e-suite-classification.js`, `e2e/helpers/mediaRequestWidth.ts`,
`e2e/travel-details-perf-budget.spec.ts`, `e2e/cls-audit.spec.ts`,
`components/layout/Logo.tsx`, `components/layout/LanguageSwitcher.tsx`,
`utils/webProps.ts`, `utils/criticalCSSBuilder.ts`.

## Data and API contract

Unchanged. No endpoint, field, pagination, error code or auth behavior is
touched; the deterministic `/search` route stubs already in the spec are kept as
they are. The backend checkout stays read-only and no `area=back` task is
required. Only the QA contract and the emitted perf reports change.

**SEO:** not applicable — no route, canonical, redirect, sitemap, robots,
metadata, structured data or SSG output is modified; the gate only observes.
**Accessibility:** no product change. Indirectly protected: a bounded first
screen and a header that stops shifting keep focus order and reading position
stable. **Security:** not applicable — test-only code against a local build, no
new input, URL construction, redirect, storage, token or network destination.
**Analytics:** not applicable — no event, parameter or goal added, changed or
removed. **Bundle impact:** none; nothing here ships in the app bundle.

## Risks / Trade-offs

- **Run time roughly doubles (two profiles) and the CWV pass triples (3 samples)**
  → the network pass stays single-run, samples are taken within one context per
  test, and the two projects run in parallel under the existing
  `fullyParallel`/`workers` settings. If wall time becomes the binding
  constraint, reduce `PERF_BUDGET_RUNS` — never the route or profile coverage.
- **Mobile budgets are unknown until measured** → the baseline task runs first and
  the table is filled from recorded numbers with a documented headroom. Any route
  that cannot reach `0.1` is pinned as debt with a defect card, not rounded up.
- **The known local flake could be mistaken for a regression** → bounded readiness
  plus a classified `invalid measurement` failure, medians over samples, and an
  explicit rule that no budget is derived from a run containing an invalid
  measurement. The recorded flake affects `/`, `/search` and `/quests` on a clean
  baseline, so a first red run must be reproduced before any table value moves.
- **The forbidden-source check could quietly stop matching** → the per-profile
  positive control in Decision 5 fails when a forbidden selector resolves to
  nothing, so the check cannot pass by not finding anything.
- **Shared byte/request ceilings would be wrong on one profile** → all numeric
  budgets move into the per-profile table (Decision 2); no global constant
  survives as a cross-profile default.
- **Evidence capture can be invalidated by the build step** → `npm run e2e:*`
  rebuilds `dist/` and removes `dist/prod`, so a separately captured production
  build must be re-taken after a gate run rather than assumed intact. Ordering is
  fixed in the task list.
- **Two projects double artifacts on failure** → traces/videos remain
  `retain-on-failure`; artifacts stay in ignored output directories.
- **A device descriptor can go stale** → the observed-profile assertion is what
  actually guards the contract, so swapping the descriptor is a low-risk local
  change and does not alter any requirement.

## Migration Plan

1. Record the baseline on current `main`: build the production web export, run the
   gate on both profiles, and capture per route and profile the CLS (with shift
   sources), first-screen and total DOM counts, LCP/FCP/TBT, long tasks, JS/total
   bytes and first-party request counts.
2. Land the table module and its unit tests with the recorded values, marking any
   route that cannot reach `0.1` as pinned debt with its defect-card reference.
3. Land the mobile project, profile resolution and the observed-profile
   assertion; confirm the mobile run reports mobile characteristics and that a
   deliberately mismatched request fails.
4. Land the first-screen DOM collector and the forbidden-source control with its
   positive control.
5. Land the negative probe (unit plus browser) and prove both violation classes
   fail the gate.
6. Update the two `package.json` commands, then run the whole gate through the
   shared quality-gate lock and attach positive and negative evidence.
7. Run the mandatory code-review-and-fix pass and re-run the affected checks.

Rollback is local and cheap: revert the two `package.json` argument lists and the
`chromium-mobile` project entry to restore the previous single-profile gate; the
table module and negative probe can be reverted independently. No data, API,
deploy or production state is involved, so there is nothing to roll back outside
this repository.

## Validation Matrix

| Surface / layer | Scenario and evidence | Required result |
|---|---|---|
| Desktop web (`chromium`) | Full gate over the five routes against the local production build; report includes requested/observed profile, CLS with shift sources, first-screen and total DOM, transfer and request counts | All table budgets pass or fail only on entries pinned as debt; observed profile equals requested |
| Mobile web (`chromium-mobile`) | Same five routes under the mobile device profile in the same command | Mobile characteristics confirmed in the report (viewport, DPR > 1, touch/coarse pointer, mobile UA); all mobile table budgets evaluated |
| Negative probe (browser) | Controlled over-budget document measured through the real observer/collector chain | Run fails and reports both a layout-shift and a first-screen DOM violation, plus the forbidden shift source |
| Negative probe (unit) | Synthetic measurements, missing table entry, debt entry without `taskRef`, loosening env override | Violations reported; missing entry rejected; loosening override ignored |
| Governance / unit | Threshold-table and profile-selection tests | Every route has both profiles; every non-debt entry `<= 0.1`; every debt entry pinned with a defect reference; profile mismatch fails |
| Header control (#1298) | Forbidden-source assertion plus per-profile positive control on every gated route | Neither header node appears as a shift source, or the entry is pinned to #1298; the control fails when a forbidden selector matches nothing |
| Project checks | `npm run check:fast` (and the narrower relevant unit runs) through the shared quality-gate lock | Green, with no skipped tests introduced |
| Android | Not exercised: this is a web-only CI gate and no shared runtime code changes | No device evidence required; the mobile-web/Android pair is satisfied because no user-visible behavior changes |

Localization impact is `none`: no translation key, locale resource, formatting
helper or locale-sensitive UI is touched, so a single default-locale run is
sufficient and `npm run test:i18n` is not required by this change.

## Open Questions

- Which Chromium device descriptor to pin for the mobile profile (`Pixel 5` is
  the starting choice). Swapping it changes no requirement, because the
  observed-profile assertion — not the descriptor name — is what the contract
  depends on.
- Whether the `+15 %` first-screen DOM headroom holds for every route once the
  baseline is measured; a route with unusually noisy counts may need its own
  documented headroom, recorded in the table entry alongside the value.
