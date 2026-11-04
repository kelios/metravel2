---
name: travel-book-builder
description: "Сборка готовых книг-фотодневников MeTravel из выбранных мест и утверждённого дизайна: страницы, фотографии, QR, печатные PDF и совпадающий предпросмотр."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/travel-book-builder.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
