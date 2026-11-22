---
name: code-review-gate
description: "Проверяет полный frontend diff перед QA. Без тикета возвращает вердикт в чат; в цикле карточки фиксирует вердикт и выполняет переход review → testing после commit/push."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/code-review-gate.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
