---
name: android-publisher
description: "Оператор Android release: local signed Gradle AAB, versionCode, dry-run и Google Play API без EAS. Для «собери/залей версию»; production и closed-testing tracks разделены."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/android-publisher.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
