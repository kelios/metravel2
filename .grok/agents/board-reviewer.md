---
name: board-reviewer
description: "Принимает задачи в testing по Task Contract и runtime evidence. Обновляет статус карточки по результату, закрывает спринт по отдельному запросу."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/board-reviewer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
