---
name: ticket-flow
description: >-
  Прогон фронтенд-тикета через общий MCP task board MeTravel: взять задачу с борда
  (или завести), провести через discovery → implement → review → test → release силами
  профильных FE-агентов, двигая статус на борде на каждом шаге. Зеркалит ролевой пайплайн
  бэка (.codex/team). Триггеры: «возьми тикет в работу», «прогони задачу N по пайплайну»,
  «обработай очередь front todo».
---

# ticket-flow

Раннбук обработки одного фронтенд-тикета (`area=front`) через общий таск-борд. Борд —
единый источник правды (Django `task_board` на metravel.by), операции с ним — только через
агента **ticket-board** (MCP `metravel-task-board`). Этот скилл оркеструет; он сам код не
пишет — он раздаёт работу профильным агентам и отражает прогресс на борде.

Аргумент `$ARGUMENTS` — id тикета на борде, либо `next` (взять верхний `area=front status=todo`),
либо свободное описание новой задачи.

## ЖЕЛЕЗНОЕ ПРАВИЛО: взял задачу → сразу `in_progress`

Как только берёшь тикет в работу (любым способом: по id, `next`, из очереди, автономно «бери из todo»)
— ПЕРВЫМ действием переведи его `status=todo → in_progress` (+ `assignee`) через `ticket-board`,
ДО чтения кода и любых правок. Это касается и одиночной задачи, взятой без пайплайна: не прыгай
`todo → done`. Порядок статусов обязателен: `todo → in_progress → (review/testing) → done`.
Причина: борд — единственный источник WIP; пропущенный `in_progress` = невидимая работа и риск,
что кто-то возьмёт тот же тикет. Если делаешь несколько задач — переводи в `in_progress` ту,
что берёшь СЕЙЧАС (не весь батч авансом сверх реального WIP-лимита).

## Роли → реальные агенты (FE)

| Роль (как на бэке) | Исполнитель в этом репо |
|---|---|
| task-watcher / manager | агент `ticket-board` (борд: create/list/update/sync) |
| refinement / BA | оркестратор: уточнить Goal/AC, при нехватке — `task-author` оформит детали |
| developer (FE) | `travel-expert`, `map-expert`, `metravel-seo-expert`, `refactor-surgeon`, `dev-loop` |
| content / SEO | `travel-writer`, `metravel-seo-expert`, `index-doctor` |
| tester | `test-author` (Jest unit + Playwright e2e) |
| reviewer | `/code-review` или агент `review-auditor` |
| acceptance (приёмка спринта) | агент `board-reviewer` / skill `/sprint-review` — Done gate → `done` |
| releaser | preflight (`/preflight`) + `frontend-deployer` по явному target env |

Бэкенд-тикеты (`area=back`) этот скилл НЕ реализует — только заводит/трекает через
`ticket-board`; реализация в `../metravel-backend` (владелец/бэкендер).

## Шаги

1. **Подключение к борду.** Делегируй `ticket-board`: показать доску (`metravel_task_board`)
   и проверить активный спринт. Если борд недоступен — стоп, укажи на `docs/TASK_BOARD_MCP.md`
   (нужен `uv`, подтянутый бэк-репо и staff-токен). Не продолжай вслепую.
2. **Выбор/заведение тикета.**
   - id → `metravel_task_get`.
   - `next` → верхний `area=front`, `status=todo`.
   - свободное описание → дедуп, затем `metravel_task_create` (`area=front`, `reporter=frontend`,
     заголовок `[FE-…] …`, `description` с Goal/Context/AC и обязательным `Task Contract`
     из `docs/TASK_BOARD_MCP.md`). При нехватке проверяемых AC или контракта — ОДИН
     компактный уточняющий вопрос пользователю, не выдумывай критерии.
3. **In progress.** `ticket-board`: `status=in_progress`, `assignee=<агент-исполнитель>`.
   Делегируй реализацию профильному FE-агенту из таблицы. Соблюдай контракты CLAUDE.md
   (ImageCardMedia, UnifiedTravelCard, externalLinks, React Query/Zustand, TS strict).
4. **Review.** `/code-review` или `review-auditor` по diff. Подтверждённые находки —
   чинит исполнитель, цикл повторяется. На борде — `status=review`, evidence = вердикт ревью.
