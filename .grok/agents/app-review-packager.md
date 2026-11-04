---
name: app-review-packager
description: "Собирает и проверяет пакет для Apple App Review по точному iOS-кандидату: покрытие сцен демо-видео, scene manifest, готовность вложения/ссылки, согласованность Reply/Notes с доказательствами. Для «хватит ли материалов Apple», «что не снято», «проверь пакет перед submit». Не записывает, не монтирует, ASC не трогает."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/app-review-packager.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
