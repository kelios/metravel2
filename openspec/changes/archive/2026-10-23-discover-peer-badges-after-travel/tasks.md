## 1. Разведка и planning

- [x] 1.1 Зафиксировать исходный local browser baseline guest/reader/owner на 390/1440 до кода; отделить source facts от гипотезы низкой активности.
- [x] 1.2 Согласовать BA, UI geometry и architecture; создать proposal/design/spec и проверить change строго.

## 2. Приглашение и выдача

- [x] 2.1 Добавить shared prompt после полного текста, auth/owner/recipient eligibility и responsive UI.
- [x] 2.2 Reuse существующего picker/giver target user, public peerReceived, безопасного guest login/registration return.
- [x] 2.3 Добавить truthful loading/error/retry и production 400 grant rejection после освобождения API-файла владельцем #2697.
- [x] 2.4 Добавить пять локалей и impression/click с travel_id через существующие exposure/analytics helpers.
- [x] 2.5 Исправить user/travel personalized reads, viewer-scoped keys, auth readiness barrier, optimistic target keys и existing initial-data consumers без параллельных запросов.

## 3. Проверки и review

- [x] 3.1 Покрыть условия показа, return query/hash, user-target grant, ошибки/retry, смену статьи/сессии и события поведенческими тестами.
- [x] 3.2 Выполнить focused peer regression, i18n, lint/typecheck и применимые guards с координацией quality gate.
- [x] 3.3 Пройти independent review-and-fix всего task diff, затем code-review-gate; review только code-level.

## 4. Приёмка и завершение

- [x] 4.1 Зафиксировать/запушить явные пути задачи, перевести в testing и выполнить штатный production deploy.
- [x] 4.2 Принять production 390/1440, guest/reader/owner, пять локалей, themes/keyboard, screenshots/console/network и оба события.
- [x] 4.3 Доказать вход/регистрацию с возвратом, реальный user-target POST и persisted GET; сохранить отдельные travel awards.
- [x] 4.4 Записать Done evidence в #2678 и окончательно validate change; архивировать только после всех обязательных проверок.

## Acceptance — 23 October 2026

- Board #2678: `done`, fresh readback `2026-10-22T22:37:39.769153Z`.
- Production source: `bb998eb131b8be49d0bac15cdc49367e61b3761a`; canonical deploy exit 0, strict live SHA/readiness/health/API checks passed.
- Actual desktop 1440/mobile 390, guest/reader/owner, all five locales in light/dark, keyboard, visible focus, exposure deduplication and safe authentication return passed.
- Real user-target grant 31 to disposable author 256: POST 200, persisted authenticated GET true/count 1, anonymous GET false; reload UI showed the issued badge; revoke POST 200 and GET false/count 0. Article-target state stayed unchanged.
- Final temporary articles 852/853 and author 256 were deleted (204 then 404); the grant was revoked, auth-state artifacts removed. Earlier failed attempts were also cleaned.
- Received DTO regression: five RED cases matched production; 9 suites/188 tests, final API 49/49, scoped lint/guards and typecheck passed. Historical full Jest had 9 failed suites; all known failures were repaired and verified by targeted repeats, without claiming an aggregate full PASS.
- Qualification: fresh post-build fixture documents returned 32 HTTP 404 responses with hydration enabled and 14 React #418 errors, including the owner case where the prompt was absent. All were individually attributed to the documented static-snapshot freshness mechanism (SEO-SSR-001/#1835); no unclassified errors remained. The unchanged strict QA wrapper exit 1 is retained. A preexisting generated article (816) on the same SHA returned HTTP 200 with hydration disabled and zero pageerrors at both widths, including CTA activation.
- Analytics evidence is canonical intent emission (28 impressions/25 clicks, only travel_id), not a claim of GA server receipt. Final evidence: `.codex-temp/task-2678/acceptance-report.md`, `prod-run-04/`, `ssg-control-bb998-02/`.
