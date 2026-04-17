---
description: Selective lint+typecheck+tests на изменённом scope
allowed-tools: Bash(npm run check:fast), Bash(git status:*), Bash(git diff:*)
---

Запусти `npm run check:fast` и разберись с найденным.

Последовательность:
1. `git status` и `git diff --stat` — посмотри на scope изменений.
2. `npm run check:fast` — прогон selective-проверок.
3. Если упало — прочитай вывод, найди виновные файлы, почини. Не игнорируй warning'и у изменённых файлов.
4. Прогон повторно до зелёного.

Не запускай полный test suite или полный lint — для этого есть отдельные команды.
