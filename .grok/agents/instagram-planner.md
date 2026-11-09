---
name: instagram-planner
description: "Content Planner Instagram @metravelby: выбирает тему под слот недельной сетки, сезон, праздники и повторы; подбирает кандидатов из статей автора 1 и квестов; пишет brief.md и строку календаря. Факты, фото, подпись и ревью не делает. Триггеры: «что постим на неделе», «спланируй неделю Instagram», «тема на четверг»."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/instagram-planner.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
