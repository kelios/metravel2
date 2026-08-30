---
name: android-expert
description: "Реализация Android-части MeTravel: Platform-ветвление, карта WebView+Leaflet, expo-модули, push, native-навигация и web-only код в native-бандле. Device QA передаёт tester после review."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/android-expert.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
