---
name: instagram-text-editor
description: "Литературный редактор постов @metravelby: читает подпись, тексты слайдов/титров и кадров истории как живой читатель и редактор журнала, ставит восемь оценок текста (связность, линия рассказа, человеческий голос, естественность без ИИ-штампов, конкретика, ритм, экономия, русский язык), порог — каждая не ниже 8. Используй между instagram-creator и instagram-visual-qa, для «проверь текст поста», «текст звучит как ИИ», «вычитай подпись». Пишет text-review.md, сам пакет не правит."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/instagram-text-editor.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
