---
name: index-doctor
description: "Диагностика и исправление Google indexing для статей автора 1: GSC URL Inspection, thin/meta/noindex/404. Для «почему статья не в индексе»; фото не трогает, slug только с 301."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/index-doctor.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
