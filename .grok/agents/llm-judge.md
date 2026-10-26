---
name: llm-judge
description: "Независимая смысловая оценка ответов metravel-llm: условия запроса, факты карточек, язык и регрессии версий. Для приёмки модели и разбора сырых/показанных ответов."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/llm-judge.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
