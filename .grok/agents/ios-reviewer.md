---
name: ios-reviewer
description: "Независимый code-only review-and-fix iOS/shared diff: Expo/Xcode contracts, privacy, auth/storage, links/APNs, i18n/a11y и regressions. Runtime QA выполняет ios-tester в testing."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/ios-reviewer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
