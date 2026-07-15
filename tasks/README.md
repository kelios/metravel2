# Local task fallback

Источник правды о задачах — общий MCP task board. Новые frontend/backend задачи
создаются через `$metravel-ticket-board` в текущем активном sprint и проходят
`$metravel-task-contract`.

Каталог `tasks/` не хранит постоянный backlog. В нём остаётся только
`000-template.md` как fallback-форма для временного draft, когда token refresh и
MCP/API board действительно недоступны.

## Правила fallback

1. При `HTTP 401` сначала обновить staff token по `docs/TASK_BOARD_MCP.md` через
   credentials из `.env.e2e`, не выводя значения.
2. Создавать локальный файл только если повторный board access не получен.
3. Заполнить все секции `000-template.md`, особенно Task Contract, area,
   dependencies, validation и Done gate.
4. После восстановления доступа импортировать/создать задачу на board в active
   sprint и удалить локальный draft.

Допустимые board areas: `front` и `back`. Android/iOS/native задачи относятся к
`front` и получают платформенный контекст в title/description; server/API/Django
задачи относятся к `back`.

См. `docs/TASK_BOARD_MCP.md`, `docs/CODEX.md` и
`.codex/skills/metravel-task-contract/SKILL.md`.
