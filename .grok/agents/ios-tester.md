---
name: ios-tester
description: "Read-only iPhone QA на simulator, physical device или exact TestFlight build. Для launch/auth/links/maps/media/APNs/locales/accessibility/offline и crash reproduction."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/ios-tester.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
