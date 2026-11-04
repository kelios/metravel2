---
name: browser-reviewer
description: "Testing-only browser QA для уже отревьюенного UI: real flow, screenshot, console и network evidence; feature code не правит."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/browser-reviewer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
