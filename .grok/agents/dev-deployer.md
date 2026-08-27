---
name: dev-deployer
description: "Деплой web frontend на dev 192.168.50.36 только через build-dev.sh. Для «задеплой/обнови dev» или dev 404/502; production, native builds и владельческую инфру не трогает."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/dev-deployer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
