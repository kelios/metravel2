# Claude project entrypoint

В начале задачи загрузи `AGENTS.md`, если его ещё нет в контексте. Он задаёт
границы, preflight, полномочия и порядок сдачи. Детали загружай по задаче,
отдельными разделами.

Карта «задача → что открыть»:

| задача | документ |
| --- | --- |
| triage, выбор skill, матрица проверок | `docs/CODEX.md` (нужный раздел) |
| глубина разбора задачи, доказательства, формат отчёта | `docs/AGENT_ANALYSIS_PROTOCOL.md` |
| ожидаемое поведение фичи (источник истины для постановки) | `docs/features/<фича>.md` |
| технические правила: UI, workflow, localization | `docs/RULES.md` (нужный раздел) |
| правка nginx: CSP, заголовки, кэш, редиректы (всегда backend-owned) | `docs/RULES.md` → «Nginx config ownership» |
| локальный стек, обновление бэкенда перед тестированием, e2e-доступы, тестданные на проде, Android/iPhone devices, prod-baseline, долгие операции и locks | `docs/WORKFLOW_OPERATIONS.md` |
| каталог `$metravel-*` skills (Codex) | `docs/CODEX_SKILLS.md` |
| Grok Build: agents/hooks/skills adapter | `docs/GROK.md` |
| борд, Task Contract, формат описания задачи | `docs/TASK_BOARD_MCP.md` |
| повторяющиеся проблемы перед заведением карточки | `docs/PROBLEM_MEMORY.md` |
| всё остальное | найти файл в `docs/INDEX.md` |

Для независимой роли передавай scope, пути и проверяемые артефакты. Используй
итог агента и точечные логи. Полный scratchpad-транскрипт открывай только для
разбора конкретного сбоя. Для браузера сначала бери текст или accessibility
tree. Скриншоты нужны для визуальной проверки и evidence.

`.claude/skills/` и выбранные `.claude/commands/` служат источником
`.agents/skills/`. После правки источника запускай `npm run sync:agent-skills`.
Роли из `.claude/agents/` используются адаптерами Codex и Grok.
Хуки в `.claude/hooks/` проверяют контракт карточки и переходы борда.
