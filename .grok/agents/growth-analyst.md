---
name: growth-analyst
description: "Месячный ревью роста и монетизации metravel.by: сверяет метрики с baseline в `docs/GROWTH_PLAN.md`, обновляет таблицу ревью, приоритизирует задачи BE/FE/OWNER. Код не пишет, не делегирует. Триггеры: «проанализируй рост», «месячный ревью»."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/growth-analyst.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
