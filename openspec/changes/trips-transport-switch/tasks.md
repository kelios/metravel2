## 1. Focused API Contract

- [x] 1.1 Add a transport-only planned-trip input type and request function that maps `car`, `foot`, and `bike` to the exact one-field PATCH payload, normalizes the returned trip, supports only explicit mock mode, and propagates real API failures.
- [x] 1.2 Add adapter tests for all three payload values, the one-request/no-rebuild invariant, normalized route fields, explicit-mock behavior, and real-error propagation.

## 2. Query State and Route Workspace

- [x] 2.1 Add a focused React Query mutation that writes the complete returned trip to the detail cache and invalidates existing planned, public, and community collection keys after success.
- [x] 2.2 Add the owner-only car/walking/bicycle segmented control above the route map, bind it to persisted transport, ignore the current value, and disable every choice while the mutation is pending.
- [x] 2.3 Apply the successful response atomically to the cached trip and local saved route, preserve the prior route on failure, show a retryable inline error, and retain the existing degraded-route explanation.

## 3. Localization and Accessibility

- [x] 3.1 Add any required transport-group, busy, and failure copy to the `trips` resources for RU, BE, UK, PL, and EN while reusing the existing localized transport labels.
- [ ] 3.2 Verify the selector exposes a localized radio-group name, checked/disabled states, web keyboard activation, non-color error feedback, and at least 44 px/dp touch targets without regressing existing segmented-control consumers.

## 4. Automated Validation

- [x] 4.1 Add focused component or integration tests for owner and non-owner rendering, option order, no-op current selection, pending lockout, atomic success, failed-update preservation and retry, and degraded-route rendering.
- [ ] 4.2 Pass the operation gate, then run the narrow adapter/component suites, `npm run test:i18n`, and `npm run check:fast`; fix failures and rerun the affected checks.

## 5. Active-Surface Validation

- [ ] 5.1 Pass the operation gate, run the local app, and verify the owner flow on desktop web and mobile web with mouse, keyboard, and touch-sized interactions; capture screenshots plus clean console and one-PATCH network evidence.
- [ ] 5.2 Confirm the USB Android device with `adb devices -l`, build and install the local Android app, and verify the same selection, pending, success, failure/retry, and degraded-route flow with mobile-web parity.

## 6. Review and Handoff

- [ ] 6.1 Run the mandatory full task-diff code review in review-and-fix mode, repair confirmed correctness, reuse, accessibility, or regression findings, and review the final diff again.
- [ ] 6.2 Rerun all affected validation after review fixes and pass strict OpenSpec change validation plus repository-wide OpenSpec validation.
- [ ] 6.3 Update task-board ticket #1302 to review or testing with the completed Task Contract evidence and any honest production-verification status; do not mark it done without the required acceptance evidence.
