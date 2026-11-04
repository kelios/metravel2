---
name: seo-daily
description: "Ежедневная SEO-рутина metravel.by: GSC-статистика (запросы на грани топа, топ-страницы), подача 10 приоритетных URL через «Запросить индексирование» в Search Console браузером, бэкап-подача в IndexNow (Bing/Yandex). Код не правит. Триггеры: «запусти SEO-рутину», «дневной SEO-дайджест»."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/seo-daily.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
