# External Link Governance PR Summary

## Scope

This change set hardens external-link handling and governance enforcement:

- Centralizes URL opening logic.
- Eliminates direct `window.open(...)` and `Linking.openURL(...)` usage in feature code.
- Adds CI/PR/release guard enforcement and anti-drift contracts.
- Aligns docs and governance scripts to a single policy source.

## Core Code Changes

- Added centralized web window chokepoint in `utils/externalLinks.ts`:
  - `openExternalUrlInNewTab(...)`
  - `openWebWindow(...)`
- Migrated feature callsites from direct opens to centralized helpers, including:
  - travel/map/user points flows,
  - account and upsert flows,
  - share buttons and card modifier-click behavior.
- Updated print/book preview flow:
  - `components/quests/QuestPrintable.tsx` now uses `utils/openBookPreviewWindow.ts`.
  - `utils/openBookPreviewWindow.ts` now uses `openWebWindow(...)`.

## Guard Enforcement

- Added:
  - `scripts/guard-no-direct-linking-openurl.js`
  - `scripts/guard-no-direct-window-open.js`
- Added npm alias:
  - `guard:external-links`
- Wired alias into:
  - `lint`
  - `lint:ci`
- Tightened `window.open` allowlist to a single chokepoint:
  - `utils/externalLinks.ts`

## Tests Added/Updated

- Guard contracts:
  - `__tests__/scripts/guard-no-direct-linking-openurl.test.ts`
  - `__tests__/scripts/guard-no-direct-window-open.test.ts`
- Script wiring anti-drift:
  - `__tests__/scripts/external-links-guard-script-contract.test.ts`
- Docs/process parity anti-drift:
  - `__tests__/scripts/external-links-docs-policy-parity.test.ts`
- Governance parity updates:
  - `__tests__/scripts/governance-script-parity.test.ts`
  - `package.json` `test:governance` list updated.
- Helper behavior updates:
  - `__tests__/utils/externalLinks.test.ts`
  - `__tests__/utils/fetchAndJsonUtils.test.ts`

## Documentation Alignment

- Updated:
  - `.github/pull_request_template.md`
  - `docs/RULES.md`
  - `docs/DEVELOPMENT.md`
  - `docs/RELEASE.md`
  - `docs/PRODUCTION_CHECKLIST.md`
  - `docs/TESTING.md`
  - `docs/README.md`
  - `docs/INDEX.md`
- Canonical policy source is `docs/RULES.md` (`External link policy`).

## Validation Commands

Run from repo root:

```bash
npm run governance:verify
yarn lint
```

## Known Caveat (Unrelated Diff)

There is an unrelated local modification in `nginx/nginx.conf`.
Keep it out of this governance PR unless explicitly intended and reviewed separately.

## PR Draft

Copy-ready draft is available in:

- `docs/EXTERNAL_LINK_GOVERNANCE_PR_BODY.md`
