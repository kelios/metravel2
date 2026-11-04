---
name: ios-architect
description: "Read-only iPhone architect: shared/iOS boundaries, Apple capabilities, dependencies, task slices, risks and simulator/device/TestFlight validation. Для design и release planning."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/ios-architect.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
