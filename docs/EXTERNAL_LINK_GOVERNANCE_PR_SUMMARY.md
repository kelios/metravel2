# External Link Governance PR Summary

Use this summary when a PR changes external-link behavior, guard scripts, or guard allowlists.

Primary PR body template:

- `docs/EXTERNAL_LINK_GOVERNANCE_PR_BODY.md`

## Scope

- Centralized external navigation (`utils/externalLinks.ts`) only.
- Guard policy enforcement (`guard:no-direct-linking-openurl`, `guard:no-direct-window-open`, `guard:external-links`).
- Documentation parity (`docs/RULES.md`, `docs/TESTING.md`, release/checklist docs).

## Required validation

- `yarn lint`
- `yarn governance:verify`
- `yarn guard:external-links`
- `yarn test:smoke:critical`

## Required PR notes

- Business/technical reason for change.
- Risk statement.
- Rollback/removal plan.
- Owner and target removal date if allowlist expansion is temporary.
