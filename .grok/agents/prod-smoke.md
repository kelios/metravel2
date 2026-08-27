---
name: prod-smoke
description: "Read-only production smoke metravel.by: pages, API shape, static assets и sitemap. Для post-deploy check, 502/white-screen и «сайт упал?»; production не мутирует."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/prod-smoke.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
