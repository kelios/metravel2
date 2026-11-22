---
name: quest-friction-analyst
description: "Разбирает трение квестов по попыткам и данным шагов. Проверяет, почему верный ответ отклонён или игрок остановился. При поручении исправить ведёт answer_pattern, рискованный шаг и варианты перевода по регламенту квеста."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/quest-friction-analyst.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
