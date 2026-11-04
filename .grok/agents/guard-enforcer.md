---
name: guard-enforcer
description: "Проверяет назначенный guard и чинит доказанный механизм в его scope. Для конкретного guard failure; полный аудит — только по соответствующему запросу."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/guard-enforcer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
