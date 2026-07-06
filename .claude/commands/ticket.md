---
description: Прогнать фронтенд-тикет через общий MCP task board (discovery→implement→test→review→release). Аргумент — id задачи, `next`, или описание новой.
---

Запусти скилл **ticket-flow** для обработки фронтенд-тикета через общий таск-борд MeTravel.

`$ARGUMENTS`:
- число / `[FE-…]` / `[TASK-…]` — id или ключ существующего тикета на борде;
- `next` — взять верхний `area=front`, `status=todo`;
- свободный текст — завести новый тикет и прогнать по пайплайну.

Следуй раннбуку скилла `ticket-flow`: операции с бордом — только через агента `ticket-board`
(MCP `metravel-task-board`), реализация/тесты/ревью/релиз — профильными FE-агентами. Если
борд недоступен — укажи на `docs/TASK_BOARD_MCP.md` и не продолжай вслепую.

**Взял задачу → СРАЗУ `status=in_progress` (+`assignee`), до правок кода.** Никаких
`todo → done` напрямую даже для одиночной задачи. Порядок: `todo → in_progress → review/testing → done`.

Аргументы: `$ARGUMENTS`
