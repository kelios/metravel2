# Codex workflow

Этот файл связывает корневые инструкции, проектную документацию и skills Codex.

## Источники правил

- `AGENTS.md` - короткий обязательный чеклист для любого AI-агента.
- `docs/RULES.md` - основной источник проектных правил.
- `docs/README.md` - карта документации и API-справка.
- `.codex/skills/*/SKILL.md` - специализированные рабочие маршруты Codex.

## Как выбирать skill

- `$metravel-feature-builder`: используй для фич, багфиксов, рефакторинга, API-логики, hooks, services и SEO.
- `$metravel-domain-router`: используй перед реализацией доменных фич travel/map/profile/achievements/quests/PDF/new pages/design-system, чтобы выбрать файлы, owner-boundaries и проверки.
- `$metravel-hook-builder`: используй, когда основная задача — вынести, спроектировать или упростить focused React hooks в `hooks/` или рядом с фичей, сохранив контракты и не добавляя новые `any`.
- `$metravel-ui-guardrails`: добавляй при любых видимых UI-изменениях, работе с media, icons, placeholders, tokens или external links.
- `$metravel-browser-reviewer`: используй для review/fix цикла видимых web-изменений в реальном браузере: diff, snapshot, screenshot, console/network, исправления и reverify.
- `$metravel-refactor-surgeon`: используй для распила god-components, file-complexity guard failures и behavior-preserving extraction без изменения бизнес-логики.
- `$metravel-release-checks`: используй при выборе проверок, подготовке PR, release/deploy и production web validation.
- `$metravel-quality-fixer`: используй, когда нужно прогнать `lint` + Jest + Playwright как единый quality-gate цикл, исправить реальные падения и повторно довести validation до зелёного baseline.
- `$metravel-test-runner`: используй, когда нужно выбрать и прогнать точечные Jest/unit/integration/governance команды, разобрать падение и не оставить известные test-failures в затронутом scope.
- `$metravel-test-writer`: используй, когда нужно написать или обновить unit/integration/governance тесты, зафиксировать контракт бага/фичи и сохранить стабильные assertions без `.skip`.
- `$metravel-e2e-runner`: используй для Playwright/e2e, browser smoke, trace/screenshot evidence, re-run flaky flows и проверки сценариев через `.env.e2e` без вывода секретов.
- `$metravel-performance-analyst`: используй для Lighthouse, bundle/perf budget analysis, baseline comparison и performance validation только по production build или реальному URL.
- `$metravel-growth-analyst`: используй для анализа GA4/GSC/Yandex/affiliate-цифр, SEO/organic роста, пользовательского поведения, drop-off, регистрации, auth и создания маршрутов/статей.
- `$metravel-seo-index-operator`: используй для ежедневной SEO/index рутины, GSC digest, URL Inspection/index status, IndexNow backup, SEO-аудита статей и списка URL для ручной индексации.
- `$metravel-code-reviewer`: используй для focused review diff'а, поиска рисков, rule violations, validation gaps и остаточных проблем перед handoff или approve.
- `$metravel-devops-agent`: используй для подготовки, запуска и проверки deploy на `dev`, `preprod` или `prod`, включая preflight, secret hygiene, server-path safety и post-deploy validation.
- `$metravel-production-smoke`: используй для read-only production health check `metravel.by` после deploy, при 502/white screen/static/API/sitemap подозрениях или регулярном smoke.
- `$metravel-docs-maintainer`: используй при изменении `docs/`, `AGENTS.md`, `.codex/skills` или правил работы Codex.
- `$metravel-task-contract`: используй при создании или ревью FE/BE задач на борде, чтобы заполнить обязательный `Task Contract` и проверить, можно ли двигать задачу в `todo`/`done`.
- `$metravel-sprint-reviewer`: используй для приёмки тикетов активного спринта на MCP task board: проверить Task Contract/Done gate реальными тестами/browser/API evidence и двигать только подтвержденное в `done`.
- `$metravel-backend-diagnostician`: используй для read-only диагностики backend/API/5xx/contract mismatch, сверки backend status с бордом и оформления back-задач без правки backend-кода.
- `$metravel-article-editor-agent`: используй для редактирования, создания, публикации и проверки статей через `/api/articles`, правки HTML/SEO тела статьи, добавления generated images и безопасной работы с токеном из `.secrets`.
- `$metravel-codex-orchestrator`: используй как верхний self-check для сложных или многошаговых задач: triage, минимальный набор skills, role prompts, validation plan, handoff и final self-check по правилам проекта.
- `$metravel-agent-workflow`: используй для координации ролей business analyst, system architect, designer, programmer, QA, reviewer и DevOps.
- `$metravel-project-analyst`: используй для read-only анализа структуры проекта, активных фич, зависимостей, validation surface, risk hotspots и выбора следующих агентов перед крупной задачей.
- `$metravel-android-developer`: используй для Android/native разработки и отладки Expo/React Native: platform files, native crashes, Expo modules, permissions, SecureStore, push, native map, web-first код в Android bundle; после фиксов сверяй Android device coverage с `docs/MANUAL_TEST_CASES.md` `AND-USB-*`.
- `$metravel-mobile-tester`: используй для read-only QA мобильных сценариев на mobile web и Android/native: responsive layout, touch targets, navigation, USB device/dev-client smoke, Maestro flows, screenshots/logs/evidence и retest.
- `$metravel-business-analyst`: используй для превращения продуктовой идеи в feature brief, user stories, acceptance criteria, non-goals, metrics и risks.
- `$metravel-system-architect`: используй для technical design, review diff, risk mapping, validation plan и безопасного разбиения работ.
- `$metravel-qa-agent`: используй для read-only тестирования, browser/e2e exploration, bug reports и re-test фиксов.

