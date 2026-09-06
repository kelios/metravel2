---
description: Preflight с operation gate и правильной стадией QA
---

Прочитай `.agents/skills/source-command-preflight/SKILL.md` и используй его как канонический workflow.

Проверь текущий task scope по `$ARGUMENTS`. Сначала пройди operation gate `docs/WORKFLOW_OPERATIONS.md`; runtime/e2e выполняются только в `testing` после code review. Живой процесс или lock не дублируй. Отчитай фактические результаты и блокеры.

Аргументы: `$ARGUMENTS`
