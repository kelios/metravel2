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
- Follow troubleshooting steps from:
  - `docs/TESTING.md#qg-001` ... `docs/TESTING.md#qg-006`

## Risk / Rollback

- Risk level (low/medium/high) and rollback plan.