Подключай только те skills, которые реально нужны задаче. Если skill требует дополнительные docs, читай только релевантные файлы.

## Экономичный запуск skills и агентов

Начинай с одного профильного skill. Повышай уровень до `$metravel-codex-orchestrator` или `$metravel-agent-workflow` только когда это снижает риск: неясный scope, несколько ролей, production/release, mobile/native, e2e, внешние зависимости или обязательная независимая проверка.

| Класс задачи | Стартовый маршрут | Когда повышать уровень |
| --- | --- | --- |
| Документация, правила, skills | `$metravel-docs-maintainer` | Добавь `$metravel-codex-orchestrator`, если меняется workflow нескольких ролей, правила проверок или skill-selection policy. |
| Простая автоматизация и проверки | `$metravel-test-runner` для узких тестов; `$metravel-release-checks` для выбора gate; `$metravel-task-contract` для задач на борде | `$metravel-quality-fixer` только для полного quality-gate/fix цикла; `$metravel-devops-agent` только для явного build/deploy/release target. |
| Read-only анализ проекта | `$metravel-project-analyst` | `$metravel-agent-workflow` нужен только если анализ сразу передается в BA/architect/implementation/QA/review цепочку. |
| Product/growth/performance анализ | `$metravel-business-analyst`, `$metravel-growth-analyst` или `$metravel-performance-analyst` по домену | Добавь architect/reviewer только когда из анализа сразу рождается high-risk implementation plan. |
| Обычная разработка, bugfix, refactor | `$metravel-domain-router` для доменного scope, затем `$metravel-feature-builder`; добавь `$metravel-ui-guardrails`, `$metravel-hook-builder`, `$metravel-refactor-surgeon` или `$metravel-test-writer` только по затронутой области | `$metravel-codex-orchestrator` для широкого/неясного scope; `$metravel-agent-workflow` для раздельных BA/architect/QA/reviewer стадий. |
| Статьи и article media | `$metravel-article-editor-agent` | Добавь orchestrator для bulk/high-risk правок, publish/unpublish серий или связанных SEO/API/UI проверок. |
| Mobile/Android | `$metravel-mobile-tester` для read-only QA; `$metravel-android-developer` для фиксов | `$metravel-agent-workflow` для цикла reproduce -> fix -> retest -> review или когда затронуты web + native одновременно. |
| SEO/index operations | `$metravel-seo-index-operator` | Добавь `$metravel-growth-analyst` для месячной стратегии; `$metravel-article-editor-agent` или `$metravel-feature-builder` только когда из аудита следует content/code change. |
| Production smoke | `$metravel-production-smoke` | `$metravel-devops-agent` нужен только для deploy/rollback; `$metravel-backend-diagnostician` — для подтвержденных API/backend failures. |

Не запускай "всех агентов" для обычной задачи. BA, Project Analyst, Growth Analyst, QA, Mobile Tester и reviewer по умолчанию read-only и должны возвращать компактный артефакт, а не менять код. Для docs-only изменений достаточно структурно перечитать Markdown/YAML; для простой автоматизации запускай самый узкий надежный command и сначала проверь operation gate, если команда относится к долгим эксклюзивным операциям.

