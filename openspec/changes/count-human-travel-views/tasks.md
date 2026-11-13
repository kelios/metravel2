## 1. Contract and Regression Controls

- [x] 1.1 Confirm the combined client/SSR plan against backend #3336, source paths and risk-based web/Android evidence selection; strictly validate before applying.
- [x] 1.2 Add network-boundary regression tests for bodyless authenticated/guest POST, invalid IDs, silent HTTP/network/timeout failure and no retry; retain default transport retry controls.
- [x] 1.3 Add real hook/owner lifecycle tests for first commit, auth restoration, unfocused routes, Suspense/SSR, rerenders, StrictMode, actual-shell responsive remounts, ID changes and blur/refocus.
- [x] 1.4 Add SSR transport/header/retry tests and strengthen actual loader assertions that all reads are marked and never emit a view POST; obtain a meaningful coordinated RED result.
- [x] 1.5 Cover the mandatory travel-link guard's API endpoint exclusion with canonical import/alias/relative-path positives and public/shadowed/stale-link negative controls, preserving its closed baseline.

## 2. Implementation

- [x] 2.1 Implement the narrow view API and opt-in no-retry policy through existing authenticated public and timeout transports, preserving other defaults.
- [x] 2.2 Implement the per-visible-visit hook in the committed shared article block without query/cache/counter or preload changes.
- [x] 2.3 Add the mandatory SSR marker to both renderer transports, preserving caller headers, original/retry semantics and input immutability.
- [x] 2.4 Classify the canonical API-base view endpoint as an API request without changing its URL or relaxing page-link rules and baselines.

## 3. Code-Level Verification and Review

- [x] 3.1 Obtain coordinated GREEN focused Jest evidence for client/owner/auth/retry and SSR/loader/socket consumers; run applicable lint, typecheck and scoped fast checks under the existing operation lock.
- [ ] 3.2 Complete independent full-diff review-and-fix, then the formal code-review gate; repeat affected code checks for confirmed fixes.
- [x] 3.3 Pass one complete explicit-task-scope `check:fast` under the normal quality lock after the mandatory guard repair; retain its full output and exact manifest.

## 4. Testing After Review and Publication

- [ ] 4.1 Verify the published frontend revision and production browser event: authenticated cookie/CSRF and guest without 403, exactly one POST 204 per visible opening, no client notification/unhandled error; capture network, console and visited-state screenshots.
- [ ] 4.2 On one Android emulator with the exact task code, show the article and verify one secure Token request with omitted cookies/no CSRF, no duplicate on rerender, and a new event after real blur/refocus. Reuse shared native code evidence for iOS unless an iOS-specific boundary changes.
- [ ] 4.3 On a controlled fresh public article with a non-author human reader, prove real `countUnicIpView` +1 then repeat +0 within 24 hours; prove renderer/service-only +0 and SSR marker evidence. Delete the owned fixture and verify absence without clearing production counters/caches.
- [ ] 4.4 Run required `verify:slider` and `verify:slider-perf` after review under operation policy, preserving all budgets and thresholds.

## 5. Completion

- [ ] 5.1 Record actual evidence and intentional omissions/retest triggers; validate this change strictly and run `openspec validate --all` before archive.
- [ ] 5.2 After all implementation and required acceptance evidence passes, synchronize the capability and archive the completed change.
