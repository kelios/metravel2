# TASK-YYYYMMDD-NNN: Short Title

Status: Backlog
Owner: Manager
Support: Developer, Tester, Reviewer, Releaser
Created: YYYY-MM-DD
Updated: YYYY-MM-DD

## Простыми словами

Обязательный первый блок, по-русски и без терминов — 2–5 предложений для человека,
который не читает код. Правило: `docs/TASK_BOARD_MCP.md` → «Правило: описание задачи —
по-русски и человеческим языком».

Что сейчас:
Как должно быть:
Кого задевает:

## Goal

Желаемый результат в одном-двух предложениях: что и зачем.

## Context

Фон, запрос пользователя, ссылки, файлы, ограничения, результаты проб.

## В чём проблема

Подробно и фактами: где, при каких условиях, что именно ломается, что видно глазами и
в логах. Для фичи — какая задача пользователя сейчас не решается.

## Из-за чего возникла

Корневая причина: файл:строка, контракт, конфиг, регрессия от конкретного изменения.
Не установлена — так и напиши, перечислив проверенные гипотезы. Догадку фактом не подавай.

## Что блокирует

id блокера, чего ждём и что произойдёт, когда снимется. Ничего не блокирует — «ничего,
можно брать в работу». При импорте на борд раздел обязан совпасть с `blocked_by`/`depends_on`.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Gherkin Tests

```gherkin
Feature: Short feature name

  Scenario: Expected behavior
    Given relevant initial state
    When the user or system action happens
    Then the expected outcome is observable
```

## Task Contract

Scope:

User-visible result:

Data/API contract:

Platform impact:

Localization impact:

Dependencies:

Fallback/mock policy:

Validation:

Regression control:

Done gate:

## Assignment

Primary owner:
Support agents:

## Likely Files Or Areas

- `path/or/module`

## Plan

Он же «Что должно быть сделано» при импорте на борд: нумерованные проверяемые шаги
и отдельной строкой то, что явно НЕ входит.

1. Шаг один.
2. Шаг два.

Явно НЕ входит:

## Validation

Он же «Как протестировать»: сначала пошаговый сценарий для человека (открыть такой-то
адрес/экран → сделать то-то → увидеть то-то), затем точные команды и пробы.
Для задач про величину указывай измеряемое значение, а не только команду.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

Он же «Что уже сделано»: строка на каждый шаг — что сделано и чем подтверждено.
Обновляется при каждом переходе статуса, а не в конце.

- YYYY-MM-DD: Created.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
