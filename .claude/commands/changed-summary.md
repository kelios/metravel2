---
description: Сводка изменений текущей ветки и их scope
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(node scripts/collect-changed-files.js:*)
---

Дай сводку текущих изменений для контекста.

1. Посмотри `git status --short --untracked-files=all`, `git diff HEAD --stat` (индекс и рабочее дерево) и `git diff origin/main...HEAD --stat` (локальные коммиты). Для новых файлов статус даёт только имя; перед выводом о назначении прочитай их в пределах задачи.
2. Сгруппируй файлы по фичам: travel/, map/, quests/, article/, export/, user/, api/, hooks/, stores/, tests, docs, config.
3. Для каждой группы — одной строкой что поменялось (add/modify/delete + назначение).
4. Флаги:
   - 🔴 Изменения в `api/`, `stores/`, `types/` — потенциально breaking.
   - 🟡 Файлы >800 LOC в diff.
   - 🟢 Только тесты или docs.
5. Укажи предполагаемый selective scope для `check:fast` (travel/map/account/messages/other).

Формат: markdown-таблица + 1-2 итоговые строки "что это за изменение в целом".
