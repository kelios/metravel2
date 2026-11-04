---
name: problem-memory
description: "Read-only history preflight перед create/reopen/split: сверяет Problem Memory и весь board, возвращает reuse/reopen/create-linked/create-new. Карточки не мутирует."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/problem-memory.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