5. **Test / QA.** Делегируй `test-author`: unit/e2e на новое поведение. Видимые/web-изменения —
   ОБЯЗАТЕЛЬНО браузерная проверка (Playwright/preview), как требует CLAUDE.md. На борде —
   `status=testing` (QA-колонка перед приёмкой); приёмку закрывает `board-reviewer`/`/sprint-review`.
6. **Release.** Только по явному запросу и target env: `/preflight` → `frontend-deployer`
   (деплой строго через `scripts/fix-prod.sh`). На борде — `status=done` с changed files +
   validation evidence + (если деплой) прод-health. Без деплоя — `done` после зелёного
   review + локальной верификации, пометь «deploy pending».
7. **Закрытие.** `ticket-board` дописывает в `description`: changed files, validation, reviewer,
   release-note. Если задача порождает новую (бэкенд-правка) — заведи её на борде `area=back`.
   Перед `done` сверяй `Done gate` из `Task Contract`: FE-задача с BE-зависимостью закрывается
   только после browser/API evidence против target env; BE-задача, разблокирующая FE, закрывается
   только после deploy-target smoke-пробы контрактного endpoint/field/event.

## Правила

- Каждый переход статуса отражается на борде — борд не должен отставать от реальности.
  Профильные FE-агенты (`travel-expert`, `map-expert`, `quest-expert`, `profile-expert`,
  `achievements-expert`, `android-expert`, `refactor-surgeon`, `test-author`) теперь САМИ
  держат WIP-статус своего тикета (`in_progress` в начале → `review` с evidence в конце) —
  у них есть board-инструменты `metravel_task_get/update/tasks_list/task_board` и протокол
  «Статус на борде». Оркестратор это подстраховывает: при batch/параллельной раздаче СНАЧАЛА
  переведи раздаваемые тикеты в `in_progress` (одним вызовом `ticket-board`), затем дай работу —
  чтобы WIP был виден, даже если агент не успел сам. Создание/структура новых тикетов и
  спринтов — по-прежнему ТОЛЬКО через `ticket-board`.
- «Готово» только с доказательством (changed files + тест/браузер + review). До этого максимум
  `review`/`in_progress` с пометкой «verification pending».
- Статус другой задачи на борде не является доказательством сам по себе. Если BE помечен `done`,
  но FE runtime-проба получает 404/не тот field/event, FE остаётся `review`/`blocked_by`, а
  `ticket-board` дописывает blocker evidence.
- Один тикет — один активный исполнитель. Не запускай конфликтующие правки одного файла.
- Не печатай секреты/токены. Деплой — только по явному target, не по умолчанию.

## Выход

Сводка: id тикета, путь по статусам (todo→…→done), кто что сделал (агенты), changed files,
результаты тестов/ревью/деплоя, ссылка на `/board`, и оставшиеся блокеры/порождённые задачи.

## Паритет mobile web ↔ устройство (обязательное правило)

«Мобильная версия» = mobile web (~390px, `isMobile`) + Android + iOS ОДНОВРЕМЕННО: пользователь на всех трёх должен видеть один и тот же дизайн. Когда в задаче сказано «мобильный/mobile» — это всегда все три платформы сразу, не только web.

- **Эталон — устройство.** Android/iOS-приложение оттестировано и принято как образец: при любом расхождении mobile web правится под устройство, НЕ наоборот.
- **Верификация UI-правок — на обеих платформах со скринами:** web-превью 390px (`preview_resize` + `preview_screenshot`) И устройство/эмулятор (`adb exec-out screencap -p`; dev-client сидит на том же Metro — HMR обновляет обе стороны).
- **Запрещены web-only визуальные ветвления в мобильном вьюпорте:** serif-шрифты и hover-only элементы — только desktop (`!isMobile`); контент-элементы (чипы, бейджи, кнопки) не скрывать через `Platform.OS === 'web'`, если на устройстве они видны.
- **Темизация:** для тематических поверхностей только `useThemedColors()` — `DESIGN_TOKENS.colors.*` на native это статичный светлый fallback, на web — живые CSS-переменные.
- **Попапы/карточки точек на картах** — один общий компонент на всех страницах и платформах (различия — только добавочный функционал), компактный, вся информация видна без обрезания по X и Y.
