# PR Body: External Link Governance Hardening

## Summary

This PR hardens external-link governance across code, CI guards, tests, and docs.

Key outcomes:

- Centralized external URL/window opening logic.
- Removed direct `window.open(...)` usage from feature code paths.
- Kept direct `Linking.openURL(...)` usage centralized.
- Added guard scripts and anti-drift tests.
- Aligned PR/release/testing docs to a single canonical policy source.

## What Changed

### 1) Centralized runtime behavior

- Added/updated centralized helpers in `utils/externalLinks.ts`:
  - `openExternalUrl(...)`
  - `openExternalUrlInNewTab(...)`
  - `openWebWindow(...)` (single web-window chokepoint)
- Updated print/book preview flow:
  - `utils/openBookPreviewWindow.ts` now relies on centralized web-window helper.
  - `components/quests/QuestPrintable.tsx` now delegates preview opening to `openBookPreviewWindow(...)`.

### 2) Feature migration away from direct opens

- Migrated external-opening callsites in map/travel/user/account/upsert/share flows to centralized helpers.
- Modifier-click card behavior on web now uses centralized helper path.

### 3) Guard enforcement

- Added scripts:
  - `scripts/guard-no-direct-linking-openurl.js`
  - `scripts/guard-no-direct-window-open.js`
- Added alias:
  - `guard:external-links`
- Wired alias into:
  - `lint`
  - `lint:ci`
- Tightened `window.open` allowlist to a single file:
  - `utils/externalLinks.ts`

### 4) Governance + anti-drift tests

- Guard contract tests:
  - `__tests__/scripts/guard-no-direct-linking-openurl.test.ts`
  - `__tests__/scripts/guard-no-direct-window-open.test.ts`
- Script wiring contract:
  - `__tests__/scripts/external-links-guard-script-contract.test.ts`
- Docs/process parity contract:
  - `__tests__/scripts/external-links-docs-policy-parity.test.ts`
- Governance parity/list updates:
  - `__tests__/scripts/governance-script-parity.test.ts`
  - `package.json` `test:governance`

### 5) Documentation alignment

Updated and aligned:

- `.github/pull_request_template.md`
- `docs/RULES.md` (canonical policy source)
- `docs/DEVELOPMENT.md`
- `docs/RELEASE.md`
- `docs/PRODUCTION_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/README.md`
- `docs/INDEX.md`
- `docs/EXTERNAL_LINK_GOVERNANCE_PR_SUMMARY.md`

## Validation

Run from repo root:

```bash
npm run governance:verify
yarn lint
```

## Risk / Rollback

- Risk level: Low to Medium (broad callsite migration, behavior centralized).
- Rollback strategy:
  1. Revert this PR as one unit.
  2. Re-run `npm run governance:verify`.

## Explicit Exclusions

- `nginx/nginx.conf` is **out of scope** for this PR and must be reviewed separately.