## Быстрый triage задачи

Перед чтением большого контекста определи тип задачи и риск:

| Тип задачи | Минимальный контекст | Обязательные акценты |
| --- | --- | --- |
| Feature, bugfix, refactor | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, профильный feature-doc при наличии | переиспользование существующих компонентов, hooks, utils; минимальный diff |
| Domain-specific feature work | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `$metravel-domain-router`, профильный feature-doc при наличии | выбрать domain owner map для travel/map/profile/achievements/quests/PDF/new pages; затем подключить feature/ui/test/refactor skills по фактическому scope |
| Hooks / logic extraction | `AGENTS.md`, `docs/RULES.md`, `docs/DEVELOPMENT.md`, профильный feature-doc, ближайшие существующие hooks | выносить focused hook без лишней абстракции, сохранять client/server state boundaries, не добавлять новые `any` |
| Component split / file complexity | `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, `$metravel-refactor-surgeon`, ближайшие tests | behavior-preserving extraction, explicit props, no business-logic rewrite, targeted checks + browser evidence for visible UI |
| Backend task planning | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/TASK_BOARD_MCP.md`, `$metravel-task-contract` | новые FE/BE/backend задачи создавай на общем MCP task board через `ticket-board` (`metravel_task_create`); заполняй `area=front/back`, active sprint, Task Contract, dependencies/blockers и validation/Done gate; при `HTTP 401` сначала обнови staff token через `.env.e2e` по `docs/TASK_BOARD_MCP.md`; локальные `tasks/*.md` используй только как временный fallback после неуспешного token refresh с последующим sync/import |
| Task board FE/BE contract | `docs/TASK_BOARD_MCP.md`, `$metravel-task-contract`, профильный feature-doc при наличии | каждая FE/BE задача на борде должна иметь `Task Contract`: scope, user-visible result, data/API contract, dependencies, fallback/mock policy, validation и Done gate; без runtime evidence не двигать в `done` |
| Приёмка спринта / закрытие тикетов | `AGENTS.md`, `docs/RULES.md`, `docs/TASK_BOARD_MCP.md`, `$metravel-sprint-reviewer`, `$metravel-task-contract` | только board acceptance; проход по `review`/`testing` тикетам активного спринта; без Task Contract и runtime evidence не двигать в `done`; проваленные вернуть в `review`/`blocked_by` с evidence |
| Видимый UI, media, icons, tokens | всё из feature-контекста + `$metravel-ui-guardrails` | проверка в браузере на web, screenshot, отсутствие новых console errors |
| Browser review / visible regression fix | всё из UI-контекста + `$metravel-browser-reviewer` | diff review + browser snapshot/screenshot/console/network; исправить real issues и reverify |
| External links | `docs/RULES.md`, `docs/TESTING.md`, `utils/externalLinks.ts` | никаких direct `window.open(...)` и `Linking.openURL(...)` вне chokepoint |
| Article editing / generated article images | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/DEVELOPMENT.md`, `$metravel-article-editor-agent` | токен только из `.secrets`/env без вывода значения; backup перед write; не использовать интернет-картинки; generated images только как фотореалистичные raster-файлы через `imagegen`/licensed-local source; никаких SVG/Playwright/схематичных placeholder-картинок; verify через API и страницу |
| Test running | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, профильный feature-doc при наличии | выбрать самый узкий надёжный test command, сначала проверить operation gate, не дублировать активный full/preflight/e2e run, не оставлять `.skip`, после фикса rerun обязателен |
| Repo-wide quality fix | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/DEVELOPMENT.md`, `docs/RELEASE.md` | запустить lint + Jest + Playwright, исправить реальные падения, повторить проверки и явно отметить только несвязанные блокеры |
| Test writing | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, профильный feature-doc, ближайшие существующие тесты | писать тест на ближайшем подходящем уровне, фиксировать реальный контракт, избегать flaky assertions |
| Browser / E2E | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `.env.e2e` при необходимости, профильный feature-doc | Playwright/browser flow, secret hygiene, screenshot/trace evidence, console/runtime checks |
| Android/native development | `AGENTS.md`, `docs/RULES.md`, `docs/NATIVE_COMPAT_RULES.md`, `docs/DEVELOPMENT.md`, `docs/MANUAL_TEST_CASES.md`, профильный feature-doc | web-first правило: не ломать production web; platform files вместо больших условий; native governance; device verify pending без эмулятора/устройства |
| Mobile QA | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/NATIVE_COMPAT_RULES.md`, `docs/MANUAL_TEST_CASES.md`, профильный feature-doc | read-only mobile web/native checks, `AND-USB-*` для подключенного Android, Maestro где доступен, touch/layout/runtime evidence, no secrets, баги роутить к профильному owner |
| Performance analysis | `docs/RULES.md`, `docs/TESTING.md`, `docs/RELEASE.md`, профильный perf-doc (`docs/TRAVEL_PERFORMANCE_REFACTOR.md` при travel scope) | только production build или real URL, baseline comparison, Lighthouse/bundle budgets |
| Growth / funnel analysis | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/CODEX.md`, `docs/GROWTH_PLAN.md`, `$metravel-growth-analyst` | свежие GA4/GSC stats, абсолютные даты, no secrets, факты отдельно от гипотез, instrumentation gaps и handoff к feature/test/ui skills |
| SEO / indexing operations | `AGENTS.md`, `docs/RULES.md`, `docs/GROWTH_PLAN.md`, `$metravel-seo-index-operator` | GSC/index data только из scripts/API/manual user metrics; не выдумывать цифры; owner URL list отдельно от code/content tasks |
| Backend/API diagnosis | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/TASK_BOARD_MCP.md`, `$metravel-backend-diagnostician` | backend read-only, production GET/HEAD probes only, back-задачи через board с Task Contract/evidence |
| Production smoke | `AGENTS.md`, `docs/RULES.md`, `docs/RELEASE.md`, `$metravel-production-smoke` | read-only GET/browser probes по real URL; no deploy/rollback; route confirmed failures to frontend/backend owner |
| Code review | `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, профильный feature-doc, diff validation logs | lead with findings, проверять project-rule compliance, known failures, missing tests и residual risks |
| SEO / route pages | `docs/DEVELOPMENT.md` SEO-раздел | `buildCanonicalUrl`, `buildOgImageUrl`, `LazyInstantSEO` |
| Release / deploy / performance | `docs/RELEASE.md`, `docs/PRODUCTION_CHECKLIST.md`, `$metravel-release-checks`, `$metravel-devops-agent` | operation gate перед build/deploy/rebuild/test gate, production build/export, explicit deploy target, secret hygiene, реальные URL для post-deploy проверок |
| Docs / skills | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл | обновляй существующие canonical docs, не создавай одноразовые отчеты |
| Codex self-orchestration | `AGENTS.md`, `docs/CODEX.md`, `docs/RULES.md`, `docs/README.md` | task triage, smallest skill set, role prompt pattern, validation plan, final self-check |
| Project analysis / onboarding | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл, `package.json`, `docs/INDEX.md` при необходимости | read-only карта структуры, активных фич, validation surface, risk hotspots и recommended agents; не создавай отчет без запроса |
| Multi-agent workflow | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл, нужные role skills | роли работают по контрактам; QA и BA не меняют код; programmer чинит подтвержденные баги; reviewer проверяет diff и validation; DevOps деплоит только при явном target env |

