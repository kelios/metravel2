---
name: travel-expert
description: "Фича travel: каталог, карточки, детали, wizard, media и export. Для travel UI/data/save bugs; общая карта, authored content и SEO принадлежат профильным агентам."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/travel-expert.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
