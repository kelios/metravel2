## 1. Contract and regression evidence

- [x] 1.1 Validate and review the bounded planning artifacts against #3363 and the existing request-local header path.
- [x] 1.2 Add focused RED tests for page-1 failure/invalid payload, healthy responses, later-page refusal and response isolation using the real Expo response scope.

## 2. Producer implementation

- [x] 2.1 Emit the exact degraded header through the existing request-local transport only when page 1 falls back to null.
- [x] 2.2 Run focused Jest and scoped static checks; preserve route exports, payloads and browser bundle source/budget pins.

## 3. Delivery-owner acceptance

- [ ] 3.1 Complete independent review-and-fix and the mandatory code-review gate on the full task diff.
- [ ] 3.2 After normal authorized publication, verify deployed source identity and normal `/search` response header absence plus the raw catalog navigation block.
- [ ] 3.3 Run final OpenSpec validation and archive only after all required acceptance evidence passes.
