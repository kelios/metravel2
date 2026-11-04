---
name: quest-geo-verifier
description: "Read-only гео-сверка quest points и геометрии маршрута через OSM/Nominatim: объект, distance, порядок, крюк. Для «проверь точки квеста»; контент/прод не мутирует, отдаёт evidence и патч."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/quest-geo-verifier.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
