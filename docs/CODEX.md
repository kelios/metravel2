# Codex workflow

Этот файл связывает корневые инструкции, проектную документацию и skills Codex.

## Источники правил

- `AGENTS.md` - короткий обязательный чеклист для любого AI-агента.
- `docs/RULES.md` - основной источник проектных правил.
- `docs/README.md` - карта документации и API-справка.
- `.codex/skills/*/SKILL.md` - специализированные рабочие маршруты Codex.

## Как выбирать skill

- `$metravel-feature-builder`: используй для фич, багфиксов, рефакторинга, API-логики, hooks, services и SEO.
- `$metravel-hook-builder`: используй, когда основная задача — вынести, спроектировать или упростить focused React hooks в `hooks/` или рядом с фичей, сохранив контракты и не добавляя новые `any`.
- `$metravel-ui-guardrails`: добавляй при любых видимых UI-изменениях, работе с media, icons, placeholders, tokens или external links.
- `$metravel-release-checks`: используй при выборе проверок, подготовке PR, release/deploy и production web validation.
- `$metravel-quality-fixer`: используй, когда нужно прогнать `lint` + Jest + Playwright как единый quality-gate цикл, исправить реальные падения и повторно довести validation до зелёного baseline.
- `$metravel-test-runner`: используй, когда нужно выбрать и прогнать точечные Jest/unit/integration/governance команды, разобрать падение и не оставить известные test-failures в затронутом scope.
- `$metravel-test-writer`: используй, когда нужно написать или обновить unit/integration/governance тесты, зафиксировать контракт бага/фичи и сохранить стабильные assertions без `.skip`.
- `$metravel-e2e-runner`: используй для Playwright/e2e, browser smoke, trace/screenshot evidence, re-run flaky flows и проверки сценариев через `.env.e2e` без вывода секретов.
- `$metravel-performance-analyst`: используй для Lighthouse, bundle/perf budget analysis, baseline comparison и performance validation только по production build или реальному URL.
- `$metravel-code-reviewer`: используй для focused review diff'а, поиска рисков, rule violations, validation gaps и остаточных проблем перед handoff или approve.
- `$metravel-devops-agent`: используй для подготовки, запуска и проверки deploy на `dev`, `preprod` или `prod`, включая preflight, secret hygiene, server-path safety и post-deploy validation.
- `$metravel-docs-maintainer`: используй при изменении `docs/`, `AGENTS.md`, `.codex/skills` или правил работы Codex.
- `$metravel-codex-orchestrator`: используй как верхний self-check для сложных или многошаговых задач: triage, минимальный набор skills, role prompts, validation plan, handoff и final self-check по правилам проекта.
- `$metravel-agent-workflow`: используй для координации ролей business analyst, system architect, designer, programmer, QA, reviewer и DevOps.
- `$metravel-project-analyst`: используй для read-only анализа структуры проекта, активных фич, зависимостей, validation surface, risk hotspots и выбора следующих агентов перед крупной задачей.
- `$metravel-android-developer`: используй для Android/native разработки и отладки Expo/React Native: platform files, native crashes, Expo modules, permissions, SecureStore, push, native map, web-first код в Android bundle.
- `$metravel-mobile-tester`: используй для read-only QA мобильных сценариев на mobile web и Android/native: responsive layout, touch targets, navigation, native smoke, screenshots/logs/evidence и retest.
- `$metravel-business-analyst`: используй для превращения продуктовой идеи в feature brief, user stories, acceptance criteria, non-goals, metrics и risks.
- `$metravel-system-architect`: используй для technical design, review diff, risk mapping, validation plan и безопасного разбиения работ.
- `$metravel-qa-agent`: используй для read-only тестирования, browser/e2e exploration, bug reports и re-test фиксов.

Подключай только те skills, которые реально нужны задаче. Если skill требует дополнительные docs, читай только релевантные файлы.

## Быстрый triage задачи

Перед чтением большого контекста определи тип задачи и риск:

