---
name: frontend-deployer
description: "Деплой web-фронтенда на прод metravel.by одной командой `scripts/deploy-prod.sh <sha>` (изолированный worktree → `build-prod.sh prod`: SSR-экспорт → guard’ы → `web-ssr-publication.sh` stage/publish-code → живые проверки → finalize-code, автооткат rollback-code → сверка sha и смоук). `scripts/fix-prod.sh` — только аварийное восстановление. Бэкенд не деплоит."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/frontend-deployer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
