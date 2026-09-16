## 1. API contract

- [x] 1.1 Add `api/routeOrderOptimization.ts` with the request/response types of contract v1, `POST /routing/optimize/` through `apiClient`, and permutation validation.
- [x] 1.2 Add adapter tests: exact payload, accepted permutation, rejected partial/duplicate/moved-endpoint orders, error propagation.

## 2. Suggestion state and reorder arithmetic

- [x] 2.1 Add the pure helpers in `components/trips/planning/routePointOrder.ts` (availability, request points, snapshot key, identity check, `moveItem` decomposition, preview rows, error kind mapping) with unit tests.
- [x] 2.2 Add `useRouteOrderSuggestion`; `RoutePointsSection` renders the block and `RouteBuilder` passes the trip transport, bike type and its reorder entry point `handleReorder`.

## 3. UI and localization

- [x] 3.1 Add `RouteOrderSuggestion` (button, hints, error, preview, Apply/Dismiss, applied/unchanged notices, day-split warning) and its styles.
- [x] 3.2 Add `tripsStatic:plan.orderSuggestion.*` copy for RU/BE/UK/PL/EN.

## 4. Validation

- [x] 4.1 Component tests: hidden for <3 points, non-owner and unroutable transport, three-point hint, request payload, preview without draft change, apply/dismiss, editor follows its point, identity notice, backend error, missing coordinates, stale answer dropped, day-split warning.
- [x] 4.2 `npm run test:i18n`, targeted jest suites, `npm run check:fast`, `tsc --noEmit`, UI guards.
- [ ] 4.3 In `testing`: desktop web and mobile web evidence against the local backend with #1951 (`origin/master` 7c7b946); the live ORS answer depends on the local `OPENROUTESERVICE_API_KEY`.
