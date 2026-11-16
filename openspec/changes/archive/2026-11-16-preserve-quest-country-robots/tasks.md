## 1. Реализация

- [x] 1.1 Передать общий вердикт страны в клиентский SEO-компонент.
- [x] 1.2 Добавить регрессию с настоящим Helmet для двух вердиктов, переходов и build-owned noindex городов/деталей.
- [x] 1.3 Обновить Problem Memory и профильный контракт.

## 2. Проверки

- [x] 2.1 Выполнить focused Jest и check:fast, подтвердить отрицательный контроль.
- [x] 2.2 Выполнить независимое code review и устранить подтверждённые findings.
- [x] 2.3 Выполнить штатный выкат и проверить серверный/клиентский robots Norway/Spain на проде.
- [x] 2.4 Валидировать и архивировать завершённый OpenSpec change.

## Acceptance evidence — 16.11.2026

- Exact reviewed11source paths were committed in combined `4c1de3a60d4ecfbf62d2ae60f46f541b0d9f3532`; independent auditor/final gate PASS/findings0. Focused Jest4suites38/38 and scoped check:fast1suite7/7 plus guards PASS. The pre-fix negative control received `noindex,nofollow` instead of expected `noindex, follow`.
- Canonical publication4c1 PASS217s; live `.build-source.json` matches. Guest raw HTML and DOM after8s each contain exactly one robots: Norway `noindex, follow`, Spain `index, follow`; page errors and blocked writes:0. Evidence: `.codex-temp/3444/robots-production.json` and screenshots/raw HTML beside it.
- Conditional build-owned city/detail noindex transfer uses the real Helmet unit contract within38/38PASS. Existing `/quests/subotica` is currently indexable; `/quests/217/subotica` returns404. An optional `/quests/oslo` probe incorrectly expected noindex: actual raw HTML AND DOM contain the same `index, follow`, with no runtime errors. That failed fixture assumption is preserved in `.codex-temp/3444/profile-neighbour-ineligible.json`, excluded from noindex PASS, and was not retried. The coordinator accepted the conditional unit fallback.
- Country/city/detail policy thresholds, API/data and native behavior are unchanged. Living spec synced and change archived after acceptance; documentation review/normal closure commit and board Done are separate remaining delivery steps.
