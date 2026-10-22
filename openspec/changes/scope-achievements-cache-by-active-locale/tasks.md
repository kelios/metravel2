## 1. Locale identity

- [x] 1.1 Pass a captured effective active locale to catalog/me/user reads through the existing apiClient; preserve DTO/auth/mock/fallback behavior.
- [x] 1.2 Add locale-sensitive keys and all-locale prefixes; migrate all hooks, derived reads/seeds/getQueryState and QuestPioneerBlock invalidation while preserving owner/public identity and neutral data keys.
- [x] 1.3 Capture mutation context keys/locale/owner; keep rollback in its original copy and prevent personal-cache resurrection after identity reset.
- [x] 1.4 Update existing achievement feature contract and Design evidence without UI geometry or server prose changes.

## 2. Regression and review

- [x] 2.1 Cover five-locale requests/keys, warm RU→PL→EN→RU delayed responses, all-locale invalidation, derived caches, mutation rollback and auth/user privacy; preserve place-first boundary and no preference writes.
- [x] 2.2 Run task-contract targeted suites, test:i18n, lint/typecheck and relevant guards; widen source validation when the final diff requires it.
- [x] 2.3 Complete independent review-auditor repair and code-review-gate with no open P1/P2 findings.
- [ ] 2.4 Commit/push the reviewed task paths to main and record the resulting SHA and testing transition in #2697.

## 3. Testing on production

- [ ] 3.1 Deploy the reviewed SHA through the standard frontend pipeline and confirm production build source/backend #2692.
- [ ] 3.2 Probe profile/public profile/gallery/AuthorCard in all five locales at1440/390 with real network lang/description, warm switching/fallback, console and screenshots; preserve identity and preference boundaries.
- [ ] 3.3 Record the accepted Done gate, sync living spec, validate OpenSpec and archive the completed change.
