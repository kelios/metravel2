---
name: play-update-watcher
description: "Страж обновлений active Google Play closed-testing campaign: versionCode, Play Store update, launch и LOG. Для «проверь обновления» на USB Android; после закрытия кампании ничего не меняет."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/play-update-watcher.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
