## 1. Qualified import

- [x] 1.1 Implement bounded, safe manifest and official Apple/Google report parsing, application identity, coverage and independent source qualification.
- [x] 1.2 Cover genuine acquisition semantics, encodings, updates/IAP exclusion, dates, zero/missing data, unsafe paths and overlap with focused regression fixtures.

## 2. Summary integration

- [x] 2.1 Add optional store input directory, completed-month store metrics and exact imported-period section without changing the existing completed-month window or click events.
- [x] 2.2 Document source semantics, repeatable exports and refresh, coverage and missing-access limitations in the existing growth plan.
- [x] 2.3 Run focused unit/static checks and independent review-and-fix of the full task diff plus the required code review gate.

## 3. Testing and handoff

- [x] 3.1 Run the owner CLI with real store exports where accessible, verify exact periods/values and independently missing-source behavior. No app runtime/device/web deployment gate applies to this CLI-only change.
- [x] 3.2 Record current store discovery audit and actual statistics/access limitations, validate OpenSpec and synchronize the living report contract after acceptance.

## Acceptance evidence — 2026-10-22

- Reviewed implementation: `5f6d76cd2975464fda08167ad93beca7712740bd`; both independent reviews, 149 targeted tests, ESLint, Node syntax, prompt audit and strict task OpenSpec validation passed. `openspec validate --all`: 65 passed, one unrelated failure in `persist-planned-trip-original-route-file`; that change was left untouched.
- The owner CLI completed successfully with the real official Apple export: `2026-10-19` through `2026-10-19`, `America/Los_Angeles`, complete coverage of that day, **1 first-time download and 0 redownloads**. These observations remain separate from the historical twelve completed months (`2025-10-01` through `2026-09-30`) and existing year-over-year comparisons.
- Missing Google export remained unavailable with `MISSING_REPORT`; missing optional input also returned `MISSING_REPORT`. A daily Apple export falsely declared as a full month returned `INVALID_DATE` and produced no monthly total.
- Evidence remains private in `.codex-temp/store-download-statistics/acceptance.json` and `.codex-temp/metrics-summary/2026-10-22.md`; raw store exports are not committed. All three added requirements are synchronized to the living monthly-metrics-summary specification.
