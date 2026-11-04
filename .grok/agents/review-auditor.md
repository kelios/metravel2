---
name: review-auditor
description: "Независимый code-only review-and-fix полного metravel task diff: correctness, duplication, complexity, reuse, performance и contracts. Исправляет findings и повторяет static/unit/guard checks."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/review-auditor.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
