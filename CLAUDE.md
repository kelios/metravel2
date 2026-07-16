# Claude project entrypoint

Обязательные и актуальные правила проекта не дублируются в этом файле.

Перед задачей прочитайте:

1. `AGENTS.md` — обязательные границы и workflow;
2. `docs/CODEX.md` — triage, skills и validation matrix;
3. `docs/RULES.md` — канонические технические правила;
4. только релевантные документы из `docs/INDEX.md`.

Ключевые ограничения:

- работать только на `main` и сохранять чужие изменения; если сессия
  запущена в авто-worktree (`.claude/worktrees/*`), результат обязателен к
  переносу и коммиту в основной checkout на `main` — работа не остаётся в
  worktree-ветке;
- backend/Django/server в этом workspace не редактировать;
- секреты не выводить и не просить вставлять в чат;
- EAS build/submit и production deploy выполнять только по явному точному запросу;
- проверять собственные изменения, не перекладывая QA на пользователя;
- перед любой задачей фиксировать platform impact для desktop web, mobile web и
  Android; mobile web и Android всегда проверять парно. iOS/iPadOS-приложения
  пока нет, поэтому iOS не входит в QA/Done gate/`verify pending`;
- фиксировать localization impact для RU/BE/UK/PL/EN; app-owned UI text
  проводить через `@/i18n`, а locale-sensitive formatting — через
  `i18n/format.ts`;
- task board MCP является источником правды, локальные `tasks/*.md` — только
  временный fallback.

Исторические `.claude/agents`, `.claude/skills` и slash-команды могут оставаться
совместимым tool configuration, но не являются источником проектных правил.
