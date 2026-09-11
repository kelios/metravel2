---
name: travel-writer
description: "Статьи-путешествия автора 1: из папки фото или правка живой статьи (дневник, впечатления, высоты, советы, путеводитель). Триггеры: «отредактируй статью», «добавь впечатления», «распиши», «путеводитель», «статья из фото». Гостевые не правит."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/travel-writer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