Если задача затрагивает несколько строк таблицы, бери объединение контекста, но не загружай справки, которые не помогают текущему решению.

## Multi-agent workflow

Используй `$metravel-agent-workflow`, когда задача требует систему ролей, баг-цикл или разделение discovery/design/implementation/validation/review.

Не используй `$metravel-agent-workflow` для docs-only, одиночного bugfix/refactor, простой проверки, одного board-contract действия или read-only анализа без дальнейшей реализации. В этих случаях дешевле и безопаснее один профильный skill плюс scope-based validation.

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
3. `$metravel-growth-analyst` анализирует GA4/GSC/Yandex/manual stats, SEO/organic рост, registration/auth/content funnels и instrumentation gaps, когда задача начинается со статистики или поведения пользователей.
4. `$metravel-business-analyst` формирует `Feature Brief`: problem, audience, user stories, acceptance criteria, non-goals, metrics, risks, open questions.
5. `$metravel-system-architect` формирует `Technical Design`: reuse points, affected modules, API/data/UI/external-link impact, implementation steps, validation plan.
6. `$metravel-ui-guardrails` формирует UI contract для видимых web/mobile состояний, если задача затрагивает интерфейс.
7. `$metravel-domain-router` выбирает feature-owner map для travel/map/profile/achievements/quests/PDF/new pages, если scope доменный.
8. `$metravel-android-developer` подключай для Android/native поведения, native crashes, Expo modules, platform files и device-specific fixes.
9. `$metravel-hook-builder` подключай дополнительно, если основной объём работы — вынос локальной логики в hooks или cleanup hook boundaries.
10. `$metravel-refactor-surgeon` подключай для behavior-preserving split больших компонентов и file-complexity violations.
11. `$metravel-feature-builder` реализует минимальный diff по утвержденному design/brief.
12. `$metravel-article-editor-agent` выполняет article API/content операции, если задача про статьи, HTML тела, generated images или publish/unpublish.
13. `$metravel-seo-index-operator` выполняет SEO/index operations и формирует owner/code/content split.
14. `$metravel-backend-diagnostician` диагностирует backend/API blockers read-only и готовит back-задачи/evidence.
15. `$metravel-task-contract` проверяет обязательный контракт FE/BE задачи перед стартом, review и `done`, особенно когда FE зависит от BE endpoints/fields/events.
16. `$metravel-code-reviewer` делает focused review pass, если нужен отдельный reviewer без расширенного architecture-design шага.
17. `$metravel-browser-reviewer` делает browser review/fix pass для видимых web-изменений.
18. `$metravel-mobile-tester` проверяет mobile web или Android/native сценарии и создает `Mobile QA Pass` или `Bug Report`.
19. `$metravel-qa-agent` тестирует общий сценарий read-only и создает `Bug Report` или `QA Pass`.
20. `$metravel-sprint-reviewer` принимает тикеты активного спринта по Done gate и двигает только evidence-backed задачи в `done`.
21. `$metravel-production-smoke` выполняет read-only smoke `metravel.by` после deploy или при аварийной проверке.
22. `$metravel-system-architect` в review mode проверяет findings, diff, проверки, known risks и соответствие правилам, когда нужен архитектурный review.
23. `$metravel-devops-agent` готовит и выполняет deploy/build/release только при явном запросе на deploy/release, с environment gate, preflight и post-deploy validation.

