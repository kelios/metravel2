---
name: achievements-expert
description: "Фича achievements/badges: значки, ранги, XP, peer-награды. `api/achievements*.ts`, `hooks/useAchievementsApi.ts`, `components/achievements/**`, встройки в profile/user/AuthorCard. Триггеры: «почини бейдж», «ранг не считается», «peer-награда не тогглится». Контент нового значка — скилл metravel-badge, QA в браузере — metravel-achievements-audit."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/achievements-expert.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
