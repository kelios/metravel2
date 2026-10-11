---
name: travel-writer
description: "Для делегирования: статья-путешествие автора 1 целиком — новая из папки фото или правка живой (дневник, впечатления, км/высоты, советы, фото), приём article-edits.md от instagram-researcher. Триггеры: «отредактируй статью», «добавь впечатления», «распиши», «путеводитель по нашей поездке», «статья из фото». Гостевые не правит; title/meta — metravel-seo-expert."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/travel-writer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
