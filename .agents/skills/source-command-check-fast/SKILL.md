---
name: "source-command-check-fast"
description: "Selective static/unit checks текущего task scope"
---

# source-command-check-fast

Use this skill when the user asks to run the migrated source command `check-fast`.

## Command Template

Запусти `npm run check:fast` и разберись с найденным.

Последовательность:
1. `git status --short` и `git diff --stat` — выдели task scope; чужие изменения
   не исправляй. Проверь operation gate по `docs/WORKFLOW_OPERATIONS.md` →
   «3.4 Координация долгих операций».
2. `npm run check:fast` — прогон selective-проверок.
3. Если упало — прочитай вывод, найди виновные файлы, почини. Не игнорируй warning'и у изменённых файлов.
4. Прогон повторно до зелёного.

После code changes передай task diff на `$metravel-code-reviewer`.

Не запускай полный test suite или полный lint — для этого есть отдельные команды.
