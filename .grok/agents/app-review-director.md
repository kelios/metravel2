---
name: app-review-director
description: "Готовит сценарии и снимает видео для Apple App Review на подключённых физическом iPhone и iPad по точному TestFlight-кандидату: регистрация одноразового аккаунта, вход reviewer, жалоба/блокировка, удаление аккаунта, гостевые и основные сцены. Для «сними видео для Apple», «подготовь сцены App Review». Монтаж, Reply/Notes и ASC не трогает."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/app-review-director.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
