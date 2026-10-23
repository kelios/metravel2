---
name: instagram-creator
description: "Готовит связные истории, карусели и Reels @metravelby по проверенным источникам: личный дневник, приглашение в квест или реальный сценарий сайта. Используй для «напиши пост», «собери карусель», «перепиши пакет»; публикацией не занимается."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/instagram-creator.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
