---
name: ticket-flow
description: "Прогон фронтенд-тикета через MCP task board: discovery → implement → review → test → release силами профильных FE-агентов. Триггеры: «возьми тикет в работу», «прогони задачу N по пайплайну»."
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
| refinement / BA | оркестратор: уточнить Goal/AC, при нехватке — `task-author` оформит детали; для App Store scope и Apple-требований — `ios-analyst` |
| architect (мобильный/платформенный scope) | `ios-architect` для iOS/shared границ и плана валидации |
| designer | `ios-designer` (HIG, safe area, скриншоты стора, паритет трёх поверхностей) |
| developer (FE) | `travel-expert`, `map-expert`, `metravel-seo-expert`, `refactor-surgeon`, `dev-loop` |
| developer (мобильный) | `android-expert` (Android/native), `ios-expert` (iPhone/iOS-платформа) |
| content / SEO | `travel-writer`, `metravel-seo-expert`, `index-doctor` |
| tester | `test-author` (Jest unit + Playwright e2e); устройство — `android-expert` (adb) и `ios-tester` (simulator/physical/TestFlight) |
| reviewer (гейт `review → testing`) | агент `code-review-gate` — ОБЯЗАТЕЛЕН, без его вердикта борд не пустит задачу в `testing` |
| reviewer (доп. фокус) | `/code-review`, `review-auditor` (углублённый аудит), `browser-reviewer` (видимые web-изменения) |
| reviewer (iOS-диффы) | `ios-reviewer` — независимый review-and-fix перед iPhone-тестированием |
| acceptance (приёмка спринта) | агент `board-reviewer` / skill `/sprint-review` — Done gate → `done` |
| releaser | preflight (`/preflight`) + `frontend-deployer` по явному target env; сторы — `android-publisher` (Google Play) и `ios-deployer` (TestFlight/App Store), каждый по отдельной явной команде владельца |

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
4. **Review — обязательный гейт, запускается сам.** Как только реализация готова и тикет
   переведён в `status=review`, PostToolUse-ветка хука `.claude/hooks/review-gate.mjs` требует
   немедленно вызвать агента `code-review-gate` — не жди просьбы пользователя и не откладывай
   на конец сессии (`/review-gate <id>` нужен только для повторного прогона). Он читает diff и
   ищет дубли существующих компонентов/хуков, неоптимальный код, противоречия правилам проекта
   и собственным контрактам, регрессии. Вердикт:
   - `changes_requested` (любой P1/P2) → агент сам возвращает тикет в `in_progress` с findings в
     `description`; чинит исполнитель, затем ревью прогоняется заново;
   - `pass` (чисто или только P3) → агент записывает вердикт, коммитит diff задачи ЯВНЫМИ
     путями и пушит его в `main` (`git add <пути задачи>` → `git commit` → `git push origin main`;
     `git add -A` и commit без путей в общем чекауте запрещены), дописывает sha коммита в
     `description` и только после этого переводит тикет в `testing`.

   Гейт принудительный и в обратную сторону: PreToolUse-ветка того же хука блокирует
   `metravel_task_update(status="testing")`, пока для тикета нет свежего вердикта `pass`; вердикт
   протухает, если код доправили после ревью. Углублённый аудит (`review-auditor`,
   `browser-reviewer`, `/review-security`) подключай дополнительно по фокусу задачи, он гейт не заменяет.
5. **Test / QA — тоже запускается сам.** Переход в `status=testing` (его делает гейт-агент)
   тем же хуком требует продолжить приёмку тем же проходом:
   - нужна развёрнутая среда для evidence → сначала выложи на dev (`/dev-deploy`, `dev-deployer`);
     прод-деплой, EAS и публикацию в стор без явной команды владельца не запускай;
   - делегируй `test-author` unit/e2e на новое поведение; видимые/web-изменения — ОБЯЗАТЕЛЬНО
     браузерная проверка (Playwright/preview), как требует CLAUDE.md;
   - вызови `board-reviewer` с id тикета: он сверяет Done gate реальными пробами и при завершении
     закрывает current acceptance в `done`. Подтверждённый отдельный дефект → `problem-memory`
     + create/reuse связанной bug/task через `ticket-board`; current acceptance не парковать.
     `testing` между turns допустим только для конкретного повторного замера с exact параметром,
     threshold/trigger и временем. Missing device/access/env/active gate → остановиться, запросить
     у владельца exact unblock и затем продолжить тот же acceptance без финального handoff.
   Назад в `review` из `testing` не возвращай: это заново поднимет код-ревью того же diff'а.
6. **Release.** Прод-деплой — только по явному запросу и target env: `/preflight` →
   `frontend-deployer`. Приёмка на dev не ждёт прода: FE закрывается в `done` с пометкой target env,
   а прод-выкладка при необходимости идёт отдельной release-задачей.
