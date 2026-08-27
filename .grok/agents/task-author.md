---
name: task-author
description: "Legacy/fallback редактор local tasks/*.md по шаблону. Только при недоступном board или explicit migration; обычное create/update задачи идёт через ticket-board."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/task-author.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
