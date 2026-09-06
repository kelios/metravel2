---
name: "source-command-preflight"
description: "Полная preflight-проверка перед push"
---

# source-command-preflight

Use this skill when the user asks to run the migrated source command `preflight`.

## Command Template

Выбери code-level или полный preflight по стадии задачи и
`docs/WORKFLOW_OPERATIONS.md` → «3.4 Координация долгих операций».

1. Проверь `main`, `git status --short` и task-owned paths; сохрани чужие изменения.
2. До завершения code review выполняй только static/unit/guard checks. При push
   в рамках перехода `review → testing` используй `PREFLIGHT_SKIP_E2E=1` по
   `docs/TASK_BOARD_MCP.md` → «Коммит и пуш — часть перехода `review → testing`».
3. Полный `npm run check:preflight` с runtime/e2e запускай в `testing` после review
   и operation gate. Перед первой локальной пробой выполни процедуру обновления
   бэкенда из `docs/WORKFLOW_OPERATIONS.md` → «3.0 Локальный стек и обновление
   бэкенда перед тестированием».
4. Исправляй подтверждённую причину в task scope; code changes возвращаются на
   review. Не используй `--no-verify` для обхода.

По завершении кратко отчитайся: что прошло, что упало, что починил.