7. **Закрытие.** `ticket-board` дописывает в `description`: changed files, validation, reviewer,
   release-note. Если задача порождает новую (бэкенд-правка) — заведи её на борде `area=back`.
   Перед `done` сверяй `Done gate` из `Task Contract`: FE-задача с BE-зависимостью закрывается
   только после browser/API evidence против target env; BE-задача, разблокирующая FE, закрывается
   только после deploy-target smoke-пробы контрактного endpoint/field/event.

## Правила

- Каждый переход статуса отражается на борде — борд не должен отставать от реальности.
  Профильные FE-агенты (`travel-expert`, `map-expert`, `quest-expert`, `profile-expert`,
  `achievements-expert`, `android-expert`, `ios-expert`, `ios-designer`, `refactor-surgeon`,
  `test-author`) теперь САМИ
  держат WIP-статус своего тикета (`in_progress` в начале → `review` с evidence в конце) —
  у них есть board-инструменты `metravel_task_get/update/tasks_list/task_board` и протокол
  «Статус на борде». Оркестратор это подстраховывает: при batch/параллельной раздаче СНАЧАЛА
  переведи раздаваемые тикеты в `in_progress` (одним вызовом `ticket-board`), затем дай работу —
  чтобы WIP был виден, даже если агент не успел сам. Создание/структура новых тикетов и
  спринтов — по-прежнему ТОЛЬКО через `ticket-board`.
- **`review → testing` только через `code-review-gate`.** Ни оркестратор, ни исполнитель, ни
  `ticket-board` не ставят `testing` руками: хук `.claude/hooks/review-gate.mjs` откажет, и это
  правильно — сначала вердикт ревью. Аварийный обход `REVIEW_GATE_BYPASS=1` применим только по
  явной просьбе пользователя и фиксируется в `description` тикета.
- **В `testing` уходит только запушенный код.** Коммит явными путями + `git push origin main`
  выполняются ПОСЛЕ вердикта `pass` и ДО смены статуса: приёмка, dev-deploy и любая
  последующая проба берут код из `main`, а не из общего рабочего дерева. Коммит и push
  вердикт не ломают. Чужой набор в `npm run check:preflight:dry` → узкие проверки своих путей
  и `SKIP_PREFLIGHT=1 git push origin main` с пометкой в тикете. Протокол —
  `docs/TASK_BOARD_MCP.md` → «Коммит и пуш — часть перехода `review → testing`».
- **Ревью и приёмка — не «по требованию».** Их поднимает статус на борде: `review` → `code-review-gate`,
  `testing` → `board-reviewer`. Оба субагента запускаются автоматически board pipeline;
  «пользователь не просил ревью» не основание оставить тикет висеть в `review`/`testing`.
- `todo`/`in_progress` означают реальную оставшуюся implementation/refinement/ops работу;
  `testing` — только активную проверку или exact timed recheck, не парковку.
- Статус другой задачи на борде не является доказательством сам по себе. Если BE помечен `done`,
  но FE runtime-проба получает 404/не тот field/event, оформи отдельный linked defect через
  `problem-memory`/`ticket-board`; current acceptance не возвращай и не паркуй.
- Один тикет — один активный исполнитель. Не запускай конфликтующие правки одного файла.
- Не печатай секреты/токены. Деплой — только по явному target, не по умолчанию.

## Выход

Сводка: id тикета, путь по статусам (todo→…→done), кто что сделал (агенты), changed files,
результаты тестов/ревью/деплоя, ссылка на `/board`, и оставшиеся блокеры/порождённые задачи.

## Проверка по platform impact (обязательное правило)

Shared/common responsive UI проверяется на desktop web и mobile web (~390px, `isMobile`). Общий файл или компонент сам по себе не создаёт Android/iPhone device gate.

- **Native device validation только для platform-specific scope.** Android-specific поведение, конфигурацию или runtime проверяй на Android; iOS-specific — на требуемом simulator/physical iPhone/TestFlight layer. Parity остаётся архитектурным инвариантом, а не требованием прогонять common/shared задачу на всех устройствах.
- **Evidence по shared/common UI:** desktop web + mobile web screenshots. Native screenshots нужны только для затронутой Android- или iOS-specific поверхности.
- **Запрещены web-only визуальные ветвления в мобильном вьюпорте:** serif-шрифты и hover-only элементы — только desktop (`!isMobile`); контент-элементы (чипы, бейджи, кнопки) не скрывать через `Platform.OS === 'web'`, если на устройстве они видны.
- **Темизация:** для тематических поверхностей только `useThemedColors()` — `DESIGN_TOKENS.colors.*` на native это статичный светлый fallback, на web — живые CSS-переменные.
- **Попапы/карточки точек на картах** — один общий компонент на всех страницах и платформах (различия — только добавочный функционал), компактный, вся информация видна без обрезания по X и Y.
