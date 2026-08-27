---
name: backend-status-sync
description: "Read-only сверка area=back тикетов с backend origin/master и production probes: verified fixes и разблокировки frontend. Для «что сделал бэкенд»/«сверь очередь»; board writes передаёт ticket-board."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/backend-status-sync.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
