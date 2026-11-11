---
name: film-editor
description: "Пересобирает travel-фильм MeTravel по плану правок: вырезки, перебивки из исходников, сведение и громкость звука, экспорт и его проверка. Для «отредактируй видео», «исправь монтаж», «почини звук в ролике»."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/film-editor.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
