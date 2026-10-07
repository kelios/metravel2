# TASK-20261007-001: `quest:translate sweep` — волна перевода одной командой

Status: Review
Owner: Manager
Support: Developer, Tester, Reviewer, Releaser
Created: 2026-10-07
Updated: 2026-10-07

Локальный draft по правилу fallback (`tasks/README.md`): MCP task board в сессии
07.10.2026 не подключился (`CONNECTION_CLOSED`). После восстановления доступа
завести карточку на борд в активный спринт (`area=front`, `kind=task`, серия
QUEST-L10N, связь с #2199) и удалить этот файл.

## Простыми словами

Квесты переводят на четыре языка волнами по десять квестов. Сейчас для каждой из
сорока пар «квест + язык» человек запускает проверку и публикацию отдельно и сам
помнит, что уже готово, что ждёт проверяющего, а что отклонено. Нужна одна
команда, которая проходит всю волну, публикует готовое и показывает состояние
остальных пар одной строкой на пару.

Что сейчас: 40 ручных запусков `check` и `upload --publish` на волну плюс учёт в
голове или во временном скрипте, который не сохранился.
Как должно быть: `sweep` принимает список квестов, публикует готовые пары и
печатает состояние каждой пары; `--json` для скриптов.
Кого задевает: оператора перевода квестов и агентов-переводчиков; игроки видят
переводы раньше и без пропусков.

## Goal

Подкоманда `sweep` в `scripts/quest-translate.js`: одна волна — один запуск, с
корректной классификацией устаревшего вердикта и пропуском уже опубликованных
пар. Заодно переводчик и проверяющий получают недостающие данные в заданиях.

## Context

- Серия QUEST-L10N (#2199): конвейер `prepare → перевод → check → смысловая
  проверка → upload`, одна пара за запуск.
- Сессия 07.10.2026 закрывала волну временным `.codex-temp/quest-translations/sweep.sh`
  (каталог игнорируется git, скрипт не сохранился).
- `scripts/` — защищённая зона по AGENTS.md, поэтому изменение идёт карточкой.

## В чём проблема

1. На волну 10 × 4 оператор вручную выполняет до 80 команд и ведёт учёт состояний сам.
2. После `prepare --force` старый `<id>.review.json` остаётся, и `mergeReview`
   красит каждый шаг как «вердикт вынесен по другой версии» — это выглядит как
   отказ проверяющего, хотя нужна лишь повторная проверка.
3. Переводчики ищут подписи кнопок визарда «Далее» и «Проверить ответ» по i18n
   сами: в `ui_labels` попадают только подписи, названные в тексте в «ёлочках».
4. Проверяющий у шагов `range`/`approx` получает пустой `accepted_answers` и не
   может оценить достижимость числа.

## Из-за чего возникла

- `scripts/quest-translate.js`: каждая подкоманда рассчитана на одну пару
  `--quest --locale`; пакетного режима нет.
- `scripts/lib/questTranslation/checks.js`, `mergeReview`: несовпадение
  `translation_sha256` с текущим хешем отдаёт отказы с текстовой причиной, а
  отдельного состояния «устарел» нет.
- `scripts/lib/questTranslation/task.js`, `collectUiLabels`: подписи берутся
  только из цитат текста.
- `scripts/lib/questTranslation/task.js`, `sourceStepFromBundle`: у не-exact
  типов `answer_pattern.value` в снимок источника не попадает.

## Что блокирует

Ничего, можно брать в работу.

Source task:

- Source id: —
- Source path: `tasks/draft-20261007-quest-translate-sweep.md`

## Acceptance Criteria

- [ ] `sweep <quest_id>…` и `sweep --from-next <n>` проходят каждую пару
      «квест + целевая локаль» и печатают строку на пару; `--json` отдаёт
      `pairs[]`, `summary`, `failed`.
- [ ] Состояния: `no_task`, `awaiting_translation`, `struct_fail` (с причинами),
      `needs_review`, `review_refused` (с причинами), `upload_failed`, `error`,
      `published`.
- [ ] Зелёные структурные и смысловая проверки → публикация той же логикой, что
      `upload --publish`.
- [ ] Устаревший вердикт (другая версия перевода или источника) → `needs_review`,
      не `review_refused`.
- [ ] Опубликованная на сервере пара с тем же содержимым пропускается без записи.
- [ ] Ненулевой выход при `struct_fail` / `review_refused` / `upload_failed` и при
      пустой выборке `--from-next`.
- [ ] `ui_labels` задания всегда содержат «Далее» и «Проверить ответ».
- [ ] В `review-task` у шагов `range`/`approx` есть `answer_rule`.
- [ ] Тесты в `__tests__/scripts/`, таблица конвейера в
      `docs/QUEST_TRANSLATION_GUIDE.md` обновлена.

## Gherkin Tests

```gherkin
Feature: Волна перевода квестов одной командой

  Scenario: Готовая пара публикуется, остальные получают состояние
    Given у квеста на pl есть задание, перевод и зелёный вердикт
    And на en есть задание и перевод без вердикта
    And на be есть только задание, на uk ничего нет
    When оператор запускает sweep <quest_id> --json
    Then пара pl опубликована одним PUT
    And en — needs_review, be — awaiting_translation, uk — no_task
    And код выхода нулевой

  Scenario: Старый вердикт после повторного перевода
    Given вердикт вынесен по прежней версии перевода
    When оператор запускает sweep
    Then пара показана как needs_review, записи нет
```

## Task Contract

Scope: `scripts/quest-translate.js`, `scripts/lib/questTranslation/{checks,task}.js`,
`__tests__/scripts/questTranslate*.test.ts`, `docs/QUEST_TRANSLATION_GUIDE.md`,
`.claude/agents/quest-translator.md`.

User-visible result: оператор запускает `npm run quest:translate -- sweep …` и
получает отчёт по всем парам волны; готовые пары опубликованы.

Data/API contract: без изменений API. Те же `GET /api/quests/translations/status/`,
`GET/PUT /api/quests/{id}/translations/{locale}/`. Файл задания получает поле
`source.steps[].answer_rule`, review-task — `steps[].answer_rule`.

Platform impact: none (ops CLI, Node).

Localization impact: none в приложении; задание переводчику дополняется подписями
кнопок из существующих i18n-строк всех локалей.

Dependencies: нет.

Fallback/mock policy: тесты против локального HTTP-стаба admin-API; к проду не ходят.

Validation:
- `npx jest --runInBand __tests__/scripts/questTranslateCli.test.ts __tests__/scripts/questTranslateChecks.test.ts`
- `npx jest --runInBand __tests__/scripts/questCliContract.test.ts __tests__/scripts/guard-cli-contract.test.ts`
- `node scripts/guard-cli-contract.js`
- `npx eslint --max-warnings=0 scripts/quest-translate.js scripts/lib/questTranslation/*.js __tests__/scripts/questTranslate*.test.ts`
- `npm run audit:prompts`

Regression control: существующие сценарии `prepare/check/upload/next/status`
покрыты теми же тестами; `upload` использует общее ядро записи.

Done gate: тесты и guard зелёные; на проде волна `sweep` по реальным артефактам
даёт ожидаемые состояния и публикует только зелёные пары (проверка оператором с
токеном администратора на следующей волне).

## Assignment

Primary owner: quest-expert
Support agents: test-author, review-auditor, code-review-gate

## Likely Files Or Areas

- `scripts/quest-translate.js`
- `scripts/lib/questTranslation/checks.js`
- `scripts/lib/questTranslation/task.js`
- `__tests__/scripts/questTranslateCli.test.ts`
- `__tests__/scripts/questTranslateChecks.test.ts`
- `docs/QUEST_TRANSLATION_GUIDE.md`
- `.claude/agents/quest-translator.md`

## Plan

1. Вынести из `next` выборку квестов (`selectPending`), из `upload` — ядро записи
   (`uploadEvaluated`); добавить `reviewState` в `checks.js`.
2. Реализовать `sweep`: список или `--from-next`, статус с сервера одним запросом,
   классификация пары, публикация зелёных, отчёт текстом и `--json`,
   `requireNonEmptySelection` / `requireNoBatchFailures`.
3. `collectUiLabels`: всегда добавлять кнопки карточки шага.
4. `sourceStepFromBundle` / `buildReviewTask`: `answer_rule` для `range`/`approx`.
5. Тесты, гайд, промпт агента.

Явно НЕ входит: `--dry-run` для `sweep`, перевод текста, изменения API бэкенда,
автоматический запуск агентов из скрипта.

## Validation

Сценарий для человека: подготовить волну (`prepare` на несколько пар, часть
перевести и проверить), запустить `npm run quest:translate -- sweep <id>…` →
увидеть строку на каждую пару с состоянием → убедиться, что опубликованы только
пары с зелёным вердиктом, а пара со старым вердиктом помечена `needs_review`.

Команды — см. `Validation` контракта.

## Release Checklist

- [x] Changed files are listed in `## Results`.
- [x] New files created by this task are identified.
- [x] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [x] Skipped files and release blockers are recorded.

## Progress Log

- 2026-10-07: Created; реализация, тесты, гайд — тесты, guard cli-contract,
  eslint, audit:prompts зелёные.
- 2026-10-07: `review-auditor` — 2 findings исправлены (пара без задания при
  полном опубликованном переводе → `published`; битый `review.json` → отказ
  пары), 1 открытый закрыт сверкой задания с текущим источником
  (`sourceDigest`). `code-review-gate` — 2 findings исправлены (сверка
  источника до `awaiting_translation`; отказ одной пары → состояние `error`,
  волна и отчёт не прерываются). Тесты 4 наборов зелёные.

## Results

Changed files: см. «Likely Files Or Areas»; новый файл — этот draft.

Validation evidence: `jest` 4 набора зелёные (`questTranslateCli`,
`questTranslateChecks`, `questCliContract`, `guard-cli-contract`),
`guard-cli-contract` passed, eslint 0 warnings, `audit:prompts` passed.

Reviewer findings: см. Progress Log; остаточный риск — семантика PUT на бэке
(обновление `source_hash` при записи того же текста) не проверена статически:
`../metravel-backend` в сессии недоступен, проверяется на проде первой волной.

Release notes: ops CLI, прод-выкат фронтенда не требуется.

Blockers: MCP task board недоступен из сессии — карточка не заведена, этот draft
её заменяет до импорта.
