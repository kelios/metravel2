## 1. Planning

- [x] 1.1 Установить механизм #3441 и границы, записать нормативные UI-состояния в feature doc.
- [x] 1.2 Проверить OpenSpec до apply.

## 2. Implementation

- [x] 2.1 Добавить scoped nextPageError/retryNextPage с существующими async/auth guards.
- [x] 2.2 Подключить выбранный источник вкладки к одному web footer без изменения native-разметки.
- [x] 2.3 Добавить две подписи RU/BE/UK/PL/EN и focused hook/adapter/DOM/e2e regression controls.

## 3. Validation and delivery

- [x] 3.1 В выделенном слоте выполнить focused Jest, i18n и требуемые source checks.
- [x] 3.2 Пройти независимые review-auditor и code-review-gate по точному task diff.
- [x] 3.3 После coordinator lease закоммитить явные пути, push main и testing.
- [x] 3.4 На local API8000 пройти mobile web, затем desktop: 503 page2, footer >4s, repeated503, retry→40 cards, empty-list control; screenshots/console/network.
- [x] 3.5 Выполнить обычный web deploy и узкий production identity/profile smoke без fault injection.
- [x] 3.6 Передать PROBLEM_MEMORY entry координатору; после acceptance синхронизировать living spec, validate и archive.

## Acceptance evidence — 16.11.2026

- Code/review: initial pagination source `27b9b9be83f36597e890d10705072e91c4327e5b`; final published combined app `4c1de3a60d4ecfbf62d2ae60f46f541b0d9f3532`. Independent auditor/final code-review gate PASS; exact source hashes retained. Focused final 6 suites / 65 tests, actual 3-path ESLint and source TypeScript PASS; unchanged i18n 34 suites / 558 tests reused.
- Inherited render warning was reproduced red→green with real DOM/QueryObserver. Query invalidation notifications now belong to the current query and are scheduled outside child rendering. Its durable test is `__tests__/hooks/useMyTravels.subscription.dom.web.test.tsx`.
- Committed `e2e/profile-next-page-retry-3441.spec.ts` passed all 4 local cases on frozen4c1: mobile then desktop, one footer >4500ms, repeated503, same-page retry20→40 (page1Requests1/page2Requests3), empty-first-page recovery. Unexpected console errors, cross-render warnings and page errors: 0. Local fixture User104/Profile1/Draft1; no production fault injection.
- Canonical publication4c1 PASS217s, actual build-source matches. Healthy production `/profile` under separate official prodProbe account104 returned200; hydrated list present, console/page/API errors and writes:0. Evidence: `.codex-temp/sprint35-frontend/qa-slot-final4c1.json`, `.codex-temp/sprint35-frontend-3441/local-qa-final4c1-summary.json`, `.codex-temp/3444/profile-healthy-production.json`.
- Accepted Problem Memory entry is merged after the separately accepted #3442 block without changing its bytes. Both scopes have explicit delivery ownership; `.codex-temp/sprint35-frontend/closure-prep/problem-memory-provenance.json` records block/full-file hashes.
- Living spec synced and change archived after the above implementation/runtime gates. Documentation review/normal closure commit remain a separate delivery phase; this archive alone does not mark the board Done.
- Full e2e TypeScript remains NOT PASS: six known diagnostics in three unchanged specs; it is not relabelled by the scoped results.
