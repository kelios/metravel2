## 1. Baseline Measurement Before Any Threshold Is Written

- [ ] 1.1 Build the local production web export and confirm no other quality gate or build is active, then run the current `e2e/pages-perf-budget.spec.ts` unchanged on the desktop profile to capture the pre-change reference numbers.
- [ ] 1.2 Capture, per gated route (`/`, `/search`, `/map`, `/places`, `/quests`), the values the new table will hold: total and post-ready CLS with the full shift-source list, LCP/FCP/TBT, long-task count, JS/total transfer, first-party request count, first-screen element count and total document element count.
- [ ] 1.3 Repeat the same capture under a mobile device profile so both profiles have recorded numbers; mark any run that fails to reach its readiness checkpoint as an invalid measurement and re-take it instead of recording it.
- [ ] 1.4 Record which routes already exceed CLS `0.1`, which header nodes appear in the shift sources, and store the raw reports only in an ignored local directory.

## 2. Budget Table and Governance Tests

- [ ] 2.1 Add `e2e/helpers/pagesPerfBudgets.ts` with the profile list, the per-route/per-profile budget table (CLS, first-screen DOM, LCP, FCP, TBT, long tasks, JS/total KB, requests), and the optional `debt: { measured, taskRef, recordedAt }` shape.
- [ ] 2.2 Implement `resolveBudget(routeKey, profile)` so a missing route/profile entry throws as misconfigured, and `evaluatePageBudget(measurement, budget)` so it returns a violation list rather than asserting.
- [ ] 2.3 Make every environment override a one-way clamp (`Math.min(tableValue, envValue)` for ceilings) and report any ignored loosening override in the run output.
- [ ] 2.4 Fill the table from the task 1 baseline: every healthy entry at CLS `<= 0.1`, every first-screen DOM ceiling as the recorded count plus the documented headroom, and every route that cannot reach `0.1` pinned at its measured value with its defect-card `taskRef` and `recordedAt`.
- [ ] 2.5 Add `__tests__/e2e-helpers/pages-perf-budgets.test.ts` asserting: every gated route has both profiles; every non-debt entry has `clsMax <= 0.1`; every debt entry has `clsMax === debt.measured` and a non-empty `taskRef`; a loosening override is ignored while a tightening one applies; a missing route/profile pair throws.

## 3. Mobile Profile and Measured-Profile Proof

- [ ] 3.1 Add the `chromium-mobile` project to `playwright.config.ts` with a Chromium mobile device descriptor, keeping the existing `chromium` project as the desktop profile and leaving `storageState`, timeouts and reporters unchanged.
- [ ] 3.2 Rework `e2e/pages-perf-budget.spec.ts` to resolve its profile from the running project and to stop calling `page.setViewportSize` per test.
- [ ] 3.3 Add observed-profile collection to `e2e/helpers/perfBudget.ts` (layout viewport, device pixel ratio, touch/coarse-pointer availability, mobile user-agent token) and embed requested plus observed profile in the printed report and the test annotation.
- [ ] 3.4 Fail the run with an explicit profile-mismatch error when the observed profile does not match the requested one, and add `__tests__/e2e-helpers/perf-budget-profile.test.ts` covering profile selection and the mismatch rule.
- [ ] 3.5 Move the existing transfer, request, paint, blocking-time and long-task assertions onto the table-resolved per-profile budgets, keeping the `/map` tile-proxy exclusion, the deterministic `/search` stubs and the `#1161` media-request-without-width assertion intact.

## 4. First-Screen DOM Budget

- [ ] 4.1 Add a first-screen element collector to `e2e/helpers/perfBudget.ts` that counts, at the readiness checkpoint and before any scrolling, elements whose border box intersects the initial viewport, excluding zero-area and non-rendered boxes.
- [ ] 4.2 Report the first-screen count next to the total document element count and assert the first-screen count against the table ceiling for the measured route and profile.
- [ ] 4.3 Fail with a classified `invalid measurement` error naming route and profile when the count cannot be collected, and cover the ceiling comparison in the budget-table unit tests.

