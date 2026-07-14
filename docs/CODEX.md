# Codex workflow

Этот файл связывает корневые инструкции, проектную документацию и skills Codex.

## Источники правил

- `AGENTS.md` - короткий обязательный чеклист для любого AI-агента.
- `docs/RULES.md` - основной источник проектных правил.
- `docs/README.md` - карта документации и API-справка.
- `.codex/skills/*/SKILL.md` - специализированные рабочие маршруты Codex.

Backend boundary: в этом frontend workspace Codex не реализует backend/Django/API/server изменения. Backend можно анализировать read-only через `$metravel-backend-diagnostician`, безопасные probes и `area=back` задачи на борде; backend working tree не редактируется.

## Как выбирать skill

- `$metravel-feature-builder`: используй для фич, багфиксов, рефакторинга, API-логики, hooks, services и SEO.
- `$metravel-domain-router`: используй перед реализацией доменных фич travel/map/profile/achievements/quests/PDF/new pages/design-system, чтобы выбрать файлы, owner-boundaries и проверки.
- `$metravel-travel-expert`: используй для travel list/details/wizard, route points, save/moderation и export/PDF, когда задача явно в travel-домене.
- `$metravel-map-expert`: используй для MapPage, places, Leaflet web, native map/WebView, ORS, маркеров и попапов.
- `$metravel-profile-expert`: используй для личного/публичного профиля, settings, подписок, счётчиков, profile IA и profile embeds.
- `$metravel-achievements-expert`: используй для achievements/badges, рангов, XP, peer-наград, achievement mocks и profile/AuthorCard embeds.
- `$metravel-quest-expert`: используй для quest feature code: список/деталь/прохождение, адаптеры, answer checker, карты и печать.
- `$metravel-quest-writer`: используй для research и написания нового городского квеста, проектирования связного пешего маршрута, intro/steps/finale, заданий, hints и answer patterns; творческий текст начинай только после отдельного confirmation question.
- `$metravel-quest-editor`: используй для редактирования существующего quest content: тексты шагов, задания, подсказки и answer patterns.
- `$metravel-quest-geo-verifier`: используй для read-only сверки координат quest points с реальными объектами через OSM/Nominatim/geocheck.
- `$metravel-hook-builder`: используй, когда основная задача — вынести, спроектировать или упростить focused React hooks в `hooks/` или рядом с фичей, сохранив контракты и не добавляя новые `any`.
- `$metravel-ui-guardrails`: добавляй при любых видимых UI-изменениях, работе с media, icons, placeholders, tokens или external links.
- `$metravel-design-auditor`: используй для read-only сквозного аудита нескольких экранов, consistency matrix, design-token drift, responsive/mobile parity и UI-state/accessibility evidence.
- `$metravel-visual-asset-designer`: используй для брендовых raster icons, badge/app/marketing art и наборов ассетов через imagegen; обычные UI-actions остаются на существующих primitives/Feather, published travel/article media — только real/licensed/local или photorealistic raster.
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
- `$metravel-security-reviewer`: используй для frontend security review по XSS/sanitization, URLs/redirects, secrets/tokens, WebView/deep links и production dependencies; review остаётся read-only без явного запроса на fix.
- `$metravel-devops-agent`: используй для подготовки, запуска и проверки deploy на `dev`, `preprod` или `prod`, включая preflight, secret hygiene, server-path safety, approved deploy-command selection, rollback/recovery и post-deploy validation.
- `$metravel-google-play-operator`: используй только для явного Android Google Play build/submit/track status/promotion запроса; closed testing проверяется в `alpha`, public production требует отдельного explicit gate.
- `$metravel-production-smoke`: используй для read-only production health check `metravel.by` после deploy, при 502/white screen/static/API/sitemap подозрениях или регулярном smoke.
- `$metravel-docs-maintainer`: используй при изменении `docs/`, `AGENTS.md`, `.codex/skills` или правил работы Codex.
- `$metravel-prompt-maintainer`: используй для аудита и обновления `docs/*PROMPTS.md`, `assets/**/PROMPT.md`, skill UI metadata/default prompts, prompt-template consistency и воспроизводимости generated assets; сам creative article/quest content остаётся у профильного content skill.
- `$metravel-task-contract`: используй при создании или ревью FE/BE задач на борде, чтобы заполнить обязательный `Task Contract` и проверить, можно ли двигать задачу в `todo`/`done`.
- `$metravel-ticket-board`: используй как оператора общего MCP task board для list/create/update/sync задач и спринтов; он не пишет feature code.
- `$metravel-sprint-reviewer`: используй для приёмки тикетов активного спринта на MCP task board: проверить Task Contract/Done gate реальными тестами/browser/API evidence и двигать только подтвержденное в `done`.
- `$metravel-backend-diagnostician`: используй для read-only диагностики backend/API/5xx/contract mismatch, сверки backend status с бордом и оформления back-задач без правки backend-кода.
- `$metravel-article-editor-agent`: используй для article и travel-guide API, photo-folder drafts, media, author/publish verification и безопасной работы с токеном из `.secrets`; любые творческие правки текста статьи сначала подтверждай отдельным вопросом.
- `$metravel-codex-orchestrator`: используй как верхний self-check для сложных или многошаговых задач: triage, минимальный набор skills, role prompts, validation plan, handoff и final self-check по правилам проекта.
- `$metravel-agent-workflow`: используй для координации ролей business analyst, system architect, designer, programmer, QA, reviewer и DevOps.
- `$metravel-project-analyst`: используй для read-only анализа структуры проекта, активных фич, зависимостей, validation surface, risk hotspots и выбора следующих агентов перед крупной задачей.
- `$metravel-android-developer`: используй для Android/native разработки и отладки Expo/React Native: platform files, native crashes, Expo modules, permissions, SecureStore, push, native map, web-first код в Android bundle; после фиксов сверяй Android device coverage с `docs/MANUAL_TEST_CASES.md` `AND-USB-*` на локально собранной и установленной по USB сборке; не запускай Android EAS/production builds без явного запроса.
- `$metravel-ios-developer`: используй для iPhone/iPad, `.ios.tsx`, WebKit/WKWebView, safe-area, APNs, Face ID, ATS, Universal Links, iOS permissions и native-map parity; не заявляй iOS-ready без simulator/device evidence и не запускай EAS iOS build/submit без явного запроса.
- `$metravel-mobile-tester`: используй для read-only QA мобильных сценариев на mobile web, Android и доступном iOS simulator/device: responsive layout, touch targets, navigation, USB Android local-build smoke, Maestro flows, screenshots/logs/evidence и retest; не подменяй device QA web/EAS evidence без явного запроса.
- `$metravel-play-campaign-tester`: используй для настроенной Google Play reciprocity campaign: ежедневный USB-device pass, community assignments, app updates, screenshots/crash evidence и общий campaign log; не выполняй покупки, отзывы, удаления, смену аккаунта или переписку без отдельного разрешения.
- `$metravel-business-analyst`: используй для превращения продуктовой идеи в feature brief, user stories, acceptance criteria, non-goals, metrics и risks.
- `$metravel-system-architect`: используй для technical design, review diff, risk mapping, validation plan и безопасного разбиения работ.
- `$metravel-qa-agent`: используй для read-only тестирования, browser/e2e exploration, bug reports и re-test фиксов.

