# TASK-DRAFT-20261007-QUEST-CITY-DEDUPE: [BE-QUEST-L10N] Дубли городов квестов: «Гомель» (19 и 92), «Гродно» (11 и 91)

Status: Backlog
Owner: backend
Support: quest-editor
Created: 2026-10-07
Updated: 2026-10-07

> Временный fallback-черновик (`tasks/README.md`): борд недоступен из этой
> сессии. После восстановления доступа создать карточку `area=back`,
> `kind=bug`, `urgency=medium`, серия `QUEST-L10N`, связать с
> `tasks/draft-20261007-quest-l10n-ru-source-errors.md`, затем удалить файл.

## Простыми словами

Что сейчас: в базе квестов один и тот же город заведён дважды — «Гомель» как
quest-city 19 и 92, «Гродно» как 11 и 91. Квесты одного города разложены по двум
записям, поэтому посадочная города, сбор `accepted_names` для перевода
(«переводы других квестов того же города») и подборка «ещё квесты города»
видят только половину.
Как должно быть: один город — одна запись quest-city; квесты второй записи
перевешены на первую, вторая удалена; `POST /api/quest-cities/` не создаёт
дубль по имени.
Кого задевает: переводчиков (пустой `accepted_names`), игроков на посадочных
городов, авторов квестов.

## Goal

Объединить дубли quest-city и закрыть возможность создавать их заново.

## Context

Найдено при переводе квестов 07.10.2026: `GET /api/quests/by-quest-id/gomel-palace/`
→ `city.id = 19`, `gomel-kids-park-secrets` / `gomel-kids-lost-playbill` →
`city.id = 92`; `grodno-*` — 11 и 91. `SKILL.md` (принцип 1) давно
предупреждает: «`POST /api/quest-cities/` не дедупит по имени», а
universal-миграция дедупит только по точному имени.

## В чём проблема

Два `quest_city` с одинаковым `name` («Гомель»; «Гродно»). Квесты города
разнесены между записями. `collectAcceptedNames` (`scripts/quest-translate.js`)
фильтрует квесты по `Number(quest.city_id) === Number(bundle.city.id)` и не
видит переводы «второй половины» города.

## Из-за чего возникла

`POST /api/quest-cities/` принимает любое имя без проверки уникальности
(backend `quests/`), повторная миграция детских квестов создала второй город.
Точный файл/строка — установить в бэк-репо.

## Что блокирует

Ничего, можно брать в работу. Фронтовая карточка не блокируется: она
использует `city.id` как есть.

Source task:

- Source id: —
- Source path: `tasks/draft-20261007-quest-city-dedupe-back.md`

## Acceptance Criteria

- [ ] `GET /api/quest-cities/` не содержит двух записей с одинаковым
      нормализованным именем.
- [ ] Все квесты Гомеля отвечают одним `city.id`, все квесты Гродно — одним.
- [ ] `POST /api/quest-cities/` с именем существующего города возвращает
      существующую запись или 400, а не создаёт новую.
- [ ] Фронтовые URL квестов (`/quests/{cityId}/{quest_id}`) старого `cityId`
      ведут на тот же квест (редирект или alias), SSG-страницы городов не
      ломаются.

## Gherkin Tests

```gherkin
Feature: Один город — одна запись quest-city

  Scenario: Повторное создание города не плодит дубль
    Given quest-city «Гомель» уже существует
    When POST /api/quest-cities/ с name «Гомель»
    Then ответ содержит id существующей записи, новая запись не создана
```

## Task Contract

Scope: backend `quests/` (модель/сериализатор quest-city, миграция данных:
перевесить quest.city 92→19 и 91→11, удалить 92 и 91; уникальность имени).

User-visible result: на посадочной Гомеля и Гродно видны все квесты города;
`accepted_names` в задании перевода наполняется из всех квестов города.

Data/API contract: `quest_city.name` уникален (с нормализацией регистра/ё);
`POST /api/quest-cities/` идемпотентен по имени.

Platform impact: none (данные API).

Localization impact: none.

Dependencies: нет.

Fallback/mock policy: нет.

Validation: `curl -s https://metravel.by/api/quest-cities/ | jq '[.results[].name] | group_by(.) | map(select(length>1))'`
→ `[]`; `GET /api/quests/by-quest-id/gomel-kids-park-secrets/` → `city.id == 19`;
`npm run quest:translate -- prepare --quest=gomel-kids-park-secrets --locale=pl`
→ `accepted_names` непустой.

Regression control: уникальный индекс/валидация на бэке; тест сериализатора.

Done gate: AC зелёные на проде, фронтовые страницы городов открываются.

## Assignment

Primary owner: backend
Support agents: quest-editor (проверка посадочных и переводов)

## Likely Files Or Areas

- `../metravel-backend` → `quests/models.py`, `quests/serializers.py`,
  миграция данных

## Plan

1. Найти все дубли quest-city по нормализованному имени.
2. Перевесить квесты на старшую запись, удалить младшую (миграция данных).
3. Добавить уникальность имени и идемпотентный `POST`.
4. Проверить фронтовые URL со старым `cityId`.

Явно НЕ входит: правка контента квестов (фронтовая карточка).

## Validation

См. `Task Contract → Validation`.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-10-07: Created. Работа не начиналась.

## Results

Changed files: —

Validation evidence: —

Reviewer findings: —

Release notes: —

Blockers: —
