## 1. Apply preflight и согласованный контракт

- [x] 1.1 После отдельного apply-запроса перечитать artifacts, проверить main/status и живого владельца #2198; зафиксировать согласованный short-height контракт и Design evidence на борде. До этого code changes запрещены.
- [x] 1.2 Снять точные source/producer fingerprints текущей шапки и print/search/share/offline/pilots, сохранить отрицательный before и актуальные preconditions реальных translated/foreign fixtures.

## 2. Meaningful regression и доменное размещение

- [x] 2.1 Добавить исходно падающие поведенческие tests для Height-aware composition: 320×640/390×640, 839/840 и 390×844; 599/600 и desktop1440 controls, один header/ScrollView/mainContent.
- [x] 2.2 Добавить regression на Stable interaction: открытый sheet, активный ответ/клавиатура, scroll gesture и обратный resize по высоте и ширине599↔600/ориентации; проверять сохранение ввода, refs, current point и читаемой позиции, не только prop equality.
- [x] 2.3 В существующей quest responsive-модели ввести продуктовую short-height policy без QA constants/visual-keyboard-height; сохранить global/native boundaries.
- [x] 2.4 Разместить единственный header внутри прежней прокрутки только в short flow; убрать short внешние vertical reserves, сохранить 44px route, locale sibling, горизонтальные16px и внутренние отступы задания.
- [ ] 2.5 Связать минимальный доменный busy state sheet/input/keyboard/scroll, defer переход и anchor compensation, сохранив существующие handlers/reset-step semantics; довести tests2.1–2.2 до GREEN.
- [ ] 2.6 Подтвердить Language independence и Operational statuses через route/header/keyboard/offline tests; обновить feature contracts и макет как принятое поведение только после apply.

## 3. Code-level validation и review

- [ ] 3.1 Пройти operation gate и выполнить targeted Jest responsiveModel/route/header/keyboard/offline, scoped check:fast, lint/typecheck/guards и npm run test:i18n; audit:prompts для docs. Не запускать runtime на review.
- [ ] 3.2 Независимый review-auditor проверяет и исправляет полный task diff, затем повторяет релевантные checks; отдельный code-review-gate подтверждает итог.

## 4. Testing после reviewed публикации

- [ ] 4.1 Выполнить standing AGENTS pipeline явными task paths: commit/push, статус testing с SHA, canonical DEPLOY_QUIET=1 scripts/deploy-prod.sh <sha> через frontend-deployer. Согласовать одно quality/deploy окно; никаких параллельных повторов. Эти шаги относятся к будущему apply, не к planning.
- [ ] 4.2 Сверить live .build-source.json и исполнить исходные14cases/56rows бюджета 320×640/390×844 обе темы с RU/translated/foreign controls. Сохранить настоящие source-pinned raw/screenshot/console/network; пределы/collectors неизменны, прежний first-content marker интро/шага/финала не переносить на маршрут.
- [ ] 4.3 В production доказать scroll-out/back, route full sheet/current row/passive-language action, boundary839/840 и390×640, resize640↔844/width599↔600, введённый ответ/focus/keyboard, orientation/browser toolbar, intro/step/finale и desktop1440 controls.
- [ ] 4.4 Пройти настоящий offline foreign copy и естественные pending/photo; проверить loading/error/retry без фиктивных API ответов. Покрыть все состояния, объявленные в исходном #2198 contract/acceptance matrix; старые незавершённые106/84/40 нельзя закрывать одной smoke-пробой.
- [ ] 4.5 Сверить producer fingerprints и историческую provenance print/search/share/pilots; при реальном пересечении diff повторить соответствующие исходные сценарии. Проверить действительный язык fixture, source-only share не называть browser evidence.

## 5. Независимая приёмка и завершение

- [ ] 5.1 Независимый приёмщик сверяет все requirement/scenario receipts, исходные отрицательные и новые положительные, exact SHA; при собственном дефекте вернуть #2198 в работу. done только при реальном полном Done gate; native runtime не заявлять.
- [ ] 5.2 После всех обязательных checks выполнить openspec validate --all, согласовать archive/sync с текущим запросом, обновить Problem Memory фактическим постоянным control. Planning-список не отмечать как реализованный заранее.