Подключай только те skills, которые реально нужны задаче. Если skill требует дополнительные docs, читай только релевантные файлы.

## Экономичный запуск skills и агентов

Начинай с одного профильного skill. Повышай уровень до `$metravel-codex-orchestrator` или `$metravel-agent-workflow` только когда это снижает риск: неясный scope, несколько ролей, production/release, mobile/native, e2e, внешние зависимости или обязательная независимая проверка.

| Класс задачи | Стартовый маршрут | Когда повышать уровень |
| --- | --- | --- |
| Документация, правила, skills | `$metravel-docs-maintainer`; добавь `$metravel-prompt-maintainer` только для prompt specs, asset prompts или `agents/openai.yaml` | Добавь `$metravel-codex-orchestrator`, если меняется workflow нескольких ролей, правила проверок или skill-selection policy. |
| Простая автоматизация и проверки | `$metravel-test-runner` для узких тестов; `$metravel-release-checks` для выбора gate; `$metravel-ticket-board` + `$metravel-task-contract` для задач на борде | `$metravel-quality-fixer` только для полного quality-gate/fix цикла; `$metravel-devops-agent` только для явного build/deploy/release target. |
| Read-only анализ проекта | `$metravel-project-analyst` | `$metravel-agent-workflow` нужен только если анализ сразу передается в BA/architect/implementation/QA/review цепочку. |
| Product/growth/performance/security/design анализ | `$metravel-business-analyst`, `$metravel-growth-analyst`, `$metravel-performance-analyst`, `$metravel-security-reviewer` или `$metravel-design-auditor` по домену | Добавь architect/implementation только когда анализ явно должен перейти в правки; review-запрос сам по себе остаётся read-only. |
| Обычная разработка, bugfix, refactor | `$metravel-domain-router` для доменного scope, затем профильный доменный субагент (`$metravel-travel-expert`, `$metravel-map-expert`, `$metravel-profile-expert`, `$metravel-achievements-expert`, `$metravel-quest-expert`) и `$metravel-feature-builder`; добавь `$metravel-ui-guardrails`, `$metravel-hook-builder`, `$metravel-refactor-surgeon` или `$metravel-test-writer` только по затронутой области | `$metravel-codex-orchestrator` для широкого/неясного scope; `$metravel-agent-workflow` для раздельных BA/architect/QA/reviewer стадий. |
| Статьи и article media | `$metravel-article-editor-agent` | Добавь orchestrator для bulk/high-risk правок, publish/unpublish серий или связанных SEO/API/UI проверок. |
| Новый квест или полная переработка quest content | `$metravel-quest-writer`; после отдельного подтверждения творческого текста добавь `$metravel-quest-geo-verifier`, а `$metravel-quest-expert` только для data/migration/code scope | Добавь orchestrator для нескольких городов, production publication или связанного media/code workflow. |
| Mobile/Android/iOS | `$metravel-mobile-tester` для read-only QA, `$metravel-android-developer` или `$metravel-ios-developer` для platform fixes; `$metravel-play-campaign-tester` только для reciprocity campaign | `$metravel-agent-workflow` для reproduce -> fix -> retest -> review или web + native scope. EAS/store actions — только explicit request через `$metravel-google-play-operator`/DevOps. |
| Google Play release | `$metravel-google-play-operator` + `$metravel-release-checks` | Build/submit/promotion требуют явного exact target; `production` не выводится из общего слова «релиз». |
| SEO/index operations | `$metravel-seo-index-operator` | Добавь `$metravel-growth-analyst` для месячной стратегии; `$metravel-article-editor-agent` или `$metravel-feature-builder` только когда из аудита следует content/code change. |
| Production smoke | `$metravel-production-smoke` | `$metravel-devops-agent` нужен только для deploy/rollback; `$metravel-backend-diagnostician` — для подтвержденных API/backend failures. |

