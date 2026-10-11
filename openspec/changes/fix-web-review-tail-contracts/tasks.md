## 1. Scope and coordination after separate apply approval

- [ ] 1.1 Coordinate live ownership of #2367 before touching sidebar paths; verify main/status and record each a–l disposition and task-owned paths in #2382 through the required Problem Memory/board workflow.
- [ ] 1.2 Record a point-noun choice, neutral map SEO, loaded-scope chip wording, f backend facet dependency and k current UX decision; describe exact facet query semantics for the backend owner without implementing backend code.
- [ ] 1.3 Verify h's existing `useFullBookExport` owner guard from source/unit evidence; mark already-correct paths as verified rather than adding redundant logic.

## 2. Separate behavior-preserving map API refactor stage

- [ ] 2.1 Capture existing map facade exports and API transport/serialization/normalization test baseline; use the scoped refactor-surgeon workflow for j.
- [ ] 2.2 Extract transport, point adapters, radius/near-route queries, cluster and place-source pagination into focused `api/map/` leaves while retaining `api/map.ts` re-exports and public types.
- [ ] 2.3 Confirm no import cycles, payload/endpoint/retry/abort/normalization changes; run affected map API tests and independent code-only review of this stage before behavioral changes.

## 3. Shared frontend contract repairs

- [ ] 3.1 Implement shared map category resolution with ID/name/partial coverage; preserve pending URL tokens through dictionary loading, and test numeric 43, mixed OR, unresolved/error, radius, cluster, route and offline.
- [ ] 3.2 Integrate complete-coverage-only server narrowing and honest local loaded-scope totals; remove obsolete categories branches only after consumer audit and preserve travel-list helper contracts.
- [ ] 3.3 Localize point-count nouns, loaded-scope facet labels and neutral SEO across RU/BE/UK/PL/EN using shared map summary consumers; test plural and title consistency.
- [ ] 3.4 Use one default comparison for global/group clear; reset groups coherently to their own defaults, preserving selected badges and unrelated groups; extend ModernFilters tests.
- [ ] 3.5 Add a shared first-frame optional location slot to personal-trip filters with nonempty/empty/loading DOM tests; update trips documentation without a fragile LOC claim.
- [ ] 3.6 Fix h only where a concrete unguarded guest capability caller is found; test known-guest zero auth-only/session requests and authenticated path, and align documentation with actual Save PDF wording.
- [ ] 3.7 Pass the shared route coordinate/origin predicate through deferred placeholders to nearby skeletons, preserving native branches; extend coordinate/no-coordinate geometry DOM tests.
- [ ] 3.8 Use one fixed-height web sidebar Popular rail model for deferred/loading/loaded states with all up-to-eight results accessible; test 390/1280 loading, success, empty/error and downstream bounds.

## 4. Code review

- [ ] 4.1 Run scoped lint/tsc, map/filter/clear/PDF/trips/sidebar Jest suites, `npm run test:i18n` for changed strings and `npm run audit:prompts` for docs.
- [ ] 4.2 Complete independent review-auditor review-and-fix on the full task diff then code-review-gate; rerun relevant code-level checks after fixes.

## 5. Testing after reviewed SHA

- [ ] 5.1 After the standard pipeline makes the reviewed SHA available, verify production source and `/map?categories=43`, mixed categories and Krakow 50km labels/SEO/count scope with actual data at 390/1280; preserve console/network/screenshots.
- [ ] 5.2 Verify `/roulette` default group/global clears are absent, changed selections reset correctly, and `/trips/my` delayed region options preserve first-frame geometry using actual authorized access.
- [ ] 5.3 Verify guest PDF has zero auth-only capability/session requests, authenticated export still works and documentation wording matches the visible action.
- [ ] 5.4 Measure sidebar placeholder→loaded geometry with/without coordinates at 390/1280, target ±1px equivalent bounds and no downstream jump; navigate every Popular rail card and preserve current item k UX.
- [ ] 5.5 Verify all five locale point/scope/SEO labels and light/dark healthy controls; run `yarn verify:slider` and `yarn verify:slider-perf` only under the appropriate testing operation gate for changed detail geometry.
- [ ] 5.6 Record real a–l outcomes individually; do not label backend-dependent facet precision complete from frontend mocks. Run `openspec validate fix-web-review-tail-contracts --type change --strict`, and `openspec validate --all` before archive after actual acceptance evidence.
