---
name: sprint-review
description: "Приёмка активного спринта на MCP-борде: тикеты в testing проверяются реально по Task Contract и AC, зелёные → done, дефекты → связанные задачи. Триггеры: «прими спринт», «приёмка спринта»."
---

# sprint-review

Раннбук **приёмки спринта** на общем таск-борде (`metravel.by/board`, Django `task_board`).
Борд — единственный источник правды; операции с ним — через агента **ticket-board** или
напрямую приёмочным агентом **board-reviewer** (у него есть update-доступ к статусу). Этот скилл
оркеструет проход; сам код не пишет и не чинит — он доказывает готовность и двигает статусы.

Аргумент `$ARGUMENTS` — номер спринта (напр. `18`), `active`, либо id одного тикета. По умолчанию —
активный спринт.

## Чем приёмка отличается от `ticket-flow`
`sprint-review` — это батч-проход по накопившейся очереди. В штатном потоке приёмка одного
тикета запускается сама: хук `.claude/hooks/review-gate.mjs` требует вызвать `board-reviewer`
сразу, как задача попала в `testing`. Этот скилл нужен, когда тикеты пришли из других сессий,
копились без приёмки или закрывается спринт целиком.

`ticket-flow` ведёт ОДИН тикет через весь пайплайн (discovery → implement → review → test →
release). `sprint-review` — это батч-гейт на конце: пробегает ВСЕ кандидаты на закрытие в спринте
и решает, что реально можно отдать в `done`. Реализацию и багфиксы он делегирует, не делает сам.

## Шаги

1. **Подключение к борду.** `ticket-board`: показать доску, найти активный спринт
   (`metravel_sprints_list` → `status=active`) или взять спринт из `$ARGUMENTS`. Борд недоступен —
   стоп, сослаться на `docs/TASK_BOARD_MCP.md`. Не приниматься вслепую.
2. **Собрать очередь приёмки.** `metravel_tasks_list(sprint=<N>, status=testing)`.
   Раздели области `front`/`back`/`android`/`ios`. Другие статусы в runtime-приёмку
   не идут: `review` требует code review и перехода в `testing` по
   `docs/TASK_BOARD_MCP.md` → «Коммит и пуш — часть перехода `review → testing`».

   **`area=back` из очереди исключается сразу.** Бэкенд-тикеты не проверяются, не двигаются и не
   комментируются в рамках приёмки спринта — в итоговом отчёте про них пишется только строка
   «пропущено N тикетов `area=back`». Взять их в работу можно лишь тогда, когда пользователь
   прямо попросил проверить бэкенд в этом же запросе; тогда это отдельный проход агентом
   `backend-status-sync`, а не часть батча. Причина: очередь бэка ведёт её владелец, и его фиксы
   регулярно остаются незапушенными в `origin/master` — приёмка возвращает «остаётся» по всем
   карточкам и тратит время впустую (прецеденты 2026-07-04 и 2026-08-10, вся очередь из 15 карточек).
3. **Приёмка каждого тикета — агент `board-reviewer`.** Локальный QA-таргет и
   обновление бэкенда перед первой пробой — `docs/WORKFLOW_OPERATIONS.md` →
   «3.0 Локальный стек и обновление бэкенда перед тестированием». Для каждого кандидата:
   - сверить наличие и полноту `## Task Contract` (нет/пусто → вернуть в `in_progress`,
     «contract incomplete», это refinement-долг);
   - выполнить `Done gate` + `Validation` + AC реальными проверками. **Браузер — основное
     доказательство:** пройти реальный пользовательский флоу из AC на target env через preview
     (`preview_start`/`click`/`fill`/`snapshot`/`console`/`network`/`screenshot`), убедиться, что
     в UI реальные данные с BE (не mock/пусто/ошибка) и network идёт на правильный endpoint.
     Узкие тест-прогоны (`npm run test:run -- <scope>`, `typecheck`, e2e) — вспомогательно,
     **авторизованные `curl`-пробы** контрактного endpoint/field/event на target env
     (логин e2e-аккаунтом из `.env.e2e` → `Token` → запрос с `Authorization`); анонимный
     404/401 — не доказательство контракта;
   - вынести вердикт **pass/fail** с доказательством.
4. **Двинуть статусы (с evidence).**
   - **pass** → `status=done` + evidence-заметка в `description` (дата, прошедшие проверки,
     ответы probe/тестов без секретов, скрин/лог).
   - **confirmed defect** → reproduction evidence, `problem-memory`, затем create/reuse отдельной
     связанной bug/task через `ticket-board`; текущий завершённый acceptance-тикет → `done`,
     его не возвращать и не парковать;
   - обязательный gate сейчас недоступен → остановиться, запросить у владельца exact unblock и
     продолжить ту же приёмку. `testing` между turns допустим только для конкретного повторного
     замера с exact параметром, threshold/trigger и временем.