Не запускай "всех агентов" для обычной задачи. BA, Project Analyst, Growth Analyst, QA, Mobile Tester и reviewer по умолчанию read-only и должны возвращать компактный артефакт, а не менять код. Для docs-only изменений достаточно структурно перечитать Markdown/YAML; для простой автоматизации запускай самый узкий надежный command и сначала проверь operation gate, если команда относится к долгим эксклюзивным операциям.

## Совместимость Claude → Codex

Claude-конфигурация остаётся историческим источником отдельных operational facts, но новые маршруты должны запускаться через Codex skills и канонические project docs. Не копируй модель-специфичные `tools`, `model`, permissions или preview-названия буквально.

| Claude agents / skills | Codex маршрут |
| --- | --- |
| `android-expert`, `android-native-audit`, `android-qa-sweep` | `$metravel-android-developer` + `$metravel-mobile-tester` |
| `ios-expert` | `$metravel-ios-developer` |
| `android-builder`, `android-publisher`, `android-release` | `$metravel-google-play-operator` + `$metravel-release-checks`; web/server deploy остаётся у `$metravel-devops-agent` |
| `play-tester`, `play-update-watcher` | `$metravel-play-campaign-tester`; общий operational state пока живёт в `.claude/play-testing/` без дублирования |
| `metravel-design-audit`, `metravel-design-system`, `review-uiux` | `$metravel-design-auditor` для read-only evidence, `$metravel-ui-guardrails` для implementation contract, `$metravel-browser-reviewer` для fix/reverify |
| `metravel-page-new`, `metravel-screen-redesign` | `$metravel-domain-router` + `$metravel-feature-builder` + `$metravel-ui-guardrails` |
| `metravel-icon-art` | `$metravel-visual-asset-designer` + `$metravel-prompt-maintainer` + built-in `imagegen` |
| `review-security` | `$metravel-security-reviewer` |
| `review-performance`, `metravel-slider-perf-guard` | `$metravel-performance-analyst`; slider/perf bilateral gate включён в skill |
| `review-code`, `review-architecture`, `review-auditor` | `$metravel-code-reviewer` и `$metravel-system-architect` |
| `metravel-badge`, `metravel-achievements-audit`, `achievements-expert` | `$metravel-achievements-expert`; artwork при необходимости через `$metravel-visual-asset-designer` |
| `travel-expert`, `metravel-travel-pdf` | `$metravel-travel-expert` |
| `travel-writer`, `metravel-travel-article` | `$metravel-article-editor-agent`; creative prose только после отдельного confirmation gate из `AGENTS.md` |
| `quest-expert`, `metravel-quest`, `metravel-quest-finale` | `$metravel-quest-expert` для code/data и `$metravel-quest-writer` для нового authored content |
| `quest-editor`, `quest-geo-verifier`, `metravel-quest-geocheck` | `$metravel-quest-editor` и `$metravel-quest-geo-verifier` |
| `backend-expert`, `backend-status-sync` | `$metravel-backend-diagnostician` + `$metravel-ticket-board`, backend read-only |
| `ticket-board`, `task-author`, `metravel-issue`, `ticket-flow`, `board-reviewer`, `sprint-review` | `$metravel-ticket-board`, `$metravel-task-contract`, `$metravel-sprint-reviewer` |
| `growth-analyst`, `metravel-seo-expert`, `index-doctor`, `seo-daily`, `metravel-seo-audit` | `$metravel-growth-analyst` и `$metravel-seo-index-operator` |
| `dev-loop`, `guard-enforcer`, `test-author`, `browser-reviewer`, `prod-smoke`, deploy agents | `$metravel-quality-fixer`, `$metravel-test-writer`, `$metravel-browser-reviewer`, `$metravel-production-smoke`, `$metravel-devops-agent` |

