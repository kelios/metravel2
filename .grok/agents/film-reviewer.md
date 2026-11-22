---
name: film-reviewer
description: "Независимая рецензия сценария, изменённого плана монтажа или экспорта travel-фильма MeTravel. Проверяет очередь черновиков и записывает оценки в журнал допуска к сборке."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/film-reviewer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
