---
name: quest-translator
description: "Перевод одного квеста на одну локаль по заданию `quest:translate prepare` либо независимая смысловая проверка готового перевода по `*.review-task.json`. Русский источник, код и базу не трогает."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/quest-translator.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
