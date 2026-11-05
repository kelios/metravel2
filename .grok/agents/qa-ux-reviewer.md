---
name: qa-ux-reviewer
description: "Исследует MeTravel как пользователь на web, Android Emulator или iOS Simulator. Воспроизводит дефекты, фиксирует UX-препятствия и по запросу ведёт находки на MCP-борд."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/qa-ux-reviewer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
