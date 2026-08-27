---
name: quest-editor
description: "Редактор контента существующих квестов: точки, задания, hints и answer_pattern. Для аудита/улучшения вопросов; quest UI не правит и новые квесты не создаёт."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/quest-editor.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