Claude slash-команды переносятся как skill-routes, а не как второй набор дублирующих prompt-файлов:

| Claude command | Codex route |
| --- | --- |
| `/auto-dev`, `/bugfix` | `$metravel-codex-orchestrator`/`$metravel-agent-workflow` + domain skill + `$metravel-feature-builder` + QA/review |
| `/changed-summary` | `$metravel-code-reviewer` или обычный read-only `git status`/`git diff` summary |
| `/check-fast`, `/guard-all`, `/preflight` | `$metravel-test-runner` / `$metravel-release-checks`; запускать repository scripts через quality-gate lock |
| `/growth-review` | `$metravel-growth-analyst` |
| `/seo-daily` | `$metravel-seo-index-operator` |
| `/split-component` | `$metravel-refactor-surgeon` |
| `/task-new` | устаревший local-task route заменён `$metravel-ticket-board` + `$metravel-task-contract` |
| `/ticket` | `$metravel-ticket-board` + профильный implementation/test/review route |

Остальная инфраструктура:

- `CLAUDE.md` и `.claude/settings.json` rules перенесены в `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, skills и repository validation commands. Claude hooks не копируются как недоступный Codex-механизм; их инварианты обеспечивают инструкции и quality-gate wrappers.
- `.mcp.json` task-board server уже настроен для Codex в пользовательском `~/.codex/config.toml`; не дублируй secret-loading command в project config.
- Reusable prompt specs и `agents/openai.yaml` поддерживает `$metravel-prompt-maintainer`; проверка — `npm run audit:prompts`.

## Быстрый triage задачи

Перед чтением большого контекста определи тип задачи и риск:

| Тип задачи | Минимальный контекст | Обязательные акценты |
| --- | --- | --- |
| Feature, bugfix, refactor | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, профильный feature-doc при наличии | переиспользование существующих компонентов, hooks, utils; минимальный diff |
| Domain-specific feature work | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `$metravel-domain-router`, профильный feature-doc при наличии | выбрать domain owner map для travel/map/profile/achievements/quests/PDF/new pages; затем подключить доменного субагента (`$metravel-travel-expert`, `$metravel-map-expert`, `$metravel-profile-expert`, `$metravel-achievements-expert`, `$metravel-quest-expert`) и feature/ui/test/refactor skills по фактическому scope |
| Hooks / logic extraction | `AGENTS.md`, `docs/RULES.md`, `docs/DEVELOPMENT.md`, профильный feature-doc, ближайшие существующие hooks | выносить focused hook без лишней абстракции, сохранять client/server state boundaries, не добавлять новые `any` |
| Component split / file complexity | `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, `$metravel-refactor-surgeon`, ближайшие tests | behavior-preserving extraction, explicit props, no business-logic rewrite, targeted checks + browser evidence for visible UI |
| Backend task planning | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/TASK_BOARD_MCP.md`, `$metravel-ticket-board`, `$metravel-task-contract`, `$metravel-backend-diagnostician` | backend только analysis-only: безопасно воспроизведи/сверь контракт, но не редактируй backend repo; новые FE/BE/backend задачи создавай на общем MCP task board через `$metravel-ticket-board` (`metravel_task_create`); заполняй `area=front/back`, active sprint, Task Contract, dependencies/blockers и validation/Done gate; при `HTTP 401` сначала обнови staff token через `.env.e2e` по `docs/TASK_BOARD_MCP.md`; локальные `tasks/*.md` используй только как временный fallback после неуспешного token refresh с последующим sync/import |
| Task board FE/BE contract | `docs/TASK_BOARD_MCP.md`, `$metravel-ticket-board`, `$metravel-task-contract`, профильный feature-doc при наличии | каждая FE/BE задача на борде должна иметь `Task Contract`: scope, user-visible result, data/API contract, dependencies, fallback/mock policy, validation и Done gate; без runtime evidence не двигать в `done` |
| Приёмка спринта / закрытие тикетов | `AGENTS.md`, `docs/RULES.md`, `docs/TASK_BOARD_MCP.md`, `$metravel-sprint-reviewer`, `$metravel-task-contract` | только board acceptance; проход по `review`/`testing` тикетам активного спринта; без Task Contract и runtime evidence не двигать в `done`; проваленные вернуть в `review`/`blocked_by` с evidence |
| Видимый UI, media, icons, tokens | всё из feature-контекста + `$metravel-ui-guardrails` | проверка в браузере на web, screenshot, отсутствие новых console errors |
| Mobile parity / map-place point cards | `docs/RULES.md`, `docs/NATIVE_COMPAT_RULES.md`, `docs/features/map.md`, `docs/features/places.md`, `docs/features/travel.md`, `$metravel-map-expert`, `$metravel-travel-expert`, `$metravel-ui-guardrails`, `$metravel-mobile-tester` для проверки | mobile web, Android и iOS должны совпадать по визуальному контракту; Android device QA требует локальной сборки, установленной по USB; map/place/travel-point карточки используют общий fullscreen point/place template; travel point card tap только фокусит/подсвечивает маркер, marker tap открывает popup |
| Browser review / visible regression fix | всё из UI-контекста + `$metravel-browser-reviewer` | diff review + browser snapshot/screenshot/console/network; исправить real issues и reverify |
| External links | `docs/RULES.md`, `docs/TESTING.md`, `utils/externalLinks.ts` | никаких direct `window.open(...)` и `Linking.openURL(...)` вне chokepoint |
| Article editing / generated article images | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/DEVELOPMENT.md`, `$metravel-article-editor-agent` | токен только из `.secrets`/env без вывода значения; backup перед write; самостоятельная работа только с images/media; творческий текст статьи/квеста - только после отдельного confirmation question; не использовать интернет-картинки; generated images только как фотореалистичные raster-файлы через `imagegen`/licensed-local source; никаких SVG/Playwright/схематичных placeholder-картинок; verify через API и страницу |
| Frontend security review | `AGENTS.md`, `docs/RULES.md`, `$metravel-security-reviewer`, sanitizer/link/storage/deep-link code in scope | concrete PoC/data flow before finding; no secret output; read-only unless fixes explicitly requested; backend/infra → `area=back` evidence |
| Cross-screen design audit | `AGENTS.md`, `docs/RULES.md`, `$metravel-design-auditor`, design tokens/components, feature docs | screenshot/DOM evidence, consistency matrix, no taste-only findings; implementation only when explicitly requested |
| Branded raster asset | `AGENTS.md`, `docs/ICON_ART_PROMPTS.md`, `$metravel-visual-asset-designer`, `$metravel-prompt-maintainer` | reuse first; imagegen for new raster; exact prompt beside tracked asset; no raster replacement for standard Feather UI actions; media-slot restrictions stay authoritative |
| New quest authoring / full quest rewrite | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `$metravel-quest-writer`, текущие quest data/API contracts | отдельный confirmation question до creative text; duplicate check; проверенные факты и onsite tasks; anti-backtracking route; `$metravel-quest-geo-verifier` до publication; API write/publish только по явному запросу |
| Test running | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, профильный feature-doc при наличии | выбрать самый узкий надёжный test command, сначала проверить operation gate, не дублировать активный full/preflight/e2e run, не оставлять `.skip`, после фикса rerun обязателен |
| Repo-wide quality fix | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/DEVELOPMENT.md`, `docs/RELEASE.md` | запустить lint + Jest + Playwright, исправить реальные падения, повторить проверки и явно отметить только несвязанные блокеры |
| Test writing | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, профильный feature-doc, ближайшие существующие тесты | писать тест на ближайшем подходящем уровне, фиксировать реальный контракт, избегать flaky assertions |
| Browser / E2E | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `.env.e2e` при необходимости, профильный feature-doc | Playwright/browser flow, secret hygiene, screenshot/trace evidence, console/runtime checks |
| Android/native development | `AGENTS.md`, `docs/RULES.md`, `docs/NATIVE_COMPAT_RULES.md`, `docs/DEVELOPMENT.md`, `docs/MANUAL_TEST_CASES.md`, профильный feature-doc | web-first правило: не ломать production web; platform files вместо больших условий; native governance; перед `verify pending` проверить `adb devices -l` и использовать подключенный Android со статусом `device` |
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
8. Доменный субагент уточняет ограничения и проверки: `$metravel-travel-expert`, `$metravel-map-expert`, `$metravel-profile-expert`, `$metravel-achievements-expert` или `$metravel-quest-expert`; для нового quest content используй `$metravel-quest-writer`, для правки существующего — `$metravel-quest-editor`, для координат — `$metravel-quest-geo-verifier`.
9. `$metravel-android-developer` или `$metravel-ios-developer` подключай для platform-specific поведения, native crashes, Expo modules и platform files; Android QA выполняй через локальную USB-сборку, iOS не объявляй verified без simulator/device evidence.
10. `$metravel-hook-builder` подключай дополнительно, если основной объём работы — вынос локальной логики в hooks или cleanup hook boundaries.
11. `$metravel-refactor-surgeon` подключай для behavior-preserving split больших компонентов и file-complexity violations.
12. `$metravel-feature-builder` реализует минимальный diff по утвержденному design/brief.
13. `$metravel-article-editor-agent` выполняет article API/media операции, если задача про статьи, generated images или publish/unpublish; творческие текстовые правки делает только после отдельного confirmation question.
14. `$metravel-seo-index-operator` выполняет SEO/index operations и формирует owner/code/content split.
15. `$metravel-backend-diagnostician` диагностирует backend/API blockers read-only и готовит back-задачи/evidence.
16. `$metravel-ticket-board` создаёт/обновляет задачи и спринты на MCP task board; `$metravel-task-contract` проверяет обязательный контракт FE/BE задачи перед стартом, review и `done`, особенно когда FE зависит от BE endpoints/fields/events.
17. `$metravel-code-reviewer` делает focused review pass, если нужен отдельный reviewer без расширенного architecture-design шага.
18. `$metravel-browser-reviewer` делает browser review/fix pass для видимых web-изменений.
19. `$metravel-mobile-tester` проверяет mobile web или Android/native сценарии и создает `Mobile QA Pass` или `Bug Report`.
20. `$metravel-qa-agent` тестирует общий сценарий read-only и создает `Bug Report` или `QA Pass`.
21. `$metravel-sprint-reviewer` принимает тикеты активного спринта по Done gate и двигает только evidence-backed задачи в `done`.
22. `$metravel-production-smoke` выполняет read-only smoke `metravel.by` после deploy или при аварийной проверке.
23. `$metravel-system-architect` в review mode проверяет findings, diff, проверки, known risks и соответствие правилам, когда нужен архитектурный review.
24. `$metravel-google-play-operator` выполняет только явно запрошенный Android store build/submit/track step и подтверждает фактический track/versionCode.
25. `$metravel-devops-agent` готовит и выполняет deploy/build/release только при явном запросе на deploy/release, с environment gate, preflight и post-deploy validation.

Стандартный bug loop:

1. `$metravel-qa-agent` ходит по приложению, воспроизводит проблему и создает структурированный `Bug Report`.
2. `$metravel-feature-builder` чинит один подтвержденный bug report за раз.
3. `$metravel-hook-builder` подключай, если bugfix в основном упирается в неудачную hook-архитектуру или дублирующуюся hook-логику.
4. `$metravel-qa-agent` re-test'ит фикс.
5. `$metravel-code-reviewer` review'ит итоговый diff и validation; `$metravel-system-architect` подключай дополнительно для high-risk design review.

Ролевые ограничения:

- BA, QA и reviewer по умолчанию не меняют код.
- Codex Orchestrator не подменяет профильные роли; он выбирает маршрут, проверяет правила и держит handoff компактным.
- В этом frontend workspace ни одна роль не редактирует backend/Django/API/server working tree. Backend blockers фиксируются через read-only diagnosis и `area=back` board tasks.
- Перед передачей роли на deploy, release/build, Android local/EAS build/install, server rebuild/restart, full/preflight tests, Playwright/e2e или Lighthouse orchestrator должен проверить operation gate из `AGENTS.md`/`docs/RULES.md`; если такая операция уже идет для того же target, новый агент не запускает дубль и фиксирует blocker/ожидание.
- Любая FE/BE задача на общем борде без `Task Contract` считается неготовой к старту и к `done`; ticket-board/оркестратор должны сначала дописать контракт или вернуть задачу в refinement.
- Любая новая задача должна попасть в текущий active sprint; если board API вернул `401`, ticket-board/оркестратор обязан обновить staff token через `.env.e2e` по `docs/TASK_BOARD_MCP.md` до создания локального fallback.
- Project Analyst только анализирует и не меняет файлы, если пользователь отдельно не попросил перейти к docs/code changes.
- Backend Diagnostician не правит backend/frontend код; он дает диагноз, read-only probes и board follow-up.
- Mobile Tester по умолчанию не меняет код; он дает evidence и баг-репорты для `$metravel-android-developer`, `$metravel-ios-developer`, `$metravel-feature-builder` или `$metravel-ui-guardrails`. Для Android evidence использует локально собранную и установленную по USB сборку; для iOS нужен доступный simulator/device; dev-client/export/EAS route допустим только по явному запросу пользователя.
- Android Developer не меняет release/build configs (`app.json`, `eas.json`, `plugins/**`, `scripts/**`) без явного запроса, не запускает Android EAS/cloud/production builds или submits без явной команды пользователя и не заявляет Android-ready без local-build device evidence.
- iOS Developer соблюдает те же config/EAS gates и не заявляет iOS-ready без simulator/device evidence.
- Google Play Operator не запускает build/submit/promotion и не меняет track без явного запроса на точное действие; `alpha` и public `production` не взаимозаменяемы.
- Programmer не начинает реализацию без bug report, feature brief или явного user request.
- Refactor Surgeon не меняет бизнес-логику и не делает редизайн; только behavior-preserving extraction.
- Sprint Reviewer не пишет feature code и не двигает `done` без runtime evidence.
- Production Smoke ничего не деплоит и не мутирует прод; только read-only health evidence.
- DevOps agent не деплоит `prod` без явного production deploy запроса, не меняет серверные/SSL пути без проверки на целевом host и не пишет самодельные `rsync`/`scp`/SSH deploy-команды в обход утвержденных scripts/wrapper.
- Article Editor Agent не выводит токены из `.secrets`, не использует интернет-картинки без явного разрешения, самостоятельно меняет только images/media, переспросом подтверждает любые творческие текстовые правки, делает rollback snapshot перед записью и проверяет результат после write.
- Designer не создает отдельную дизайн-систему: использует `components/ui`, `DESIGN_TOKENS`, Feather icons и существующие feature-компоненты.
- Orchestrator держит unrelated user changes отдельно и не завершает задачу с известными реальными проблемами в затронутом scope.
- Для visible web UI обязательны browser preview, screenshot и console check.

## Рабочий цикл AI-инженера

1. Сначала зафиксируй scope: какие user-facing сценарии, файлы и project rules могут быть затронуты.
2. Найди существующий путь реализации через поиск по компонентам, hooks, services, utils и тестам.
3. Перед правкой проверь текущую ветку и `git status --short`; работай только на `main`, а если текущая ветка не `main`, остановись и уточни дальнейшие действия.
4. Перед долгими эксклюзивными операциями проверь operation gate: не запускай дубль deploy/build/Android install/rebuild/full tests/e2e/Lighthouse, если другой агент уже выполняет ту же операцию для того же target.
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
| Android/native изменения | локальная Android-сборка, установленная на USB-телефон, + релевантные `AND-USB-*`; Android EAS/production builds только по явному запросу |
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
- `scripts/fix-prod.sh` is an emergency production frontend recovery path only. It has its own remote
  deploy lock, prod artifact config gate, in-container atomic swap, old Expo chunk overlap, nginx restart,
  and live chunk/config verification. Use it through `$metravel-devops-agent` only when normal deploy is
  unavailable or explicitly requested for recovery; do not replace approved deploy paths with ad-hoc
  `rsync`, `scp`, or SSH commands.

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
- Task board: `docs/TASK_BOARD_MCP.md`; новые задачи создавай на общем MCP task board через `ticket-board` в текущем active sprint только с `area=front` или `area=back`. Android/iOS/native app bugs относятся к `area=front` с платформенным префиксом/контекстом в title/description; backend/API/server задачи относятся к `area=back`. При `401` обновляй staff token через `.env.e2e`; `tasks/README.md` и `tasks/000-template.md` остаются только fallback/migration форматом, не основным workflow.

## Кодировка документации

Документация хранится в UTF-8. Если PowerShell показывает кириллицу как `Ð...`/`Ñ...`, сначала перечитай файл с `Get-Content -Encoding UTF8`; не переписывай файл только из-за некорректного отображения консоли.

## Правила обновления skills

- Каждый skill хранится в `.codex/skills/<skill-name>/`.
- Обязательный файл: `SKILL.md` с YAML frontmatter `name` и `description`.
- Рекомендуемый UI metadata-файл: `agents/openai.yaml`.
- Не добавляй README/CHANGELOG внутри папки skill: инструкции должны быть в `SKILL.md`, а длинные справки - в `references/` только при реальной необходимости.
- Описывай в `description`, когда skill должен срабатывать. Тело `SKILL.md` должно быть коротким и операционным.
- Для prompt specs, asset-level `PROMPT.md` и `agents/openai.yaml` используй `$metravel-prompt-maintainer`; сохраняй точный prompt рядом с ассетом и не считай chat/commit history единственным источником воспроизводимости.
- После изменений prompt/skill metadata запускай `npm run audit:prompts`.
- После изменения skill проверяй структуру валидатором `skill-creator`, если он доступен.

## Правила обновления документации

- Сначала обновляй существующие канонические файлы: `docs/RULES.md`, `docs/README.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/RELEASE.md`.
- Новый документ добавляй только если существующий файл станет слишком шумным или тема действительно самостоятельная.
- После добавления нового документа обнови `docs/INDEX.md`.
- Не создавай одноразовые отчеты без необходимости.

## Завершение задачи

- Для docs-only и skill-only изменений достаточно структурной проверки затронутых markdown/yaml файлов.
- Если правила затронули команды проверки, external links, release или UI contracts, дополнительно сверяйся с `docs/RULES.md` и запускай релевантные проверки.
