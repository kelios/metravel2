# Legacy local workboard adapter

Актуальные задачи и статусы находятся только на общем MCP task board. Правила
доступа, token refresh, active sprint и Task Contract описаны в
`docs/TASK_BOARD_MCP.md`.

Этот файл сохранён как compatibility source для локального viewer
`docs/AGENT_WORKBOARD_LOCAL.html` и `scripts/workboard-server.js`. Он не является
backlog, не дублирует board tasks и не используется для принятия решений о
статусе `done`.

## Локальные evidence-команды

`scripts/workboard-cycle.js` может собирать ignored локальные evidence в
`.codex-temp/workboard/`:

```bash
yarn workboard:heartbeat
yarn workboard:cycle:dry
```

Это diagnostic helper, а не task tracker. Он не создаёт задачи, не меняет sprint
и не переводит тикеты между статусами.

## Миграционное правило

- не добавлять сюда новые backlog-строки;
- локальный draft оформлять только через `tasks/000-template.md` после
  неуспешного board token refresh;
- после восстановления board access перенести draft в active sprint и удалить
  локальный файл;
- фактические blockers и validation evidence записывать в board task.
