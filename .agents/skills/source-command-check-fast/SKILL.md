---
name: "source-command-check-fast"
description: "Selective lint+typecheck+tests на изменённом scope"
---

# source-command-check-fast

Use this skill when the user asks to run the migrated source command `check-fast`.

## Command Template

Запусти `npm run check:fast` и разберись с найденным.

Последовательность:
1. `git status` и `git diff --stat` — посмотри на scope изменений.
2. `npm run check:fast` — прогон selective-проверок.
3. Если упало — прочитай вывод, найди виновные файлы, почини. Не игнорируй warning'и у изменённых файлов.
4. Прогон повторно до зелёного.

Не запускай полный test suite или полный lint — для этого есть отдельные команды.
