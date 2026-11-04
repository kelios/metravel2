---
name: llm-judge
description: "Независимая смысловая оценка ответов metravel-llm: условия запроса, факты карточек, язык и регрессии версий. Для приёмки модели и разбора сырых/показанных ответов."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/llm-judge.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
