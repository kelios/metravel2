## Context

Мотивация — `proposal.md`. Аудит #2829 подтвердил три механизма:

- producers `.claude/agents/task-author.md:134` и `ticket-board.md:146`
  превращают `Platform impact` в обязательный прогон каждой поверхности;
- downstream `dev-loop`/native testers принимают старую матрицу до решения о
  её достаточности, а adapters рано загружают native-процедуры;
- legacy `review-uiux:70–82` добавляет device fallback и native comparison к
  каждой web-проверке. Этот skill в инциденте не загружался: это отдельный
  подтверждённый латентный конфликт, а не выдуманная причина текущего запуска.

`docs/TESTING.md` уже ограничивает shared-проверки; `audit:prompts` проверяет
metadata/mirrors, но пропускает эти противоречия. Дополнительно действующий
OpenSpec context требует paired mobile-web/Android controls и полный reread
документов — это ещё один активный источник расширения scope.

## Goals / Non-Goals

Goals: один canonical admission gate и короткие ссылки из подтверждённых
producers/executors; проверка известных регрессий в существующем prompt audit.
Non-Goals: новая система планирования тестов, переписывание здорового каталога,
проверки приложения/устройств и правки backend или release budgets.

## Decisions

1. Gate размещается в `docs/TESTING.md` внутри risk-based раздела. Запись:
   `changed contract → assertion → required checks/targets → reused evidence →
   omitted targets/reason → retest trigger`. Учитывается весь ещё не принятый
   task-owned change, включая committed части, а не только последний dirty hunk.
2. Сначала выбирается target, затем его runbook/readiness/stamp/build. Старый
   Task Contract уточняется по evidence, а действующий явный full-QA/release
   запрос сохраняется. Необоснованное назначение tester возвращает исполнителю
   до любых устройств/сборок.
3. Удаляются прямые blanket clauses; adapters только делегируют роли. Матрица
   не копируется в каждый skill. Уже корректные shared/global compatibility
   skills остаются без изменений.
4. Существующий audit расширяется локальным правилом canonical references и
   известных запрещённых формулировок. Mutation fixtures возвращают исходные
   регрессии и проверяют реальную ошибку аудита. Исторические OpenSpec change
   artifacts не сканируются как действующие инструкции.

Отвергнуты копирование всей матрицы в 20 prompts и новый универсальный planner:
оба варианта создают второй источник истины и не устраняют приоритет старой
карточки перед текущим diff.

## Risks / Trade-offs

- Неправомерное сужение обязательного release gate → явное исключение для
  текущего запроса пользователя и сценарий native-specific/release.
- Guard проверяет ограниченное семейство drift, а не смысл любого текста →
  независимое смысловое review шести сценариев spec и честная граница результата.
- Generated mirrors могут расходиться → правятся только источники, затем sync
  и metadata/skill validators.
- В общем checkout есть чужие #2738/#2733 изменения → explicit owned paths,
  никакого их отката/коммита и quality gate только после handoff.

## Migration Plan

Обновить canonical gate/producers/executors, синхронизировать зеркала, проверить
fixtures и validators, провести independent review. App/runtime/deploy не
нужны: Platform impact и Localization impact — none. Откат ограничен путями
этого governance change и его generated mirrors.
