## 1. API contract

- [x] 1.1 Add `api/routeOrderOptimization.ts` with the request/response types of contract v1, `POST /routing/optimize/` through `apiClient`, and permutation validation.
- [x] 1.2 Add adapter tests: exact payload, accepted permutation, rejected partial/duplicate/moved-endpoint orders, error propagation.

## 2. Suggestion state and reorder arithmetic

- [x] 2.1 Add the pure helpers (request points, snapshot key, identity check, `applyRouteOrder` over `moveItem`, index remap, preview rows, error key mapping) with unit tests.
- [x] 2.2 Add `useRouteOrderSuggestion` and mount it in `RoutePointsSection`; `RouteBuilder` passes `trip` and draft setters.

## 3. UI and localization

- [x] 3.1 Add `RouteOrderSuggestion` (button, hints, error, preview, Apply/Dismiss) and its styles.
- [x] 3.2 Add `tripsStatic:plan.orderSuggestion.*` copy for RU/BE/UK/PL/EN.

## 4. Validation

- [x] 4.1 Component tests: hidden for <3 points and non-owner, request payload, preview without draft change, apply/dismiss, identity notice, backend error, missing coordinates.
- [ ] 4.2 `npm run test:i18n`, targeted jest suites, `npm run check:fast`.
- [ ] 4.3 In `testing`: desktop web and mobile web evidence against the local backend once #1951 is deployed; before that only the 404 → "unavailable" path is observable.
