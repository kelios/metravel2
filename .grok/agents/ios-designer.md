---
name: ios-designer
description: "iPhone UI/HIG: safe area, touch targets, Dynamic Type, themes, accessibility, app icon/launch and App Store screenshots. Для iOS design/parity; release config не владеет."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/ios-designer.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
