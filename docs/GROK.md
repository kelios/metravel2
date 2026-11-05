# Grok Build adapter

Не источник проектных правил. Канон: `AGENTS.md`, `docs/CODEX.md`,
`docs/RULES.md`, `.codex/skills/`, `.claude/agents/`.

Grok уже подхватывает `AGENTS.md`, `CLAUDE.md`, `.agents/skills/`,
`.claude/skills/`, `.claude/commands/` и `.mcp.json`. Этот адаптер закрывает
дыры харнесса, не копируя контракты.

Для мультфильма «Наш день» запусти `reel-animator` в Grok Build. Роль откроет
[скилл сценария и монтажа](../.claude/skills/metravel-animated-reels/SKILL.md)
и подготовит пакет для отдельных видеоклипов. Доступ к рендеру проверяется
в Grok Imagine по [инструкции производства](../.claude/skills/metravel-animated-reels/references/production.md).

## Что добавляет `.grok/`

| Путь | Зачем |
| --- | --- |
| `.grok/rules/00-grok.md` | Always-on дельта: router, tool map, spawn types |
| `.grok/skills/codex` | Symlink на `.codex/skills` — `$metravel-*` skills в slash/auto-invoke |
| `.grok/agents/<name>.md` | `spawn_subagent` types; body — тонкая обёртка над `.claude/agents/<name>.md` |
| `.grok/hooks/` | Те же board gates, что Claude, через адаптер stdin |
| `.grok/config.toml` | Project MCP `metravel-task-board` |
| `.grok/scripts/sync-agents.mjs` | Пересборка агентов после правки Claude-ролей |

После изменения `.claude/agents/*.md`:

```bash
node .grok/scripts/sync-agents.mjs
node .grok/scripts/sync-agents.mjs --check
```

`npm run audit:prompts` запускает read-only проверку. Если роль удалили или
переименовали, удали устаревший wrapper, который назвал гейт, и повтори sync.

После изменения `.claude/skills/**` или `.claude/commands/{auto-dev,changed-summary,check-fast,guard-all,preflight}.md` зеркало для Codex/Grok собирается из `.claude` как единственного источника правды:

```bash
npm run sync:agent-skills
npm run sync:agent-skills:check
```

`.agents/skills/**` руками не править: расхождение ловит `sync:agent-skills:check` в `npm run lint`. Vendor-owned `openspec-*` не зеркалируются.

Не клади полный skill/agent body в `.grok/`. Не меняй Codex/Claude контракты
через Grok-обёртку: правь канон, затем sync.

Подробный Grok-router: `.grok/rules/00-grok.md`. Каталог Codex skills:
`docs/CODEX_SKILLS.md` (только аудит каталога).
