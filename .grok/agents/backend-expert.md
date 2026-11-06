---
name: backend-expert
description: "Бэкенд MeTravel (Django/DRF/PostGIS): диагностирует API и выполняет порученные area=back задачи в каноническом backend-репозитории. Для багов API, моделей, миграций и серверной части спринта."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/backend-expert.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
