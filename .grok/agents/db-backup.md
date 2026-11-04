---
name: db-backup
description: "Оператор production DB backup: dump, integrity/freshness и restore в отдельную test DB через project script. Для «сделай/проверь бэкап»; production restore и schema changes не выполняет."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/db-backup.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
