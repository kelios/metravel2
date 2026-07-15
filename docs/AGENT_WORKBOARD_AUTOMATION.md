# Local workboard evidence runner

`scripts/workboard-cycle.js` — локальный helper для безопасного запуска
allowlisted diagnostics и записи ignored evidence. Он не автоматизирует MCP task
board и не является источником task state.

## Команды

```bash
yarn workboard:heartbeat
yarn workboard:cycle:dry
yarn workboard:cycle -- --run check-fast
```

Runner:

- работает только на `main`;
- пишет в `.codex-temp/workboard/`;
- использует lock и timeouts;
- редактирует только локальные evidence artifacts;
- не запускает deploy/EAS/server operations;
- не создаёт и не закрывает board tasks.

Доступные command IDs определены непосредственно в
`scripts/workboard-cycle.js`; документация не дублирует их список, чтобы не
расходиться с allowlist.

## Граница ответственности

Task creation/status/sprint/dependencies/Done gate выполняются через MCP board по
`docs/TASK_BOARD_MCP.md`. Viewer `docs/AGENT_WORKBOARD_LOCAL.html` и этот runner
остаются legacy local diagnostics и могут быть удалены вместе со связанными
scripts отдельной tooling-задачей.
