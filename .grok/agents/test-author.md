---
name: test-author
description: "Автор Jest, Playwright и native regression tests: business assertions, deterministic fixtures, Maestro Android/iOS simulator и XCTest physical Apple-device scenarios; диагностика failing/flaky tests."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/test-author.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