Стандартный bug loop:

1. `$metravel-qa-agent` ходит по приложению, воспроизводит проблему и создает структурированный `Bug Report`.
2. `$metravel-feature-builder` чинит один подтвержденный bug report за раз.
3. `$metravel-hook-builder` подключай, если bugfix в основном упирается в неудачную hook-архитектуру или дублирующуюся hook-логику.
4. `$metravel-qa-agent` re-test'ит фикс.
5. `$metravel-code-reviewer` review'ит итоговый diff и validation; `$metravel-system-architect` подключай дополнительно для high-risk design review.

Ролевые ограничения:

- BA, QA и reviewer по умолчанию не меняют код.
- Codex Orchestrator не подменяет профильные роли; он выбирает маршрут, проверяет правила и держит handoff компактным.
- Перед передачей роли на deploy, release/build, server rebuild/restart, full/preflight tests, Playwright/e2e или Lighthouse orchestrator должен проверить operation gate из `AGENTS.md`/`docs/RULES.md`; если такая операция уже идет для того же target, новый агент не запускает дубль и фиксирует blocker/ожидание.
- Любая FE/BE задача на общем борде без `Task Contract` считается неготовой к старту и к `done`; ticket-board/оркестратор должны сначала дописать контракт или вернуть задачу в refinement.
- Любая новая задача должна попасть в текущий active sprint; если board API вернул `401`, ticket-board/оркестратор обязан обновить staff token через `.env.e2e` по `docs/TASK_BOARD_MCP.md` до создания локального fallback.
- Project Analyst только анализирует и не меняет файлы, если пользователь отдельно не попросил перейти к docs/code changes.
- Backend Diagnostician не правит backend/frontend код; он дает диагноз, read-only probes и board follow-up.
- Mobile Tester по умолчанию не меняет код; он дает evidence и баг-репорты для `$metravel-android-developer`, `$metravel-feature-builder` или `$metravel-ui-guardrails`.
- Android Developer не меняет release/build configs (`app.json`, `eas.json`, `plugins/**`, `scripts/**`) без явного запроса и не заявляет Android-ready без device/emulator evidence.
- Programmer не начинает реализацию без bug report, feature brief или явного user request.
- Refactor Surgeon не меняет бизнес-логику и не делает редизайн; только behavior-preserving extraction.
- Sprint Reviewer не пишет feature code и не двигает `done` без runtime evidence.
- Production Smoke ничего не деплоит и не мутирует прод; только read-only health evidence.
- DevOps agent не деплоит `prod` без явного production deploy запроса и не меняет серверные/SSL пути без проверки на целевом host.
- Article Editor Agent не выводит токены из `.secrets`, не использует интернет-картинки без явного разрешения, делает rollback snapshot перед записью и проверяет результат после write.
- Designer не создает отдельную дизайн-систему: использует `components/ui`, `DESIGN_TOKENS`, Feather icons и существующие feature-компоненты.
- Orchestrator держит unrelated user changes отдельно и не завершает задачу с известными реальными проблемами в затронутом scope.
- Для visible web UI обязательны browser preview, screenshot и console check.