5. **Багфиксы — отдельным тикетом.** Связанную карточку передай профильному FE-агенту /
   `ticket-flow`; current acceptance уже не используется как контейнер новой работы.
6. **Сводка спринта.** Таблица `id | area | вердикт | evidence | осталось`, ссылка на `/board`,
   список разблокированной/заблокированной работы.
7. **Закрытие спринта.** Если ВСЕ тикеты спринта (front+back) приняты в `done` и нет
   `blocked_by` — по явному запросу `board-reviewer` закрывает спринт
   (`metravel_sprint_update(status=closed)`). Остался хоть один не-`done` — спринт оставить
   `active` и перечислить, что мешает закрытию.

## Правила

- **Реальная проверка, не чтение кода.** «Готово» = код + тест/браузер + runtime evidence против
  target env. До этого тикет не `done`.
- **Статус соседней задачи — не доказательство.** BE `done`, но FE-проба ловит 404/не тот
  field/event → `problem-memory` + отдельная связанная bug/task; текущий acceptance не парковать.
- **Mock/dev-fallback + зелёные unit-тесты** не закрывают задачу, где AC требует интеграцию с BE.
- **Проверка определяется platform impact.** `Platform impact = Android` закрывается
  прогоном на устройстве, `iOS` — прогоном `ios-tester` на слое из Task Contract (simulator —
  вёрстка; физический iPhone — safe area/permissions/Keychain/HEIC/Universal Links/APNs;
  TestFlight — приёмка релиз-кандидата), `shared/common` — desktop web + mobile web.
  Общий компонент сам по себе не создаёт Android/iPhone device gate.
- **Store-операции вне приёмки.** Signed build, upload в TestFlight, submit в App Review и
  storefront release делает только `ios-deployer` по явной команде владельца; факт заливки
  не является вердиктом приёмки.
- Невозможно запустить обязательный gate из-за доступа/устройства/окружения → остановиться,
  запросить exact unblock и продолжить тот же acceptance без финального `verify pending` handoff.
- Каждый переход статуса — с дописанным доказательством; борд не должен отставать от реальности.
- Не печатать секреты/токены. Деплой — только по явному target, не в приёмке по умолчанию.

## Роли → агенты
| Шаг | Исполнитель |
|---|---|
| борд: листинг/статусы/спринт | `ticket-board` |
| приёмка: проверка + перевод в done/возврат | `board-reviewer` |
| багфикс отбитого тикета (FE) | `travel-expert`, `map-expert`, `dev-loop` |
| runtime-evidence на Android | профильный tester по `android-qa-sweep` (локальная сборка + `adb`) |
| runtime-evidence на iPhone | `ios-tester` (simulator / physical / TestFlight), фикс — `ios-expert` |
| BE-блокер / deploy-проба | трекинг `ticket-board` (`area=back`) + сверка `backend-status-sync` |

## Выход
Сводка приёмки спринта: сколько кандидатов закрыто в `done`, какие linked defects созданы/reused,
какие exact timed rechecks активны и где запрошен owner unblock; ссылка на `/board`.

## Проверка по platform impact (обязательное правило)

Shared/common responsive UI проверяется на desktop web и mobile web (~390px, `isMobile`). Общий файл или компонент сам по себе не создаёт Android/iPhone device gate.

- **Native device validation только для platform-specific scope.** Android-specific поведение, конфигурацию или runtime проверяй на Android; iOS-specific — на требуемом simulator/physical iPhone/TestFlight layer. Parity остаётся архитектурным инвариантом, а не требованием прогонять common/shared задачу на всех устройствах.
- **Evidence по shared/common UI:** desktop web + mobile web screenshots. Native screenshots нужны только для затронутой Android- или iOS-specific поверхности.
- **Запрещены web-only визуальные ветвления в мобильном вьюпорте:** serif-шрифты и hover-only элементы — только desktop (`!isMobile`); контент-элементы (чипы, бейджи, кнопки) не скрывать через `Platform.OS === 'web'`, если на устройстве они видны.
- **Темизация:** для тематических поверхностей только `useThemedColors()` — `DESIGN_TOKENS.colors.*` на native это статичный светлый fallback, на web — живые CSS-переменные.
- **Попапы/карточки точек на картах** — один общий компонент на всех страницах и платформах (различия — только добавочный функционал), компактный, вся информация видна без обрезания по X и Y.