| Тип задачи | Минимальный контекст | Обязательные акценты |
| --- | --- | --- |
| Feature, bugfix, refactor | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, профильный feature-doc при наличии | переиспользование существующих компонентов, hooks, utils; минимальный diff |
| Hooks / logic extraction | `AGENTS.md`, `docs/RULES.md`, `docs/DEVELOPMENT.md`, профильный feature-doc, ближайшие существующие hooks | выносить focused hook без лишней абстракции, сохранять client/server state boundaries, не добавлять новые `any` |
| Backend task planning | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `tasks/README.md`, `tasks/000-template.md` | новые задачи оформляй отдельными файлами в `tasks/` строго по шаблону `000-template.md` и правилам `tasks/README.md`; используй агент `task-author` / команду `/task-new` |
| Видимый UI, media, icons, tokens | всё из feature-контекста + `$metravel-ui-guardrails` | проверка в браузере на web, screenshot, отсутствие новых console errors |
| External links | `docs/RULES.md`, `docs/TESTING.md`, `utils/externalLinks.ts` | никаких direct `window.open(...)` и `Linking.openURL(...)` вне chokepoint |
| Test running | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, профильный feature-doc при наличии | выбрать самый узкий надёжный test command, не оставлять `.skip`, после фикса rerun обязателен |
| Repo-wide quality fix | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/DEVELOPMENT.md`, `docs/RELEASE.md` | запустить lint + Jest + Playwright, исправить реальные падения, повторить проверки и явно отметить только несвязанные блокеры |
| Test writing | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, профильный feature-doc, ближайшие существующие тесты | писать тест на ближайшем подходящем уровне, фиксировать реальный контракт, избегать flaky assertions |
| Browser / E2E | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `.env.e2e` при необходимости, профильный feature-doc | Playwright/browser flow, secret hygiene, screenshot/trace evidence, console/runtime checks |
| Android/native development | `AGENTS.md`, `docs/RULES.md`, `docs/NATIVE_COMPAT_RULES.md`, `docs/DEVELOPMENT.md`, профильный feature-doc | web-first правило: не ломать production web; platform files вместо больших условий; native governance; device verify pending без эмулятора/устройства |
| Mobile QA | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/NATIVE_COMPAT_RULES.md`, профильный feature-doc | read-only mobile web/native checks, touch/layout/runtime evidence, no secrets, баги роутить к профильному owner |
| Performance analysis | `docs/RULES.md`, `docs/TESTING.md`, `docs/RELEASE.md`, профильный perf-doc (`docs/TRAVEL_PERFORMANCE_REFACTOR.md` при travel scope) | только production build или real URL, baseline comparison, Lighthouse/bundle budgets |
| Code review | `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, профильный feature-doc, diff validation logs | lead with findings, проверять project-rule compliance, known failures, missing tests и residual risks |
| SEO / route pages | `docs/DEVELOPMENT.md` SEO-раздел | `buildCanonicalUrl`, `buildOgImageUrl`, `LazyInstantSEO` |
| Release / deploy / performance | `docs/RELEASE.md`, `docs/PRODUCTION_CHECKLIST.md`, `$metravel-release-checks`, `$metravel-devops-agent` | production build/export, explicit deploy target, secret hygiene, реальные URL для post-deploy проверок |
| Docs / skills | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл | обновляй существующие canonical docs, не создавай одноразовые отчеты |
| Codex self-orchestration | `AGENTS.md`, `docs/CODEX.md`, `docs/RULES.md`, `docs/README.md` | task triage, smallest skill set, role prompt pattern, validation plan, final self-check |
| Project analysis / onboarding | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл, `package.json`, `docs/INDEX.md` при необходимости | read-only карта структуры, активных фич, validation surface, risk hotspots и recommended agents; не создавай отчет без запроса |
| Multi-agent workflow | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл, нужные role skills | роли работают по контрактам; QA и BA не меняют код; programmer чинит подтвержденные баги; reviewer проверяет diff и validation; DevOps деплоит только при явном target env |

Если задача затрагивает несколько строк таблицы, бери объединение контекста, но не загружай справки, которые не помогают текущему решению.

## Multi-agent workflow

Используй `$metravel-agent-workflow`, когда задача требует систему ролей, баг-цикл или разделение discovery/design/implementation/validation/review.

Используй `$metravel-codex-orchestrator` перед `$metravel-agent-workflow`, если задача неясная, широкая, затрагивает несколько областей или нужно выбрать правильные skills/промты/проверки. Orchestrator не пишет код сам по роли; он выбирает минимальный маршрут, фиксирует constraints и затем передает работу профильным skills.

Базовый prompt pattern для передачи роли:

```text
Use $<skill-name> for <scope>.
Context: <relevant docs/files/diff/logs>.
Constraints: follow AGENTS.md, docs/RULES.md, docs/CODEX.md; keep unrelated changes separate; do not print secrets.
Output: <role artifact>.
Validation: <expected checks/evidence>.
```

Стандартный feature flow:

1. `$metravel-codex-orchestrator` при сложном scope выбирает route: skills, prompts, constraints, validation.
2. `$metravel-project-analyst` при широком или неясном scope формирует `Project Analysis`: структура, активные фичи, validation map, risk hotspots, recommended agents.
3. `$metravel-business-analyst` формирует `Feature Brief`: problem, audience, user stories, acceptance criteria, non-goals, metrics, risks, open questions.
4. `$metravel-system-architect` формирует `Technical Design`: reuse points, affected modules, API/data/UI/external-link impact, implementation steps, validation plan.
5. `$metravel-ui-guardrails` формирует UI contract для видимых web/mobile состояний, если задача затрагивает интерфейс.
6. `$metravel-android-developer` подключай для Android/native поведения, native crashes, Expo modules, platform files и device-specific fixes.
7. `$metravel-hook-builder` подключай дополнительно, если основной объём работы — вынос локальной логики в hooks или cleanup hook boundaries.
8. `$metravel-feature-builder` реализует минимальный diff по утвержденному design/brief.
9. `$metravel-code-reviewer` делает focused review pass, если нужен отдельный reviewer без расширенного architecture-design шага.
10. `$metravel-mobile-tester` проверяет mobile web или Android/native сценарии и создает `Mobile QA Pass` или `Bug Report`.
11. `$metravel-qa-agent` тестирует общий сценарий read-only и создает `Bug Report` или `QA Pass`.
12. `$metravel-system-architect` в review mode проверяет findings, diff, проверки, known risks и соответствие правилам, когда нужен архитектурный review.
13. `$metravel-devops-agent` готовит и выполняет deploy/build/release только при явном запросе на deploy/release, с environment gate, preflight и post-deploy validation.

Стандартный bug loop:

1. `$metravel-qa-agent` ходит по приложению, воспроизводит проблему и создает структурированный `Bug Report`.
2. `$metravel-feature-builder` чинит один подтвержденный bug report за раз.
3. `$metravel-hook-builder` подключай, если bugfix в основном упирается в неудачную hook-архитектуру или дублирующуюся hook-логику.
4. `$metravel-qa-agent` re-test'ит фикс.
5. `$metravel-code-reviewer` review'ит итоговый diff и validation; `$metravel-system-architect` подключай дополнительно для high-risk design review.

Ролевые ограничения:

- BA, QA и reviewer по умолчанию не меняют код.
- Codex Orchestrator не подменяет профильные роли; он выбирает маршрут, проверяет правила и держит handoff компактным.
- Project Analyst только анализирует и не меняет файлы, если пользователь отдельно не попросил перейти к docs/code changes.
- Mobile Tester по умолчанию не меняет код; он дает evidence и баг-репорты для `$metravel-android-developer`, `$metravel-feature-builder` или `$metravel-ui-guardrails`.
- Android Developer не меняет release/build configs (`app.json`, `eas.json`, `plugins/**`, `scripts/**`) без явного запроса и не заявляет Android-ready без device/emulator evidence.
- Programmer не начинает реализацию без bug report, feature brief или явного user request.
- DevOps agent не деплоит `prod` без явного production deploy запроса и не меняет серверные/SSL пути без проверки на целевом host.
- Designer не создает отдельную дизайн-систему: использует `components/ui`, `DESIGN_TOKENS`, Feather icons и существующие feature-компоненты.
- Orchestrator держит unrelated user changes отдельно и не завершает задачу с известными реальными проблемами в затронутом scope.
- Для visible web UI обязательны browser preview, screenshot и console check.

## Рабочий цикл AI-инженера

1. Сначала зафиксируй scope: какие user-facing сценарии, файлы и project rules могут быть затронуты.
2. Найди существующий путь реализации через поиск по компонентам, hooks, services, utils и тестам.
3. Перед правкой проверь текущую ветку и `git status --short`; работай только на `main`, а если текущая ветка не `main`, остановись и уточни дальнейшие действия.
4. Вноси маленький diff, который решает задачу без побочных рефакторингов.
5. Складывай временную отладочную информацию только в игнорируемые локальные папки (`.codex-temp/`, `.codex-debug/`) и удаляй всё ненужное перед передачей результата.
6. Чини все реальные проблемы, которые нашёл в затронутой зоне или проверках: падающие тесты, runtime errors, broken UI states, direct external-link нарушения, dead imports и очевидные регрессии. Не оставляй их на потом.
7. Если найденная проблема вне scope, требует недоступного сервера/секретов или рискованной миграции, явно зафиксируй блокер, риск и нужную следующую проверку.
8. После законченного логического блока запускай scope-проверку.
9. В финале перечисли измененные файлы, выполненные проверки и любые остаточные риски.

Полезный шаблон для внутреннего self-check перед кодом:

```text
Тип задачи:
Skills:
Прочитанные docs:
Текущая ветка:
Вероятные файлы:
Риск-зона:
Проверки:
Нужна UI/browser проверка:
Затронуты external links:
Найдены проблемы:
Все найденные проблемы исправлены или явно заблокированы:
```

## Матрица проверок

Выбирай самый узкий надежный набор проверок, который покрывает изменение:

| Scope изменения | Рекомендуемая проверка |
| --- | --- |
| Docs-only без изменения команд/политик | структурно перечитать затронутые Markdown/YAML файлы |
| Малый законченный блок кода | `npm run check:fast` |
| Нужно понять scope без запуска | `npm run check:fast:dry` или `npm run check:changed:dry` |
| Среднее изменение перед PR | `npm run check:preflight` |
| Изменения в web UI | relevant targeted checks + browser preview + screenshot + console check |
| External-link policy | `npm run guard:external-links` или `npm run governance:verify` |
| Крупное или сквозное изменение | `npm run lint` и `npm run test:run` |
| Release/performance | `npm run build:web:prod` + релевантные Lighthouse/performance scripts из `docs/RULES.md` |

Для e2e-авторизации используй `.env.e2e`, если значения уже заданы, и никогда не выводи секреты.

## Быстрая карта поиска

- Routes/pages: `app/`, `screens/`.
- Reusable UI: `components/ui`, затем feature-компоненты в `components/`.
- Business logic: `hooks/`, `services/`, `api/`, `utils/`.
- Android/native rules: `docs/NATIVE_COMPAT_RULES.md`, `app.json`, `eas.json`, platform files `*.android.tsx`, `*.native.tsx`, `*.ios.tsx`, `*.web.tsx`.
- Places catalog: `docs/features/places.md`, `screens/tabs/PlacesScreen.tsx`, `api/places.ts`, `utils/placesCatalog.ts`, `components/places/`.
- Design tokens: `constants/designSystem.ts`, web CSS variables in `app/global.css`.
- External navigation chokepoint: `utils/externalLinks.ts`.
- Tests: `__tests__/` for Jest, `e2e/` for Playwright.
- Governance scripts: `scripts/`, command details in `docs/TESTING.md`.
- Feature maps: `docs/features/`.
- Task format: `tasks/README.md` (правила) + `tasks/000-template.md` (шаблон); новые задачи создавай в `tasks/` по ним — агент `task-author`, команда `/task-new`.

## Кодировка документации

Документация хранится в UTF-8. Если PowerShell показывает кириллицу как `Ð...`/`Ñ...`, сначала перечитай файл с `Get-Content -Encoding UTF8`; не переписывай файл только из-за некорректного отображения консоли.

## Правила обновления skills

- Каждый skill хранится в `.codex/skills/<skill-name>/`.
- Обязательный файл: `SKILL.md` с YAML frontmatter `name` и `description`.
- Рекомендуемый UI metadata-файл: `agents/openai.yaml`.
- Не добавляй README/CHANGELOG внутри папки skill: инструкции должны быть в `SKILL.md`, а длинные справки - в `references/` только при реальной необходимости.
- Описывай в `description`, когда skill должен срабатывать. Тело `SKILL.md` должно быть коротким и операционным.
- После изменения skill проверяй структуру валидатором `skill-creator`, если он доступен.

## Правила обновления документации

- Сначала обновляй существующие канонические файлы: `docs/RULES.md`, `docs/README.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/RELEASE.md`.
- Новый документ добавляй только если существующий файл станет слишком шумным или тема действительно самостоятельная.
- После добавления нового документа обнови `docs/INDEX.md`.
- Не создавай одноразовые отчеты без необходимости.

## Завершение задачи

- Для docs-only и skill-only изменений достаточно структурной проверки затронутых markdown/yaml файлов.
- Если правила затронули команды проверки, external links, release или UI contracts, дополнительно сверяйся с `docs/RULES.md` и запускай релевантные проверки.
