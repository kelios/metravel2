## Summary

- What changed and why.

## Validation

- [ ] `yarn lint`
- [ ] `yarn test:smoke:critical`

## CI Smoke Gate

- If CI fails, check `Quality Gate Summary` in workflow `CI Smoke`.
- Capture and include:
  - `Failure Class`
  - `Recommendation ID` (`QG-00x`)
- Quick map: `QG-001 infra_artifact`, `QG-002 inconsistent_state`, `QG-003 lint_only`, `QG-004 smoke_only`, `QG-005 mixed`, `QG-006 performance_budget`.
- Follow troubleshooting steps from:
  - `docs/TESTING.md#qg-001` ... `docs/TESTING.md#qg-006`

## CI Policy

- Merge is blocked while `Failure Class != pass`.
- Exception path: if merge is still required, include:
  - business reason
  - explicit risk statement
  - rollback plan
  - owner and deadline for follow-up fix

## CI Exception (Only if Failure Class != pass)

- Format guide: `docs/TESTING.md#pr-exception-format`
- [ ] Exception requested
- Business reason:
- Risk statement:
- Rollback plan:
- Owner:
- Fix deadline (YYYY-MM-DD):

## Risk / Rollback

- Risk level (low/medium/high) and rollback plan.
