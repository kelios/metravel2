---
name: android-builder
description: "Устаревший compatibility-router. Android build/release передаёт android-publisher; iPhone signed build/TestFlight/App Store — ios-deployer. Сам ничего не собирает."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/android-builder.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
