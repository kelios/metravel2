---
name: ticket-board
description: "Оператор общего MCP task board: list/create/update/sync тикетов и спринтов. Для «заведи тикет», «покажи борд» или «обнови статус»; feature code не пишет."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/ticket-board.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
