# Codex skills

Служебная карта project skills. Читать её только при добавлении, удалении,
переименовании или аудите каталога; обычная задача выбирает skill из runtime
catalog по frontmatter `description`.

## Семейства

- Feature/domain: `feature-builder`, `domain-router`, `travel-expert`,
  `map-expert`, `profile-expert`, `achievements-expert`, `quest-expert`,
  `hook-builder`, `refactor-surgeon`.
- UI/content/assets: `ui-guardrails`, `i18n-guardrails`, `design-auditor`,
  `visual-asset-designer`, `child-quest-visuals`, `article-editor-agent`,
  `quest-writer`, `quest-editor`, `quest-geo-verifier`,
  `quest-playthrough-reviewer`.
- Validation/review: `test-runner`, `test-writer`, `e2e-runner`,
  `browser-reviewer`, `mobile-tester`, `qa-agent`, `quality-fixer`,
  `code-reviewer`, `security-reviewer`, `release-checks`,
  `production-smoke`, `performance-analyst`.
- Platform/release: `android-developer`, `android-portable-builder`,
  `google-play-operator`, iOS analyst/architect/designer/developer/reviewer/
  tester/release-operator, `devops-agent`, `play-campaign-tester`.
- Planning/operations: `codex-orchestrator`, `agent-workflow`,
  `project-analyst`, `business-analyst`, `system-architect`,
  `growth-analyst`, `seo-index-operator`, OpenSpec skills.
- Board/backend/docs: `problem-memory`, `task-contract`, `ticket-board`,
  `sprint-reviewer`, `backend-diagnostician`, `docs-maintainer`,
  `prompt-maintainer`.

Все имена имеют prefix `$metravel-`, кроме vendor OpenSpec skills. Точные
triggers и ограничения принадлежат frontmatter/`SKILL.md`; не копируй их сюда.

## Machine-audited registry

Этот компактный registry проверяет `npm run audit:prompts`; workflow и triggers
из него не загружаются:

`$metravel-achievements-expert`, `$metravel-agent-workflow`,
`$metravel-android-developer`, `$metravel-android-portable-builder`,
`$metravel-article-editor-agent`, `$metravel-backend-diagnostician`,
`$metravel-browser-reviewer`, `$metravel-business-analyst`,
`$metravel-child-quest-visuals`, `$metravel-code-reviewer`,
`$metravel-codex-orchestrator`, `$metravel-design-auditor`,
`$metravel-devops-agent`, `$metravel-docs-maintainer`,
`$metravel-domain-router`, `$metravel-e2e-runner`,
`$metravel-feature-builder`, `$metravel-google-play-operator`,
`$metravel-growth-analyst`, `$metravel-hook-builder`,
`$metravel-i18n-guardrails`, `$metravel-ios-analyst`,
`$metravel-ios-architect`, `$metravel-ios-designer`,
`$metravel-ios-developer`, `$metravel-ios-release-operator`,
`$metravel-ios-reviewer`, `$metravel-ios-tester`, `$metravel-map-expert`,
`$metravel-mobile-tester`, `$metravel-performance-analyst`,
`$metravel-play-campaign-tester`, `$metravel-problem-memory`,
`$metravel-production-smoke`, `$metravel-profile-expert`,
`$metravel-project-analyst`, `$metravel-prompt-maintainer`, `$metravel-qa-agent`,
`$metravel-quality-fixer`, `$metravel-quest-editor`, `$metravel-quest-expert`,
`$metravel-quest-geo-verifier`, `$metravel-quest-playthrough-reviewer`,
`$metravel-quest-writer`, `$metravel-refactor-surgeon`,
`$metravel-release-checks`, `$metravel-security-reviewer`,
`$metravel-seo-index-operator`, `$metravel-sprint-reviewer`,
`$metravel-system-architect`, `$metravel-task-contract`,
`$metravel-test-runner`, `$metravel-test-writer`, `$metravel-ticket-board`,
`$metravel-travel-expert`, `$metravel-ui-guardrails`,
`$metravel-visual-asset-designer`.

## Правила каталога

- Начинай с одного primary skill; добавляй только независимый conditional scope.
- Не создавай новый skill, если существующий можно уточнить без смешения ролей.
- Description держи коротким: capability + concrete trigger surfaces.
- Workflow хранится в body; project-wide contract — в canonical docs с exact
  heading, а не в каждом skill.
- `agents/openai.yaml` не дублирует body.
- `.agents/skills` владеет общими процедурами; одноимённые `.claude/skills`
  сохраняются как совместимые копии. `audit:prompts` проверяет их metadata и
  совпадение текста. OpenSpec сохраняет vendor-различия адаптеров; это не дубли
  для механического удаления.
- `.github/skills/metravel-*` — снимки для Copilot, маршрутизируемые по имени из
  `.github/copilot-instructions.md`. Генератора у них нет, поэтому они отстают от
  `.codex/skills` молча; `audit:prompts` проверяет только их metadata, а
  расхождение текста — решение ревью. `speckit-*` там vendor spec-kit
  (`.specify/integrations/copilot.manifest.json`), руками не править.
- `.claude/agents` — источник ролей, `.grok/agents` генерируется через
  `node .grok/scripts/sync-agents.mjs`. Команды служат короткими входами в skills.
- Metadata-аудит не доказывает согласованность полномочий, окружений и стадий:
  эти контракты проверяются по каноническим документам при ревью промптов.
- После изменений: `npm run audit:prompts` и validator `skill-creator` для
  каждого затронутого skill.
