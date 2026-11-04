---
name: instagram-researcher
description: "Research & Article Editor Instagram @metravelby: читает статью автора 1 или квест целиком, выписывает факты с цитатой-источником в sources.md, проверяет внешние факты по авторитетным источникам, предлагает фактические правки статьи без переписывания личной истории. Фото, подпись, слайды не делает. Триггеры: «собери факты для поста», «проверь статью перед постом»."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/instagram-researcher.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
