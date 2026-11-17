---
name: growth-analyst
description: "Еженедельный «Дайджест роста» и месячное ревью metravel.by. Дайджест содержит 5 подтверждённых метрик, 3 находки и 3 вопроса владельцу. Триггеры: «дайджест роста», «проанализируй рост», «месячный ревью»."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/growth-analyst.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
