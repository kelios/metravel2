---
name: refactor-surgeon
description: "Behavior-preserving split god-файлов >800 LOC на компоненты/модули. Только по явному запросу; не меняет бизнес-логику, UI, API и не выполняет попутный bugfix."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/refactor-surgeon.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
