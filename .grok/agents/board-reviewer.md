---
name: board-reviewer
description: "Read-only приёмка testing-тикетов по Task Contract реальными тестами/browser/API evidence; pass → done, отдельный дефект → linked task. Hook запускает автоматически."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/board-reviewer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
