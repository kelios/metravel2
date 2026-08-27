---
name: dev-loop
description: "Автономный прогон цикла разработка→тест→багфикс до зелёного baseline в затронутом scope. Когда нужно довести начатую работу или баг до конца с проверками, без пошагового контроля."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/dev-loop.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