## 5. Forbidden Layout-Shift Sources (#1298 Regression Control)

- [ ] 5.1 Extend the shift-source fingerprint in `e2e/helpers/perfBudget.ts` to include a small allow-list of stable `data-*` hooks (`data-testid`, `data-header-logo-image`, `data-header-logo-wordmark`) so the header logo and language switcher are identifiable without relying on build-generated `r-…` class names.
- [ ] 5.2 Add the forbidden-source set (header logo, header language switcher) to the budget module and fail any route/profile whose observed shifts name one of them, reporting route, profile, node and shift value.
- [ ] 5.3 Add the per-profile positive control: resolve each forbidden selector on the page after readiness and fail when it matches nothing, so the check can never pass because the node stopped being recognisable.
- [ ] 5.4 If the control is red on the baseline, pin the affected entry as accepted debt referencing #1298 rather than editing any header component, and record that decision in the table entry.

## 6. Negative Probe

- [ ] 6.1 Add `e2e/fixtures/perf-budget-regression.html` producing a deliberate layout shift above `0.1` from a node carrying a forbidden marker, plus a first-screen element count above the ceiling used by the probe.
- [ ] 6.2 Add `e2e/pages-perf-budget-negative.spec.ts` that serves the fixture on a same-origin URL through `page.route`, drives the identical observer/readiness/collection/evaluation chain, and asserts the violation list contains both a layout-shift and a first-screen DOM violation plus the forbidden shift source.
- [ ] 6.3 Extend the unit tests with synthetic over-budget measurements, a missing table entry, a debt entry without `taskRef`, and a loosening override, and confirm each produces the expected rejection.
- [ ] 6.4 Verify the negative spec filename stays outside the live-contract and production-smoke lists so no change inside `scripts/` is needed for suite membership.

## 7. Command Surface

- [ ] 7.1 Update `e2e:perf-budget:pages` in `package.json` to run the pages spec and the negative spec with both projects in one invocation, still started through `node scripts/run-with-quality-gate-lock.js`.
- [ ] 7.2 Update `verify:slider-perf` in `package.json` so the bilateral slider/performance contract also covers both profiles.
- [ ] 7.3 Confirm no file inside `scripts/` was modified; if a `scripts/` edit turns out to be unavoidable, stop, record the exact file and why the no-`scripts/` route fails, and request explicit permission before continuing.

## 8. Positive and Negative Evidence

- [ ] 8.1 Check for an active quality gate or build, then run the full gate command against a fresh local production build and capture the desktop-profile evidence: per-route budgets, requested versus observed profile, CLS with shift sources, first-screen DOM and transfer/request numbers.
- [ ] 8.2 Capture the same evidence for the mobile profile from the same run, confirming the report shows mobile viewport, device pixel ratio above one, touch/coarse pointer and a mobile user-agent token.
- [ ] 8.3 Run the negative probe and record that it fails on both the layout-shift and the first-screen DOM violation, and that a deliberately mismatched profile request fails with the profile-mismatch error.
- [ ] 8.4 Run the new and affected unit/governance tests plus `npm run check:fast` through the shared quality-gate lock, fixing every failure inside the task-owned scope and introducing no skipped tests.
- [ ] 8.5 Re-take any production-build evidence that a later gate run invalidated, since the e2e commands rebuild `dist/` and remove `dist/prod`; keep all raw reports in ignored local directories only.

## 9. Review and Handoff

- [ ] 9.1 Run the mandatory `metravel-code-reviewer` review-and-fix pass over the complete task diff, correcting confirmed correctness, duplication, reuse and unnecessary-complexity findings without touching unrelated user changes.
- [ ] 9.2 Re-run the full gate on both profiles, the negative probe and the affected unit/governance tests after reviewer fixes, and update this checklist with the final evidence.
- [ ] 9.3 Run `openspec validate --all` and confirm the change artifacts stay consistent with the implemented behavior.
- [ ] 9.4 Report the outcome as a local QA-contract change with attached positive and negative evidence, listing any route pinned as accepted debt and the defect card that owns it; do not claim a production result, because this gate does not deploy anything.
