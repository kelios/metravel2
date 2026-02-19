# External Link Governance PR Body Template

## Summary

- What changed and why.

## Policy Context

- Canonical policy reference: `docs/RULES.md`.
- Governance command reference: `docs/TESTING.md#governance-commands`.

## Validation

- [ ] `yarn lint`
- [ ] `yarn governance:verify`
- [ ] `yarn guard:external-links`
- [ ] `yarn test:smoke:critical`

## Explicit Exclusions

- No direct `window.open(...)` usage in feature code.
- No direct `Linking.openURL(...)` usage outside `utils/externalLinks.ts`.
- No undocumented allowlist expansion.

## Risk and Rollback

- Risk level and impact.
- Rollback plan and owner.

## Temporary Allowlist Expansion (only if used)

- Reason:
- Risk:
- Owner:
- Removal date (YYYY-MM-DD):
