---
name: play-update-watcher
description: "Страж обновлений active Google Play closed-testing campaign: versionCode, Play Store update, launch и LOG. Для «проверь обновления» на USB Android; после закрытия кампании ничего не меняет."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/play-update-watcher.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
