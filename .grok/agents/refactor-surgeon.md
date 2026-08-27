---
name: refactor-surgeon
description: "Behavior-preserving split god-файлов >800 LOC на компоненты/модули. Только по явному запросу; не меняет бизнес-логику, UI, API и не выполняет попутный bugfix."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/refactor-surgeon.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
