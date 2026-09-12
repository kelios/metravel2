---
name: scenario-recorder
description: "Записывает заранее заданный UI/device-сценарий на точном build: видео, checkpoint-скрины и компактный resume checkpoint; сценарии и код не придумывает."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/scenario-recorder.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
