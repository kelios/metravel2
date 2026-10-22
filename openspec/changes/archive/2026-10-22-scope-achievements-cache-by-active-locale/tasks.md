## 1. Locale identity

- [x] 1.1 Pass a captured effective active locale to catalog/me/user reads through the existing apiClient; preserve DTO/auth/mock/fallback behavior.
- [x] 1.2 Add locale-sensitive keys and all-locale prefixes; migrate all hooks, derived reads/seeds/getQueryState and QuestPioneerBlock invalidation while preserving owner/public identity and neutral data keys.
- [x] 1.3 Capture mutation context keys/locale/owner; keep rollback in its original copy and prevent personal-cache resurrection after identity reset.
- [x] 1.4 Update existing achievement feature contract and Design evidence without UI geometry or server prose changes.

## 2. Regression and review

- [x] 2.1 Cover five-locale requests/keys, warm RU→PL→EN→RU delayed responses, all-locale invalidation, derived caches, mutation rollback and auth/user privacy; preserve place-first boundary and no preference writes.
- [x] 2.2 Run task-contract targeted suites, test:i18n, lint/typecheck and relevant guards; widen source validation when the final diff requires it.
- [x] 2.3 Complete independent review-auditor repair and code-review-gate with no open P1/P2 findings.
- [x] 2.4 Commit/push the reviewed task paths to main and record the resulting SHA and testing transition in #2697.

## 3. Testing on production

- [x] 3.1 Deploy the reviewed SHA through the standard frontend pipeline and confirm production build source/backend #2692.
- [x] 3.2 Probe profile/public profile/gallery/AuthorCard in all five locales at1440/390 with real network lang/description, warm switching/fallback, console and screenshots; preserve identity and preference boundaries.
- [x] 3.3 Record the accepted Done gate, sync living spec, validate OpenSpec and archive the completed change.

## Completion evidence — 2026-10-22

- Reviewed source committed and pushed to `main`: `bc4f7e461498be401ec33e22f7ae26e48f38b9d6`; #2697 entered `testing` after independent review-auditor and code-review-gate PASS. Targeted regression: 6 suites/111 tests; i18n: 32 suites/539 tests; full lint/typecheck and relevant guards passed. Normal pre-commit: 11 suites/301 tests passed.
- Production deployed that exact source in release `qs-20261022T201735Z-bc4f7e461498`; deploy exit 0, readiness and smoke HTTP 200. Elapsed 623 seconds exceeded the five-minute operation budget; successful rollout does not imply budget compliance. Existing backend #2692 contract was confirmed by real production GETs.
- Production acceptance PASS: RU/BE/UK/PL/EN at 1440×900 and 390×844; catalog/me/public responses, own profile recent/gallery details and public badge identities checked. Actual inline AuthorCard details passed all five locales at 390 px. At 1440 px the existing sidebar AuthorBlock has no badge/detail control; no nonexistent desktop AuthorCard detail is claimed.
- Warm RU→PL→EN→RU, warm selected gallery/AuthorCard, genuine delayed PL code/data with no old description, a late genuine BE response after EN, and UI logout/private-data removal all passed. Completed runs recorded zero console errors. Final shared-lock wrapper `acceptance-2697-prod-final` exited 0.
- Evidence limits: all 27 live catalog entries have translations in every supported locale, so no live missing-translation UI fixture was available. Unsupported `lang=zz` matched all 27 RU descriptions; conditional client passthrough is covered by reviewed regression/source evidence and accepted #2692. Catalog has no mounted UI caller. Production awards were not mutated; all-locale invalidation, rollback and other-owner races are covered by reviewed QueryClient regressions.
- Canonical local evidence (ignored): `.codex-temp/2697/acceptance-report.md`, `production/{matrix,edges,final}.json`, stable 1440/390 screenshots and `board-after-done.json`. Fresh canonical MCP changed #2697 to `done` and verified read-back, preserving contract, history and metadata.
- Finalization: living capability synchronized without changing any requirement; own change strict validation and all 12 living specs passed, `audit:prompts` and `git diff --check` passed. Global `openspec validate --all --strict` ran: 66 passed, 1 unrelated failure in `openspec/changes/persist-planned-trip-original-route-file/` (no delta specs). That foreign active change is preserved; its owner must add the intended delta or declare an intentional spec-free change, then rerun its strict validator and the global check.
