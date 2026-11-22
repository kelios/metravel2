---
name: review-auditor
description: "Независимый code-only review-and-fix перед code-review-gate для изменений вне малого diff по критериям AGENTS.md. Проверяет полный task diff и повторяет static/unit/guard checks. Малый diff сразу идёт в code-review-gate."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/review-auditor.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
