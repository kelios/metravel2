---
name: travel-book-designer
description: "Дизайн готовых книг-фотодневников MeTravel: сравнение графики, акварели, авторского фото и фэнтези, иллюстрации мест и образцы печатных страниц для согласования."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/travel-book-designer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
