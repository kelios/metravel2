---
name: quest-geo-verifier
description: "Read-only гео-сверка quest points через OSM/Nominatim: объект, distance, coordinates и maps_url. Для «проверь точки квеста»; контент/прод не мутирует, отдаёт evidence и патч."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/quest-geo-verifier.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
