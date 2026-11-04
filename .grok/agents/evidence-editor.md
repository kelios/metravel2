---
name: evidence-editor
description: "Монтирует существующие UI-записи через ffmpeg: cuts, таймкоды, privacy masks, source hashes и проверенный экспорт; приложение не управляет."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/evidence-editor.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
