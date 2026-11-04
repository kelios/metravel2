## 1. Implementation

- [x] 1.1 Add compact social page and exact subscription status adapters.
- [x] 1.2 Wire active tabs, pagination and user-initiated subscriber status disclosure.
- [x] 1.3 Verify page budgets, cancellation, viewer separation and mutation rollback in focused tests.

## 2. Acceptance

- [x] 2.1 Verify the deployed flow and network budgets at 390 and 1440 px.

## Evidence

- Production source `6ce85e5e3`. At 390 and 1440 px each active profile tab issued one compact page request with zero per-author travel reads. Subscriber status loaded only after disclosure. A cold public profile requested the exact relationship status without loading either social list.
- Controlled browser cases verified a second page, a failed page followed by retry, and the subscribe/unsubscribe request sequence without changing production data.
- The independent review, lint, typecheck, targeted Jest and pre-push checks passed. The pre-push selection passed 454 tests.
