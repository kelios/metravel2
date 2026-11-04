---
name: code-review-gate
description: "Read-only code-review gate между review и testing: проверяет correctness, duplication, efficiency и project contracts; hook запускает его автоматически перед testing."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/code-review-gate.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
