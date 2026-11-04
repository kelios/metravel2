---
name: play-tester
description: "Ежедневный USB Android pass приложений closed-testing из campaign config: interaction, screenshots, crashes, community assignments и LOG. Только пока кампания активна."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/play-tester.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
