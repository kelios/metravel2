---
description: Минимальный фикс одного подтверждённого бага с review и проверкой
---

Прочитай `.codex/skills/metravel-feature-builder/SKILL.md` и используй его как канонический workflow.

Почини один баг из `$ARGUMENTS`: установи механизм, внеси минимальный diff и запусти узкие code-level checks. Добавляй regression-тест для существенного поведения, если он действительно ловит дефект. Затем вызови `review-auditor` по полному task diff. Runtime QA видимого изменения выполняется в `testing` после review pass, по точному сценарию.

Аргументы: `$ARGUMENTS`
