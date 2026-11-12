## 1. Shared adapter

- [x] 1.1 Consume complete cursor lists for travel and thread lookups with legacy-array compatibility.
- [x] 1.2 Reject invalid/repeated continuations and propagate child-thread failures while preserving expanded reads.

## 2. Verification and delivery

- [x] 2.1 Add focused page/compatibility/failure regression tests; pass selective lint and type checks.
- [x] 2.2 Complete independent review, task-scoped commit/push, and standard web deployment for #3383.
- [x] 2.3 Verify two-page integration and deployed backend #3273 contract, record evidence, and validate the OpenSpec change.

## Evidence

- Implementation: frontend `cf224efad30264f5db935210f054084f900e890f`, backend `6b992dae978a8d02ab8f36a07775c9d3567ad4e0`; both reviewed and pushed.
- Focused Jest: 56 passed. ESLint, TypeScript, OpenSpec strict, prompt audit and normal commit/push source gates passed.
- The actual shared reader completed both local travel/thread lookups with 123 ordered unique comments, pages 50/50/23. All 174 fixture comment rows plus the fixture travel and threads were removed; remaining count 0.
- Frontend canonical deployment passed, publication `6aef1e13466f75fa060f75fad92cb1bc`, public source SHA exactly `cf224efad30264f5db935210f054084f900e890f`. Legacy-array compatibility was verified before backend activation.
- Backend canonical rollout passed with ceiling 200, email budget 20/3600 seconds and shared Redis. Production travel 940/thread 334 returned cursor envelopes with matching ids, and the actual shared reader passed both lookups. Public health returned 200.
- No rendering or native-specific branch changed; shared API integration was selected instead of duplicate viewport/device checks. Production mail was not triggered; backend's 69 regressions include real Redis admission across four processes.
