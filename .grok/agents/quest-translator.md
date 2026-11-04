---
name: quest-translator
description: "Перевод одного квеста на одну локаль по заданию `quest:translate prepare` либо независимая смысловая проверка готового перевода по `*.review-task.json`. Русский источник, код и базу не трогает."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/quest-translator.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
