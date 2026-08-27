---
name: test-author
description: "Jest/Playwright tests: новое покрытие, regression, failing или flaky test diagnosis. Продуктовый код меняет только при доказанном дефекте; governance под ответ не подгоняет."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/test-author.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
