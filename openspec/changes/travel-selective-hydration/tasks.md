## 1. Establish cause and plan

- [x] 1.1 Preserve the supplied Google PSI baseline and production identity; inspect a CDP attribution trace and historical controls.
- [x] 1.2 Record bounded decisions, regression risks and the unchanged live Performance >=90 acceptance boundary.

## 2. Implement and review

- [x] 2.1 Partition web hero/article hydration without changing server content or native composition.
- [x] 2.2 Avoid unchanged deferred geometry transactions and add a genuine-DOM growth/no-op regression.
- [x] 2.3 Complete focused code-level validation, independent review-and-fix and code-review-gate.
- [x] 2.4 After the failed primary probe, transition noncritical web readiness/size updates and inline travel SSR critical CSS; repeat focused checks and independent review, then record the formal gate before publication.

## 3. Publish and accept

- [x] 3.1 Commit explicit task paths, push main and publish the reviewed SHA through frontend-deployer.
- [x] 3.2 Pass bilateral slider/performance gates and mobile/desktop browser checks with screenshots and console evidence.
- [ ] 3.3 Repeat live mobile Google PageSpeed to >=90, verify desktop/adjacent travel behavior, and record actual values in #3071.

## Evidence — 2026-11-05

- Кандидаты `7ea1a93a` и `c58b7537` отревьюены, запушены и опубликованы; текущий production `ca64e4929` содержит оба коммита.
- На чистом локальном клоне `ca64e4929`: `verify:slider` 2/2, `verify:slider-perf` 37/37, pointer Jest 5/5 — PASS, без повторов/пропусков и изменения порогов. Пять холодных throttled mobile TBT: 399/379/458/264/270 мс, медиана 379 при лимите 650 мс. Сторож локального бэкенда: 81/81 HTTP 200.
- Совместимые production-проверки от предыдущей сессии: mobile swipe/scroll/tap/fullscreen и desktop drag/wheel. Исходный отказ desktop mouse-click fullscreen не включён в PASS; он сохранён как отдельный риск с последующей Problem Memory проверкой в карточке #3071. Raw evidence нового прогона: `.codex-temp/qa3071/.codex-temp/perf-nesvizh/bilateral-qa/RESULT.md` и `summary.json` на машине приёмки.
- Пункт 3.3 открыт: обычный Google mobile PSI 74, desktop 95; локальные бюджеты не доказывают mobile >=90. Первая плановая повторная проверка 30.11.2026 либо раньше после подтверждённой выкладки upstream-исправления в PSI. Сначала подтвердить применимость версии браузера, затем повторить исходный холодный гостевой mobile-профиль и сохранить фактический результат. Статус карточки — `testing` с точным временным условием, не `done`.
