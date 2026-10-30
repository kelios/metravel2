# Codex workflow

Ленивый router для выбора project skills, контекста и проверок. `AGENTS.md`
уже приходит в контекст автоматически; этот файл не нужно читать целиком перед
обычной задачей.

## Context budget

1. Зафиксируй результат пользователя и критерий его доказательства; затем task type,
   task-owned paths, platform/localization impact и риск.
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
| Видимый web UI | domain/feature skill | `$metravel-ui-guardrails`; browser QA только после code review в `testing` |
| Tests/e2e/quality | `$metravel-test-runner`, `$metravel-test-writer` или `$metravel-e2e-runner` | `$metravel-quality-fixer` только для полного цикла |
| Docs/skills/prompts | `$metravel-docs-maintainer` | `$metravel-prompt-maintainer` только для prompt/metadata |
| Готовые книги-фотодневники | `$metravel-travel-book-designer` / `travel-book-designer` для стиля и макета; `$metravel-travel-book-builder` / `travel-book-builder` для сборки PDF | `imagegen` для иллюстраций, `pdf` для авторского контроля макета; текущий состав и формат — `docs/features/travel-memory-books.md` |
| Наборы/обучение/GGUF metravel-llm | `$metravel-llm-training` / `llm-trainer` | независимая оценка — `$metravel-llm-evaluation` / `llm-judge`; app/retrieval changes — feature owner |
| Task board | `$metravel-problem-memory` → `$metravel-task-contract` → `$metravel-ticket-board` | sprint reviewer только для acceptance |
| Backend/API diagnosis | `$metravel-backend-diagnostician` | read-only; board route для owner handoff |

Новые роли книг выбираются по фактическому списку Agent tool. Если
`travel-book-designer` или `travel-book-builder` ещё не доступны как `agent_type`,
передай соответствующий `.claude/agents/travel-book-*.md` доступному `default`
агенту; наличие файла адаптера само по себе не доказывает загрузку роли в runtime.
| Android-specific | `$metravel-android-developer` | mobile tester/local builder/operator по точному stage |
| iPhone-specific | соответствующий iOS analyst/architect/developer/tester | release operator только по exact authorization |
| Performance/security/growth/SEO | соответствующий analyst/reviewer/operator | implementation skill только если правки разрешены |
| Запись/монтаж UI evidence | `$metravel-scenario-recorder` или `$metravel-evidence-editor` | tester задаёт сценарий и evidence layer; recorder и editor не выносят QA verdict |
| Сценарии и запись видео для App Review | `$metravel-app-review-director` | один кандидат, один батч сцен; аккаунты и приватный ввод по `docs/WORKFLOW_OPERATIONS.md` 3.1 |
| Пакет для Apple App Review | `$metravel-app-review-evidence` | покрытие сцен, manifest, вложение и Reply/Notes; запись/монтаж — recorder/editor, внешние шаги — release operator |
| Deploy/release/prod smoke | devops/release operator или production smoke | operation gate и exact target обязательны |
| Новая функция/contract/recurring complex bug | OpenSpec explore/propose | прямое «сделай/исправь» разрешает proposal → apply; planning-only остаётся планом |

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

### Ограничение контекста и расширения задачи

Канон — `docs/RULES.md` → «Outcome-bound scope and effort». Кодовые/guard-метрики
не заменяют исходный результат; после двух опровергнутых гипотез пересмотри
причинную связь, прежде чем запускать новую ветку работы.

В Codex для самостоятельной подзадачи предпочитай `fork_turns="none"` и короткий
полный brief с исходным запросом, paths и evidence. Полную историю передавай
только при обоснованной зависимости от неё. Не отправляй весь разговор ради
доступа к одному логу. Получай большой tool-result в переменную, затем выводи
только проверенный нужный срез; повторное чтение заменяй ignored артефактом.

При разборе затрат используй реальные usage records, отделяй cached input от
нового input, reasoning как часть output и собственное дерево агентов от чужих
чатов. Укажи временную границу; без данных не придумывай токены или стоимость.

### Media-agent dispatch

