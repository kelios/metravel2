## 1. Доказать границы исправления

- [x] 1.1 После отдельного запроса apply перечитать planning artifacts, проверить main/status и согласовать owned paths/quality lock с живыми сессиями; оформить карточку через Problem Memory/Task Contract, не дублируя открытую работу.
- [x] 1.2 Зафиксировать текущий production SHA и повторить baseline, если он отличается от design.md; использовать одинаковые Lighthouse 12.8.2, cold guest, mobile 412×823 DPR1,75 и отдельные applied/simulate отчёты.
- [x] 1.3 Снять production dependency graph для Home → EmailSubscriptionForm → api/misc; выделить исключительно удерживаемые ранние модули и записать raw/compressed bytes, не считая повторно shared chunks.
- [x] 1.4 Получить CPU profile главной длинной задачи entry, отделить React framework от removable app-owned работы. Не править root chrome/SSG/hydration без подтверждённого source механизма; сохранить evidence остаточной проблемы.

## 2. Устранить лишнюю раннюю загрузку

- [x] 2.1 Перенести export EmailSubscriptionForm в существующие web lazy / native eager adapters; изменить Home import, сохранив props, low visibility trigger, minHeight=240 и Suspense fallback.
- [x] 2.2 Если граф 1.3 подтверждает исключение retained helpers, выделить subscription transport и compatibility exports из misc; иначе явно отметить задачу как неприменимую по evidence без рефакторинга API.
- [x] 2.3 Дополнить профильные Home/adapter tests на import boundary и видимость: отсутствие premature load, начало загрузки по прежнему событию, native eager exports и неизменные consent/canonical props.

## 3. Code-level checks и независимое ревью

- [x] 3.1 Запустить targeted Jest для Home/adapter и subscription API только при его изменении, ESLint затронутых paths и tsc; не запускать runtime в стадии review.
- [x] 3.2 Через operation gate проверить production preview build и `guard:bundle-budget`/`guard:eager-web`; доказать уменьшение раннего Home графа, прохождение owned ceilings и отсутствие новых crossings/расширения бюджетов. Сохранить общий FAIL11 и before/after атрибуцию; это scoped source check, не full release PASS. Перед публикацией отдельно проверить isolated committed SHA существующими bundle/eager guards; при обязательном in-scope красном результате остановить rollout и вернуть in_progress.
- [ ] 3.3 Выполнить независимый metravel-code-reviewer/review-auditor review-and-fix по полному task diff, затем code-review-gate; исправить findings и повторить только затронутые checks.
- [x] 3.4 Валидировать итог `openspec validate reduce-home-bootstrap-javascript --strict` и `npm run audit:prompts`.

## 4. Production testing и завершение

- [ ] 4.1 По разрешённому AGENTS.md pipeline коммитить явные task paths и push main с `PREFLIGHT_SKIP_E2E=1`, затем testing с SHA и штатный frontend-deployer; получить совпадение `.build-source.json` до acceptance.
- [ ] 4.2 Проверить live desktop/mobile первое отображение, console/screenshots и весь request/API/media журнал до/после scroll; форма RU и отображение BE/UK/PL/EN, негативный быстрый scroll/ошибка chunk, consent/400/429 прежнего API.
- [ ] 4.3 Повторить исходные cold production probes той же версией/профилем; отдельно applied/simulate, mobile/desktop. Записать LCP candidate, CPU, TBT, CLS, request count, bytes и HTTP status; подтвердить отсутствие SSG regression.
- [ ] 4.4 Сопоставить TBT с 400 мс APP-SHELL-BOOT. Если остаток выше бюджета, не закрывать запрос как полностью исправленный: записать атрибутированную причину и конкретный следующий check/scope. При зелёном Done gate завершить карточку; при дефекте вернуть in_progress и продолжить цикл.

Progress 08.10.2026: #2345 создана/claimed, source patch выполнен. Actual after export подтверждает исключение 13 startup-модулей (1189→1176), initial Home scripts 14→13. Aggregate gzip765253→759275 B / brotli601208→596069 B содержит изменения соседнего поезда и не является Home-exclusive savings или live acceptance. Отдельная изоляция транспорта (2.2) неприменима. Review-auditor исправил mocks и stateful visibility fixture; четыре Home suites/25 tests, scoped ESLint и общие tsc/e2e-types прошли; eager-web guard, strict OpenSpec и audit:prompts прошли. Контрольный возврат eager import дал ожидаемый RED1failed/1passed; exact Home bytes восстановлены в finally, GREEN2/2. Общий bundle guard before/after exit1 с одинаковыми11 violations, Home chunk passes, новых crossings нет; полный отчёт не объявляется pass. Таблица атрибуции в design; budgets не расширены, final gate/candidate решение ещё требуется. CPU profile подтверждает распределённые Metro/React/RNW расходы, отдельной removable app-задачи на все382 мс не обнаружено. Production выкат и after Lighthouse ещё не выполнены.
