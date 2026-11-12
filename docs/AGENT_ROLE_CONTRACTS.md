# Общие блоки ролей

Актуализировано: 2026-11-12 (#3277).

Здесь лежит текст, одинаковый для нескольких ролей `.claude/agents/*.md`. Роль
ссылается на нужный раздел и держит у себя только свои отличия. Копировать
раздел обратно в роль нельзя: это ловит
`__tests__/scripts/agent-role-shared-blocks.test.ts`.

Документ не вводит новых правил. Источники: борд — `docs/TASK_BOARD_MCP.md`,
платформы и стадии — `docs/RULES.md` и `docs/TESTING.md`, кейсы iOS —
`docs/MANUAL_TEST_CASES.md`. При расхождении действует источник.

## Статус на борде (WIP-видимость)

Для ролей-исполнителей: `achievements-expert`, `android-expert`, `map-expert`,
`profile-expert`, `quest-expert`, `refactor-surgeon`, `travel-expert`.

Раздел включается, только когда роли передали id тикета («возьми #573» /
«почини #545»); без id борд не трогай вообще. Статусные детали и исключения —
`docs/TASK_BOARD_MCP.md`.

- **ДО первой правки кода:** `metravel_task_update` → `in_progress` плюс `assignee` = имя твоего агента. MCP-схемы борда подгружай через `ToolSearch` (`select:mcp__metravel-task-board__metravel_task_update,...`).
- **После работы:** → `review`, а в `description` допиши evidence: корень проблемы, изменённые файлы (`path:line`), пройденные code-level checks, exact runtime-QA handoff для `testing`. `done` сам НЕ ставишь.
- **Review handoff:** полный task diff → агенту `code-review-gate` через родителя, разрешения не спрашивай. Commit, push и переход `review → testing` — по `docs/TASK_BOARD_MCP.md` → «Коммит и пуш — часть перехода `review → testing`». Findings возвращают тикет исполнителю в `in_progress`.
- **Блокер** (нужен бэк / нет данных / не воспроизводится) → `blocked_by` + короткая причина в `description`. НОВЫЕ и связанные тикеты/спринты заводит только агент `ticket-board`, сам не создавай.
- **Один тикет — один исполнитель:** чужие статусы и описания не трогай.
- **Борд не отвечает** — не блокируйся: сделай работу и явно напиши в ответе «борд не обновлён, нужен ticket-board».

## Проверка по platform impact

Для тех же ролей-исполнителей и `dev-loop`.

Правило целиком — `docs/RULES.md` → «UI rules» (parity, web-only ветвления,
темизация, контракт карточки точки) и «Development workflow» (стадии device QA).
Без открытия документа:

- Матрица проверок — `docs/TESTING.md` → «Risk-based validation and evidence reuse»: shared-логику проверяй один раз, responsive/UI-изменения — mobile web first + desktop.
- Native QA в `testing` нужен для отличающейся реализации/поведения; выбери релевантный эмулятор/симулятор, physical/release слой — по capabilities.
- В мобильном вьюпорте нет web-only визуальных ветвлений; темизация тематических поверхностей — через `useThemedColors()`, не `DESIGN_TOKENS.colors.*`.

## Слои доказательств iOS

Для ролей `ios-analyst`, `ios-architect`, `ios-designer`, `ios-expert`,
`ios-reviewer`. Слой каждого кейса `IOS-*` задаёт таблица в
`docs/MANUAL_TEST_CASES.md` → «iPhone/iPad simulator / physical device /
TestFlight»; здесь — что каждый слой способен доказать.

| Слой | Поведение и capabilities | Визуал и HIG |
| --- | --- | --- |
| simulator | сборка и старт без red screen, базовый UI и навигация, пять локалей, детерминированные loading/error-состояния | раскладка и иерархия, действия, светлая и тёмная тема, пять локалей, состояния loading/empty/error, отсутствие обрезания на длинных строках |
| физический iPhone | camera/photo/HEIC, Keychain и сессия после холодного рестарта, биометрия, реальные safe area, Universal Links, sharing и экспорт, ветви allow/deny/restricted у permissions, APNs | safe area под реальной чёлкой и home indicator, клавиатура и её перекрытия, системные диалоги permissions, Dynamic Type и VoiceOver на устройстве, реальное ощущение тач-таргетов |
| exact processed TestFlight build | production-origins и signing, чистая установка/апдейт, Apple-логин, доставка APNs, видимость удаления аккаунта, crash/hang-матрица | скриншоты App Store и совпадение визуала с production-конфигурацией; скриншоты снимаются с реального билда, без мок-данных и персональных данных |

- Simulator необходим, но недостаточен: перечисленное в строках физического
  iPhone и TestFlight симулятором не доказывается.
- Строка TestFlight — единственное доказательство перечисленного в ней.
- Runtime-слои собираются в `testing` после review. До review доказываются
  только source/config, focused tests и guards.