- Передавай fresh agent только один готовый сценарий или bounded batch: scene
  ids, exact build/artifact, target/evidence layer, steps/expected result,
  output directory и checkpoint `completed | artifacts | build | next_step`.
- Для Codex готовые механические записи и экспорты запускай на
  `gpt-5.6-luna` с `medium`; repair или новый workflow — на `gpt-5.6-sol` с
  `medium`. Более сильную модель выбирает только root для узкого вопроса.
  Claude role files сохраняют поддерживаемое значение `model: sonnet`.
- Native test/rehearsal/recording contract: `docs/TESTING.md` →
  `Native scenario automation and recording readiness`. Physical Apple capture
  принимает exact-candidate rehearsal через `npm run recording:ready`;
  остальные поверхности используют свой target-specific passing suite report;
  partial regression не доказывает полную App Review scene.
- Для новых Apple video jobs: `docs/TESTING.md` →
  `Apple video: E2E before capture`. Передавай frozen handoff со script hash,
  passing E2E report, готовыми командами и общим attempt checkpoint; matching
  E2E уже служит rehearsal. Новый агент не начинает обход/счётчик заново.
- Readiness выполняется один раз на batch. Используй deterministic CLI,
  `ffprobe` и точечные кадры вместо frame dumps. Повторяй только изменённые или
  упавшие scenes; после двух одинаковых operational failures верни exact
  unblock. Agent output — не более 10 строк.
- Recorder фиксирует реальные действия на назначенном evidence layer. Editor
  сохраняет originals и source timeline; монтаж не повышает доказательность и
  не подменяет отсутствующее device video или exact-build evidence.

### Продолжение без повторного аудита

Сначала используй сохранённые checkpoint, SHA и результаты проверок. При
неизменном входе повтор нужен только из-за истечения актуальности, ошибки или
конкретного незакрытого риска. Читай указанные карточки и нужные поля; полный
поиск истории выполняется для create/reopen/split, а не на каждом продолжении.
Не выводи целиком большие ответы API, описания карточек и accessibility tree,
если следующий шаг определяется несколькими полями. Уже полученное разрешение
сохраняется в handoff; запрос нового разрешения на отдельную внешнюю стадию
не заменяет выполнение доступной подготовки и не повторяет прежний вопрос.

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
| Medium code scope before/during review | relevant static/unit tests, lint, typecheck, and guards; no e2e |
| Large/cross-cutting code | `npm run lint` + `npm run test:run` |
| Testing after review | Required evidence from `docs/TESTING.md` → `Validation selection gate`; no automatic full preflight/runtime sweep |
| Responsive/visual UI change in testing | mobile web first, then desktop web; changed states/screenshots/console |
| Identical shared behavior/content | nearest reliable behavior/data check and one representative web flow if needed |
| Android/iOS-specific in testing | affected emulator/simulator; physical/processed candidate only for the required capability/release gate |
| Localization | `npm run test:i18n` for app resources; distinct runtime locale risks only |
| External links | `npm run guard:external-links` or governance verification |
| Release/performance in testing/authorized release stage | production build and target-specific real-URL evidence |

До назначения tester и подготовки окружения — `docs/TESTING.md` →
«Validation selection gate». Матрица, reuse и узкий production smoke находятся
в том же разделе «Risk-based validation and evidence reuse».

Перед long/shared command примени operation gate. Чужой `SKIPPED` — не зелёная
проверка. После code changes полный task diff проходит `$metravel-code-reviewer`
review-and-fix, предпочтительно независимым reviewer. Reviewer запускает только
code-level checks; observable/runtime evidence собирается после pass в
`testing`.

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

- Repository targets obey `docs/RULES.md` → «Owned repositories only
  (mandatory)»; upstream remains read-only, including when named in a board card.
- Scope, platform/localization impact и authority соблюдены.
- Загружен минимальный релевантный контекст, не весь docs/skills catalog.
- Diff не содержит чужих изменений и случайных artifacts.
- Validation соответствует observable surface.
- Известные in-scope проблемы исправлены или имеют конкретный blocker/recheck.
- Финал коротко сообщает результат, mechanism/evidence, files, checks и risk.
