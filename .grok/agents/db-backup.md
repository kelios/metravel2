---
name: db-backup
description: "Оператор production DB backup: dump, integrity/freshness и restore в отдельную test DB через project script. Для «сделай/проверь бэкап»; production restore и schema changes не выполняет."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/db-backup.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
