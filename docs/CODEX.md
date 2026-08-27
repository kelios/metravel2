# Codex workflow

Ленивый router для выбора project skills, контекста и проверок. `AGENTS.md`
уже приходит в контекст автоматически; этот файл не нужно читать целиком перед
обычной задачей.

## Context budget

1. Определи task type, task-owned paths, platform/localization impact и риск.
2. Выбери один primary skill по runtime catalog.
3. Прочитай его `SKILL.md` полностью.
4. Загрузи только названные им разделы canonical docs и ближайший feature doc.
5. Добавляй skills только для независимого scope: UI, i18n, tests, security,
   browser/device validation, board или deploy/release.

Не перечитывай через shell already-injected `AGENTS.md`. Не загружай полный
`docs/RULES.md`, `docs/README.md`, этот файл или весь каталог skills без
конкретной причины. Для Markdown сначала найди heading через `rg -n '^##? '` и
прочитай ограниченный диапазон `sed`.

## Быстрый router

| Scope | Primary route | Conditional additions |
| --- | --- | --- |
| Обычная разработка/bugfix/refactor | domain skill или `$metravel-feature-builder` | UI/i18n/hook/test skills только по diff |
| Travel/map/profile/achievements/quests | соответствующий `$metravel-*-expert` | `$metravel-domain-router` только при смешанном ownership |
| Видимый web UI | domain/feature skill | `$metravel-ui-guardrails`, затем browser review |
| Tests/e2e/quality | `$metravel-test-runner`, `$metravel-test-writer` или `$metravel-e2e-runner` | `$metravel-quality-fixer` только для полного цикла |
| Docs/skills/prompts | `$metravel-docs-maintainer` | `$metravel-prompt-maintainer` только для prompt/metadata |
| Task board | `$metravel-problem-memory` → `$metravel-task-contract` → `$metravel-ticket-board` | sprint reviewer только для acceptance |
| Backend/API diagnosis | `$metravel-backend-diagnostician` | read-only; board route для owner handoff |
| Android-specific | `$metravel-android-developer` | mobile tester/local builder/operator по точному stage |
| iPhone-specific | соответствующий iOS analyst/architect/developer/tester | release operator только по exact authorization |
| Performance/security/growth/SEO | соответствующий analyst/reviewer/operator | implementation skill только если правки разрешены |
| Deploy/release/prod smoke | devops/release operator или production smoke | operation gate и exact target обязательны |
| Новая функция/contract/recurring complex bug | OpenSpec explore/propose | apply — только отдельным запросом |

Полный grouped index нужен только при обслуживании каталога:
`docs/CODEX_SKILLS.md`. Runtime catalog и frontmatter `description` — источник
triggering; не дублируй полный список skills в этом документе.

## Когда нужен orchestrator или несколько агентов

Используй `$metravel-codex-orchestrator`, когда scope неясен, пересекает несколько
доменов/платформ, включает production/release/external dependency или требует
выбора evidence layer. Для одиночного docs change, bugfix, теста или read-only
проверки он не нужен.

Multi-agent оправдан, когда роли действительно независимы: исследование и
реализация, platform-specific work, отдельная QA или обязательный независимый
review. Не запускай полный BA → architect → developer → QA pipeline для задачи,
где один профильный skill может безопасно получить проверяемый результат.

Компактный role prompt:

```text
Use $<skill> for <scope>.
Owned paths/evidence: <files, diff, logs>.
Platform/localization impact: <values>.
Constraints: <only task-specific constraints; AGENTS.md is inherited>.
Output/validation: <artifact and checks>.
```

Не повторяй в prompt содержание `AGENTS.md`, `RULES.md` и `CODEX.md`; передавай
только task-specific facts. Reviewer/QA получает исходный scope и evidence без
подсказки желаемого verdict.

## Conditional references

| Risk area | Load only |
| --- | --- |
| UI/media/icons/external links | нужные headings `docs/RULES.md`, feature doc, relevant ADR |
| Localization | `docs/DEVELOPMENT.md#localization`, i18n config/resources, nearby tests |
| Browser/e2e | relevant `docs/TESTING.md` section; `.env.e2e` без вывода secrets |
| Operation/build/deploy | relevant `docs/WORKFLOW_OPERATIONS.md` and `docs/RELEASE.md` sections |
| Android/iOS | affected sections in `docs/NATIVE_COMPAT_RULES.md` and `docs/MANUAL_TEST_CASES.md` |
| Board mutation/acceptance | `docs/PROBLEM_MEMORY.md`, relevant `docs/TASK_BOARD_MCP.md` section |
| New/contract/recurring work | OpenSpec docs and active change artifacts |
| Feature behavior | one matching file from `docs/features/` and nearest code/tests |

`docs/README.md` нужен для onboarding/navigation или API family discovery, а не
как обязательный preflight любого skill.

## Validation matrix

| Change | Minimum evidence |
| --- | --- |
| Docs-only | structural reread and links/commands sanity |
| Skill description/default prompt | `npm run audit:prompts` + skill validator |
| Small code scope | targeted check or `npm run check:fast` |
| Medium code scope | relevant tests/lint or `npm run check:preflight` |
| Large/cross-cutting code | `npm run lint` + `npm run test:run` |
| Visible common UI | targeted checks + desktop and mobile-web browser/screenshots/console |
| Android/iOS-specific | targeted checks + correct device/simulator/physical layer |
| Localization | `npm run test:i18n` + affected platform/locale evidence |
| External links | `npm run guard:external-links` or governance verification |
| Release/performance | production build and target-specific real-URL evidence |

Перед long/shared command примени operation gate. Чужой `SKIPPED` — не зелёная
проверка. После code changes полный task diff проходит `$metravel-code-reviewer`
review-and-fix, предпочтительно независимым reviewer.

## Skill maintenance

- Skill: `.codex/skills/<name>/SKILL.md`; UI metadata:
  `.codex/skills/<name>/agents/openai.yaml`.
- Frontmatter содержит только короткие `name` и `description`. Description
  отвечает «какая работа» и «когда срабатывать», без полного workflow.
- `SKILL.md` должен быть procedural и self-contained, но project-wide правила
  не копирует: ссылается на exact heading и загружает его условно.
- `default_prompt` — одна короткая фраза `Use $<name> ...`; не второй skill body.
- Не добавляй README/CHANGELOG в skill folder; подробности выноси в
  `references/` только когда они нужны не каждому invocation.
- После metadata/prompt changes запусти `npm run audit:prompts`; после skill
  changes — `skill-creator` validator.
- Grok adapter: `.grok/` (rules, generated agents, `.grok/skills/codex` symlink).
  Не копируй skill/agent body туда. После правки `.claude/agents/*.md`:
  `node .grok/scripts/sync-agents.mjs`. Карта: `docs/GROK.md`.

## Handoff self-check

- Scope, platform/localization impact и authority соблюдены.
- Загружен минимальный релевантный контекст, не весь docs/skills catalog.
- Diff не содержит чужих изменений и случайных artifacts.
- Validation соответствует observable surface.
- Известные in-scope проблемы исправлены или имеют конкретный blocker/recheck.
- Финал коротко сообщает результат, mechanism/evidence, files, checks и risk.