## Рабочий цикл AI-инженера

1. Сначала зафиксируй scope: какие user-facing сценарии, файлы и project rules могут быть затронуты.
2. Найди существующий путь реализации через поиск по компонентам, hooks, services, utils и тестам.
3. Перед правкой проверь текущую ветку и `git status --short`; работай только на `main`, а если текущая ветка не `main`, остановись и уточни дальнейшие действия.
4. Перед долгими эксклюзивными операциями проверь operation gate: не запускай дубль deploy/build/rebuild/full tests/e2e/Lighthouse, если другой агент уже выполняет ту же операцию для того же target.
5. Вноси маленький diff, который решает задачу без побочных рефакторингов.
6. Складывай временную отладочную информацию только в игнорируемые локальные папки (`.codex-temp/`, `.codex-debug/`) и удаляй всё ненужное перед передачей результата.
7. Чини все реальные проблемы, которые нашёл в затронутой зоне или проверках: падающие тесты, runtime errors, broken UI states, direct external-link нарушения, dead imports и очевидные регрессии. Не оставляй их на потом.
8. Если найденная проблема вне scope, требует недоступного сервера/секретов или рискованной миграции, явно зафиксируй блокер, риск и нужную следующую проверку.
9. После законченного логического блока запускай scope-проверку.
10. В финале перечисли измененные файлы, выполненные проверки и любые остаточные риски.

Полезный шаблон для внутреннего self-check перед кодом:

```text
Тип задачи:
Skills:
Прочитанные docs:
Текущая ветка:
Вероятные файлы:
Риск-зона:
Проверки:
Operation gate:
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

### Deploy commands for Codex

- Production deploys require an explicit user request and `$metravel-devops-agent`.
- On a normal machine with working `rsync`, use `./build-prod.sh prod`.
- On this Windows/Codex machine, do not use `./build-prod.sh prod` as the final deploy command; its
  local `rsync` step is known to fail. Use:

```bash
bash /d/metravel/ops/deploy-frontend.sh
```

This wrapper still uses the canonical build/guards through `DEPLOY=0 bash ./build-prod.sh prod`, then
deploys with `tar+ssh`, performs an atomic server swap, verifies health, and rolls back on failure.

## Быстрая карта поиска

- Routes/pages: `app/`, `screens/`.
- Reusable UI: `components/ui`, затем feature-компоненты в `components/`.
- Business logic: `hooks/`, `services/`, `api/`, `utils/`.
- Android/native rules and device cases: `docs/NATIVE_COMPAT_RULES.md`, `docs/MANUAL_TEST_CASES.md`, `e2e/maestro/`, `app.json`, `eas.json`, platform files `*.android.tsx`, `*.native.tsx`, `*.ios.tsx`, `*.web.tsx`.
- Places catalog: `docs/features/places.md`, `screens/tabs/PlacesScreen.tsx`, `api/places.ts`, `utils/placesCatalog.ts`, `components/places/`.
- Design tokens: `constants/designSystem.ts`, web CSS variables in `app/global.css`.
- External navigation chokepoint: `utils/externalLinks.ts`.
- Tests: `__tests__/` for Jest, `e2e/` for Playwright.
- Governance scripts: `scripts/`, command details in `docs/TESTING.md`.
- Feature maps: `docs/features/`.
- Task board: `docs/TASK_BOARD_MCP.md`; новые FE/BE/backend и Android QA задачи создавай на общем MCP task board через `ticket-board` в текущем active sprint. При `401` обновляй staff token через `.env.e2e`; `tasks/README.md` и `tasks/000-template.md` остаются только fallback/migration форматом, не основным workflow.

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
