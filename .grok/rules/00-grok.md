# Grok adapter

Канон не здесь: `AGENTS.md`, `docs/CODEX.md`, `docs/RULES.md`. Этот файл — только
дельта Grok Build.

## Где что лежит

| Нужно | Источник |
| --- | --- |
| Always-on правила | `AGENTS.md` (уже в контексте) |
| Router skills/проверок | `docs/CODEX.md` (нужный heading) |
| Codex `$metravel-*` skills | `.codex/skills/<name>/SKILL.md` (также `/metravel-*` через `.grok/skills/codex`) |
| Продуктовые skills | `.agents/skills/` и `.claude/skills/` |
| Slash-команды | `.claude/commands/` |
| Роли субагентов | `.grok/agents/<name>.md` → контракт в `.claude/agents/<name>.md` |
| Task board MCP | сервер `metravel-task-board`; tools через `search_tool` / `use_tool` |

Не копируй skill body в `.grok/`. После смены Claude-агента: `node .grok/scripts/sync-agents.mjs`.

## Выбор skill

Обычная FE-задача: прочитай `.codex/skills/metravel-feature-builder/SKILL.md`.
Travel/map/profile/achievements/quests — соответствующий `$metravel-*-expert`.
Статья/путеводитель/впечатления/дневник Юли — `.claude/skills/metravel-travel-article/SKILL.md`
и роль `travel-writer`; API publish/media без прозы — `$metravel-article-editor-agent`.
Широкий/неясный/high-risk scope — `.codex/skills/metravel-codex-orchestrator/SKILL.md`.
Карта каталога: `docs/CODEX_SKILLS.md` только при аудите, не перед каждой задачей.

## Субагенты

Разрешение постоянное (AGENTS.md §4). Сразу `spawn_subagent`:

- после code changes → `review-auditor` (review-and-fix полного task diff)
- тикет `review` → `code-review-gate`
- тикет `testing` → `board-reviewer`
- операции борда → `ticket-board`
- доменный expert, если роль независима

`subagent_type` = имя файла в `.grok/agents/` (`review-auditor`, не `metravel-code-reviewer`).
В промпте ребёнка: scope, paths, raw evidence. Не повторяй AGENTS.md/RULES.md.

## Инструменты Claude → Grok

- Read → `read_file`; Grep → `grep`; Glob → `list_dir`
- Edit/Write/MultiEdit → `search_replace` / `write`
- Bash → `run_terminal_command`
- Agent/Task → `spawn_subagent`
- ToolSearch → `search_tool`; `mcp__<server>__<tool>` → `use_tool` `<server>__<tool>`
- WebSearch → `web_search`; WebFetch → `web_fetch` / `open_page`
- Claude Browser MCP здесь нет: видимый web — Playwright/e2e проекта или честный gap

## MCP и гейты борда

Сначала `search_tool` query `metravel task`. Имена: `metravel-task-board__metravel_task_*`.
PreToolUse-хуки в `.grok/hooks/` держат контракт карточки и `review → testing`.
Если PostToolUse-контекст не дошёл — всё равно сразу спавни `code-review-gate` /
`board-reviewer` по статусу.

Секреты не печатать.

## Бэкенд только читается

Канон: `docs/RULES.md` → «Project scope» и `AGENTS.md` §3. Здесь — дыра, из-за
которой Grok брал `area=back` по «сделай все todo».

- Реализуй только `area=front` / frontend/app/docs.
- `../metravel-backend` и `~/Sites/metravel/metravel` — read-only: читать,
  `git show origin/master`, безопасные GET/HEAD. Не edit/write/commit/push/merge.
- Не `spawn_subagent` с `cwd` в бэк-checkout и не isolation-worktree бэк-репо.
- «Сделай все todo / весь борд / спринт» = только фронт. Карточки `area=back`
  пропустить; если нужен фикс бэка — завести/дописать тикет владельцу, не код.
- Единственное git-исключение: `git -C ../metravel-backend fetch origin master &&
  git -C ../metravel-backend reset --hard origin/master` перед локальным
  тестированием фронта. Это sync к `origin/master`, не реализация бэка.
