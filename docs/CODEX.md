# Codex workflow

Этот файл связывает корневые инструкции, проектную документацию и skills Codex.

## Источники правил

- `AGENTS.md` - короткий обязательный чеклист для любого AI-агента.
- `docs/RULES.md` - основной источник проектных правил.
- `docs/README.md` - карта документации и API-справка.
- `.codex/skills/*/SKILL.md` - специализированные рабочие маршруты Codex.
- `.agents/skills/openspec-*/SKILL.md` - vendor-generated OpenSpec
  planning/apply routes; project constraints поступают из
  `openspec/config.yaml`.

Backend boundary: в этом frontend workspace Codex не реализует backend/Django/API/server изменения. Backend можно анализировать read-only через `$metravel-backend-diagnostician`, безопасные probes и `area=back` задачи на борде; backend working tree не редактируется и в нём не выполняются изменяющие Git-операции (`commit`, `push`, `pull`, `merge`, `rebase`, `checkout`, `reset`, `restore`, `stash`, `clean`). На production любой Git-tracked path неизменяем: перед разрешённой server-write операцией требуется read-only `git status --short` + `git ls-files`; dirty checkout означает stop, evidence и backend/ops task, а не cleanup или deploy. Для frontend deploy gate не блокируют только три production-owned исключения из `docs/RULES.md`: `deploy/prod/nginx/ssl/`, `dump.sql` и permission warning для `deploy/prod/postgis_1/data/`; их нельзя читать или менять.

## Обязательный architecture impact

Любая задача начинается с двух явных выводов:

- `Platform impact: desktop web | mobile web | Android | iOS | shared | none`;
- `Localization impact: RU/BE/UK/PL/EN | selected locales | none`.

Проект — единое Expo/React Native приложение с активными поверхностями desktop
web, mobile web, Android и iPhone. Shared-правка требует анализа всех четырёх, а новый
app-owned UI text — общего i18n-контракта для RU/BE/UK/PL/EN. Mobile web и
Android остаются обязательным paired control; active iPhone добавляет тот же
flow/state/locale для iOS/shared scope. Simulator покрывает basic UI, физический
iPhone — device capabilities, exact TestFlight build — App Store acceptance.
iPadOS в первый release не входит. Если ось не затронута, укажи `none`; не оставляй её непроверенной. Канонические детали живут
в `docs/RULES.md`, `docs/DEVELOPMENT.md#localization` и `i18n/config.ts`.

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
- `$metravel-quest-playthrough-reviewer`: используй для анализа конкретного `QuestProgress`/admin URL: сопоставить ответы и сырые попытки с шагами квеста, определить точку drop-off и отделить дефект словаря/формулировки от прохождения без отправленного ответа.
- `$metravel-quest-geo-verifier`: используй для read-only сверки координат quest points с реальными объектами через OSM/Nominatim/geocheck.
- `$metravel-hook-builder`: используй, когда основная задача — вынести, спроектировать или упростить focused React hooks в `hooks/` или рядом с фичей, сохранив контракты и не добавляя новые `any`.
- `$metravel-ui-guardrails`: добавляй при любых видимых UI-изменениях, работе с media, icons, placeholders, tokens или external links.
- `$metravel-i18n-guardrails`: добавляй при изменении UI copy, accessibility,
  validation/errors, language settings, locale storage, translation resources,
  Intl/plural/formatting, SEO locale, geocoder language или PDF/export text.
- `$metravel-design-auditor`: используй для read-only сквозного аудита нескольких экранов, consistency matrix, design-token drift, responsive/mobile parity и UI-state/accessibility evidence.
- `$metravel-visual-asset-designer`: используй для брендовых raster icons, badge/app/marketing art и наборов ассетов через imagegen; обычные UI-actions остаются на существующих primitives/Feather, published travel/article media — только real/licensed/local или photorealistic raster.
- `$metravel-child-quest-visuals`: используй вместе с imagegen для детских, семейных, сказочных, парковых и подростковых quest covers; выбирай один возрастной режим и показывай роль/цель/подсказку сюжета вместо взрослой travel-фотографии.
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
- `$metravel-code-reviewer`: обязательно используй после любых изменений кода
  перед handoff. Он review'ит полный task diff, исправляет подтверждённые баги,
  избыточность, дублирование, плохой reuse, неоптимальную логику и нарушения
  правил, затем повторяет review и validation. По возможности запускай его как
  отдельного `review-auditor` agent; fallback — тот же skill в текущем агенте.
  Read-only — только по явному запросу.
- `$metravel-security-reviewer`: используй для frontend security review по XSS/sanitization, URLs/redirects, secrets/tokens, WebView/deep links и production dependencies; review остаётся read-only без явного запроса на fix.
- `$metravel-devops-agent`: используй для подготовки, запуска и проверки deploy на `dev`, `preprod` или `prod`, включая preflight, secret hygiene, server-path safety, approved deploy-command selection, rollback/recovery и post-deploy validation.
- `$metravel-android-portable-builder`: используй для build-only Android APK/AAB
  на новом или другом компьютере, диагностики JDK/Android SDK и загрузки
  gitignored portable `.secrets` bundle без Keychain/EAS.
- `$metravel-google-play-operator`: локальная Android production AAB-сборка и
  production-only Play API без EAS; `alpha`/`internal`/`beta` и closed-testing
  настройки защищены.
- `$metravel-production-smoke`: используй для read-only production health check `metravel.by` после deploy, при 502/white screen/static/API/sitemap подозрениях или регулярном smoke.
- `$metravel-docs-maintainer`: используй при изменении `docs/`, `AGENTS.md`, `.codex/skills` или правил работы Codex.
- `$metravel-prompt-maintainer`: используй для аудита и обновления `docs/*PROMPTS.md`, `assets/**/PROMPT.md`, skill UI metadata/default prompts, prompt-template consistency и воспроизводимости generated assets; сам creative article/quest content остаётся у профильного content skill.
- `$metravel-task-contract`: используй при создании или ревью FE/BE задач на борде, чтобы заполнить обязательный `Task Contract` и проверить, можно ли двигать задачу в `todo`/`done`.
- `$metravel-problem-memory`: используй до create/reopen/split любой задачи и
  при повторном симптоме; он сверяет `docs/PROBLEM_MEMORY.md` и все статусы board,
  затем выбирает `reuse`, `reopen`, `create-linked` или `create-new`.
- `$metravel-ticket-board`: используй как оператора общего MCP task board для list/create/update/sync задач и спринтов; он не пишет feature code.
- `$metravel-sprint-reviewer`: используй для приёмки тикетов активного спринта на MCP task board: проверить Task Contract/Done gate реальными тестами/browser/API evidence и двигать только подтвержденное в `done`. Тикеты `area=back` в приёмку не берутся: они отфильтровываются из очереди, в отчёте остаётся строка «пропущено N тикетов `area=back`» — см. `docs/TASK_BOARD_MCP.md` → «Правило: `area=back` не проверяется без прямого запроса».
- `$metravel-backend-diagnostician`: используй для read-only диагностики backend/API/5xx/contract mismatch, сверки backend status с бордом и оформления back-задач без правки backend-кода. Запускай только по прямому запросу пользователя именно про бэкенд; при общей приёмке борда бэкенд-очередь пропускается.
- `$metravel-article-editor-agent`: используй для article и travel-guide API, photo-folder drafts, media, author/publish verification и безопасной работы с токеном из `.secrets`; любые творческие правки текста статьи сначала подтверждай отдельным вопросом.
- `$metravel-codex-orchestrator`: используй как верхний self-check для сложных или многошаговых задач: triage, минимальный набор skills, role prompts, validation plan, handoff и final self-check по правилам проекта.
- `$metravel-agent-workflow`: используй для координации ролей business analyst, system architect, designer, programmer, QA, reviewer и DevOps.
- `$metravel-project-analyst`: используй для read-only анализа структуры проекта, активных фич, зависимостей, validation surface, risk hotspots и выбора следующих агентов перед крупной задачей.
- `$metravel-android-developer`: используй для Android/native разработки и отладки Expo/React Native: platform files, native crashes, Expo modules, permissions, SecureStore, push, native map, web-first код в Android bundle; после фиксов сверяй Android device coverage с `docs/MANUAL_TEST_CASES.md` `AND-USB-*` на локально собранной и установленной по USB сборке; Android EAS запрещён.
- `$metravel-ios-architect`: используй для iPhone architecture, platform
  boundaries, Apple capabilities/privacy/signing, task slicing и validation design.
- `$metravel-ios-developer`: используй для active iPhone implementation/debug:
  platform files, Xcode/runtime, Keychain, Apple auth UI, APNs, Universal Links,
  permissions, maps, media, safe areas и shared regressions.
- `$metravel-ios-reviewer`: обязательный независимый iOS review-and-fix перед
  tester/release handoff; применяет общий code-review contract и Apple checklist.
- `$metravel-ios-tester`: read-only QA на simulator, physical iPhone и exact
  TestFlight candidate с правильной границей evidence.
- `$metravel-ios-release-operator`: signed build, TestFlight/App Store Connect,
  App Review и storefront operations; каждый mutating stage требует отдельной
  точной команды пользователя.
- `$metravel-mobile-tester`: используй для парной read-only QA мобильных сценариев
  на mobile web и Android: responsive layout, touch targets, navigation, USB
  Android local-build smoke, Maestro flows, screenshots/logs/evidence и retest;
  изменение одной поверхности всегда проверяется на обеих.
- `$metravel-play-campaign-tester`: используй для настроенной Google Play reciprocity campaign: ежедневный USB-device pass, community assignments, app updates, screenshots/crash evidence и общий campaign log; не выполняй покупки, отзывы, удаления, смену аккаунта или переписку без отдельного разрешения.
- `$metravel-business-analyst`: используй для превращения продуктовой идеи в feature brief, user stories, acceptance criteria, non-goals, metrics и risks.
- `$metravel-system-architect`: используй для technical design, review diff, risk mapping, validation plan и безопасного разбиения работ.
- `$metravel-qa-agent`: используй для read-only тестирования, browser/e2e exploration, bug reports и re-test фиксов.
- `$openspec-explore`: используй для read-only исследования неясной идеи или
  сложной проблемы до создания change.
- `$openspec-propose`: используй для полного planning-only change
  (`proposal` → delta specs → design → tasks); он не авторизует реализацию.
- `$openspec-update-change`: используй для согласованной правки существующих
  OpenSpec artifacts без изменения implementation code.
- `$openspec-apply-change`: используй только после отдельного запроса на
  реализацию уже подготовленного change.
- `$openspec-sync-specs` и `$openspec-archive-change`: используй для merge delta
  specs в living specs и завершения change после всех project Done gates.

Подключай только те skills, которые реально нужны задаче. Если skill требует дополнительные docs, читай только релевантные файлы.

## Экономичный запуск skills и агентов

Начинай с одного профильного skill. Повышай уровень до `$metravel-codex-orchestrator` или `$metravel-agent-workflow` только когда это снижает риск: неясный scope, несколько ролей, production/release, mobile/native, e2e, внешние зависимости или обязательная независимая проверка.

| Класс задачи | Стартовый маршрут | Когда повышать уровень |
| --- | --- | --- |
| Документация, правила, skills | `$metravel-docs-maintainer`; добавь `$metravel-prompt-maintainer` только для prompt specs, asset prompts или `agents/openai.yaml` | Добавь `$metravel-codex-orchestrator`, если меняется workflow нескольких ролей, правила проверок или skill-selection policy. |
| Локализация и locale-sensitive UI | `$metravel-i18n-guardrails` + профильный domain/feature skill | Добавь `$metravel-system-architect` для content-locale/API или locale-specific URL/SEO contract; mobile skills — для provider/storage/native lifecycle. |
| Простая автоматизация и проверки | `$metravel-test-runner` для узких тестов; `$metravel-release-checks` для выбора gate; `$metravel-problem-memory` + `$metravel-ticket-board` + `$metravel-task-contract` для задач на борде | `$metravel-quality-fixer` только для полного quality-gate/fix цикла; `$metravel-devops-agent` только для явного build/deploy/release target. |
| SDD для новой/сложной работы | `$openspec-explore` при неясности, затем `$openspec-propose`; project/domain skills выбираются внутри artifacts | Реализация начинается отдельным запросом через `$openspec-apply-change`; archive не заменяет board Done gate или production evidence. |
| Read-only анализ проекта | `$metravel-project-analyst` | `$metravel-agent-workflow` нужен только если анализ сразу передается в BA/architect/implementation/QA/review цепочку. |
| Product/growth/performance/security/design анализ | `$metravel-business-analyst`, `$metravel-growth-analyst`, `$metravel-performance-analyst`, `$metravel-security-reviewer` или `$metravel-design-auditor` по домену | Добавь architect/implementation только когда анализ явно должен перейти в правки; review-запрос сам по себе остаётся read-only. |
| Обычная разработка, bugfix, refactor | `$metravel-domain-router` для доменного scope, затем профильный доменный субагент (`$metravel-travel-expert`, `$metravel-map-expert`, `$metravel-profile-expert`, `$metravel-achievements-expert`, `$metravel-quest-expert`) и `$metravel-feature-builder`; добавь `$metravel-ui-guardrails`, `$metravel-hook-builder`, `$metravel-refactor-surgeon` или `$metravel-test-writer` только по затронутой области | `$metravel-codex-orchestrator` для широкого/неясного scope; `$metravel-agent-workflow` для раздельных BA/architect/QA/reviewer стадий. |
| Статьи и article media | `$metravel-article-editor-agent` | Добавь orchestrator для bulk/high-risk правок, publish/unpublish серий или связанных SEO/API/UI проверок. |
| Новый квест или полная переработка quest content | `$metravel-quest-writer`; после отдельного подтверждения творческого текста добавь `$metravel-quest-geo-verifier`, а `$metravel-quest-expert` только для data/migration/code scope | Добавь orchestrator для нескольких городов, production publication или связанного media/code workflow. |
| Конкретное прохождение или повторные неверные ответы | `$metravel-quest-playthrough-reviewer`; подтверждённую правку контента передай `$metravel-quest-editor` | `$metravel-quest-expert` нужен только при дефекте checker/UI-кода, `$metravel-backend-diagnostician` — при разрыве telemetry/API-контракта. |
| Mobile web/Android | `$metravel-mobile-tester` для парной read-only QA, `$metravel-android-developer` для platform fixes; `$metravel-play-campaign-tester` только для reciprocity campaign | `$metravel-agent-workflow` для reproduce -> fix -> retest -> review или web + Android scope. Переносимая build-only сборка — `$metravel-android-portable-builder`; store actions — только explicit request через `$metravel-google-play-operator`/DevOps. |
| iPhone/iOS | `$metravel-ios-analyst` для scope/App Review requirements, `$metravel-ios-architect` для design, `$metravel-ios-designer` для HIG/parity/store-ассетов, `$metravel-ios-developer` для implementation, `$metravel-ios-reviewer` для repair review, `$metravel-ios-tester` для simulator/device/TestFlight QA | Signed build и любые App Store mutations — только отдельный explicit gate через `$metravel-ios-release-operator`; iPad не включать в v1. |
| App Store release | `$metravel-ios-release-operator` + `$metravel-release-checks`; принять только exact TestFlight candidate после physical-iPhone QA | Signed build, upload, App Review submit и storefront release — четыре независимых authorization gates; один не разрешает следующий. |
| Google Play release | build-only на любом workstation — `$metravel-android-portable-builder`; submit/track — `$metravel-google-play-operator` + `$metravel-release-checks` | Build/submit/promotion требуют явного exact target; `production` не выводится из общего слова «релиз». |
| SEO/index operations | `$metravel-seo-index-operator` | Добавь `$metravel-growth-analyst` для месячной стратегии; `$metravel-article-editor-agent` или `$metravel-feature-builder` только когда из аудита следует content/code change. |
| Production smoke | `$metravel-production-smoke` | `$metravel-devops-agent` нужен только для deploy/rollback; `$metravel-backend-diagnostician` — для подтвержденных API/backend failures. |

Не запускай "всех агентов" для обычной задачи. BA, Project Analyst, Growth
Analyst, QA, Mobile Tester и audit-only reviewers по умолчанию read-only и должны
возвращать компактный артефакт. Обязательный `$metravel-code-reviewer` — явное
исключение: после code changes он исправляет подтверждённые in-scope findings и
повторно валидирует diff. Для docs-only изменений достаточно структурно
перечитать Markdown/YAML; для простой автоматизации запускай самый узкий
надежный command и сначала проверь operation gate, если команда относится к
долгим эксклюзивным операциям.

## Совместимость Claude → Codex

Claude-конфигурация остаётся историческим источником отдельных operational facts, но новые маршруты должны запускаться через Codex skills и канонические project docs. Не копируй модель-специфичные `tools`, `model`, permissions или preview-названия буквально.

| Claude agents / skills | Codex маршрут |
| --- | --- |
| `android-expert`, `android-native-audit`, `android-qa-sweep` | `$metravel-android-developer` + `$metravel-mobile-tester` |
| `ios-expert`, `ios-tester`, `ios-reviewer`, `ios-deployer`, `ios-architect` | `$metravel-ios-developer`, `$metravel-ios-tester`, `$metravel-ios-reviewer`, `$metravel-ios-release-operator`, `$metravel-ios-architect` |
| `ios-analyst`, `ios-designer`, `ios-qa-sweep`, `ios-release` | `$metravel-ios-analyst`, `$metravel-ios-designer`, `$metravel-ios-tester`, `$metravel-ios-release-operator` |
| `android-builder` | `$metravel-android-portable-builder`; Play submit/track передаётся `$metravel-google-play-operator` + `$metravel-release-checks` |
| `android-publisher`, `android-release` | `$metravel-google-play-operator` + `$metravel-release-checks`; web/server deploy остаётся у `$metravel-devops-agent` |
| `play-tester`, `play-update-watcher` | `$metravel-play-campaign-tester`; общий operational state пока живёт в `.claude/play-testing/` без дублирования |
| `metravel-design-audit`, `metravel-design-system`, `review-uiux` | `$metravel-design-auditor` для read-only evidence, `$metravel-ui-guardrails` для implementation contract, `$metravel-browser-reviewer` для fix/reverify |
| `metravel-page-new`, `metravel-screen-redesign` | `$metravel-domain-router` + `$metravel-feature-builder` + `$metravel-ui-guardrails` |
| language switcher, localization, translated UI | `$metravel-i18n-guardrails` + профильный feature/test skill; locale contract бери из `i18n/config.ts`, а не из legacy prompt |
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
| `problem-memory` | `$metravel-problem-memory`; контракт вердикта общий — обе стороны обязаны давать одинаковый `reuse/reopen/create-linked/create-new` на один вход |
| `growth-analyst`, `metravel-seo-expert`, `index-doctor`, `seo-daily`, `metravel-seo-audit` | `$metravel-growth-analyst` и `$metravel-seo-index-operator` |
| `dev-loop`, `guard-enforcer`, `test-author`, `browser-reviewer`, `prod-smoke`, deploy agents | `$metravel-quality-fixer`, `$metravel-test-writer`, `$metravel-browser-reviewer`, `$metravel-production-smoke`, `$metravel-devops-agent` |

Claude slash-команды переносятся как skill-routes, а не как второй набор дублирующих prompt-файлов:

| Claude command | Codex route |
| --- | --- |
| `/auto-dev`, `/bugfix` | `$metravel-codex-orchestrator`/`$metravel-agent-workflow` + domain skill + `$metravel-feature-builder` + QA/review |
| `/changed-summary` | обычный read-only `git status`/`git diff` summary или `$metravel-code-reviewer` только в явно заданном read-only режиме |
| `/check-fast`, `/guard-all`, `/preflight` | `$metravel-test-runner` / `$metravel-release-checks`; запускать repository scripts через quality-gate lock, а при `SKIPPED` из-за живого владельца завершать собственный запуск без ожидания/ретрая и выбирать `validation delegated` или `validation skipped` по scope и оставшемуся Done gate |
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
| New feature / complex or recurring change | всё из feature-контекста + `docs/spec-driven-development.md`, `docs/spec-driven-development-requirements.md`, `openspec/config.yaml` | planning через `$openspec-propose`, implementation только отдельным `$openspec-apply-change`; OpenSpec не заменяет board history/Task Contract/Done gate |
| Localization / user-facing copy | `AGENTS.md`, `docs/RULES.md`, `docs/DEVELOPMENT.md#localization`, `$metravel-i18n-guardrails`, `i18n/config.ts`, ближайшие i18n tests | RU/BE/UK/PL/EN key parity, без hardcoded UI strings/`ru-RU`, web hydration + native locale lifecycle, `npm run test:i18n` |
| Domain-specific feature work | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `$metravel-domain-router`, профильный feature-doc при наличии | выбрать domain owner map для travel/map/profile/achievements/quests/PDF/new pages; затем подключить доменного субагента (`$metravel-travel-expert`, `$metravel-map-expert`, `$metravel-profile-expert`, `$metravel-achievements-expert`, `$metravel-quest-expert`) и feature/ui/test/refactor skills по фактическому scope |
| Hooks / logic extraction | `AGENTS.md`, `docs/RULES.md`, `docs/DEVELOPMENT.md`, профильный feature-doc, ближайшие существующие hooks | выносить focused hook без лишней абстракции, сохранять client/server state boundaries, не добавлять новые `any` |
| Component split / file complexity | `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, `$metravel-refactor-surgeon`, ближайшие tests | behavior-preserving extraction, explicit props, no business-logic rewrite, targeted checks + browser evidence for visible UI |
| Backend task planning | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/TASK_BOARD_MCP.md`, `$metravel-ticket-board`, `$metravel-task-contract`, `$metravel-backend-diagnostician` | backend только analysis-only: безопасно воспроизведи/сверь контракт, но не редактируй и не commit/push/pull/checkout/reset backend repo локально или на сервере; перед любой разрешённой server write классифицируй пути через `git ls-files`, tracked path не меняй; dirty production checkout означает evidence + `area=back`/ops task и stop без cleanup/deploy, кроме точного non-mutating frontend-deploy исключения для `deploy/prod/nginx/ssl/`, `dump.sql` и permission warning `deploy/prod/postgis_1/data/` из `docs/RULES.md`; новые FE/BE/backend задачи создавай на общем MCP task board через `$metravel-ticket-board` (`metravel_task_create`); заполняй `area=front/back`, active sprint, Task Contract, dependencies/blockers и validation/Done gate; `blocked_by` используй только когда hard dependency не даёт начать/продолжить реализацию, а ожидание backend/deploy/runtime проверки веди в `testing`; при `HTTP 401` сначала обнови staff token через `.env.e2e` по `docs/TASK_BOARD_MCP.md`; локальные `tasks/*.md` используй только как временный fallback после неуспешного token refresh с последующим sync/import |
| Task board FE/BE contract | `docs/PROBLEM_MEMORY.md`, `docs/TASK_BOARD_MCP.md`, `$metravel-problem-memory`, `$metravel-ticket-board`, `$metravel-task-contract`, профильный feature-doc при наличии | до create/reopen выдать history verdict и не создавать дубль; каждая FE/BE задача на борде должна иметь `Task Contract`: scope, user-visible result, data/API contract, platform/localization impact, dependencies, fallback/mock policy, validation и Done gate; recurring problem получает `Recurrence Log`; без runtime evidence не двигать в `done`, но готовую реализацию держать в `review`/`testing`, не в `blocked_by` |
| Приёмка спринта / закрытие тикетов | `AGENTS.md`, `docs/RULES.md`, `docs/TASK_BOARD_MCP.md`, `$metravel-sprint-reviewer`, `$metravel-task-contract` | только board acceptance; проход по `review`/`testing` тикетам активного спринта; без Task Contract и runtime evidence не двигать в `done`; при нехватке evidence оставить в `review`/`testing`, при требуемом code fix вернуть в `in_progress`; `blocked_by` допустим только для новой hard dependency, реально остановившей работу |
| Видимый UI, media, icons, tokens | всё из feature-контекста + `$metravel-ui-guardrails` | проверка в браузере на web, screenshot, отсутствие новых console errors |
| Mobile parity / map-place point cards | `docs/RULES.md`, `docs/NATIVE_COMPAT_RULES.md`, `docs/features/map.md`, `docs/features/places.md`, `docs/features/travel.md`, `$metravel-map-expert`, `$metravel-travel-expert`, `$metravel-ui-guardrails`, `$metravel-mobile-tester`, `$metravel-ios-tester` для проверки | mobile web, Android и iPhone сохраняют один visual/interaction contract; Android использует local USB build, iPhone — simulator/physical layer по риску; map/place/travel-point карточки используют общий fullscreen point/place template; card tap только фокусит marker, marker tap открывает popup |
| Browser review / visible regression fix | всё из UI-контекста + `$metravel-browser-reviewer` | diff review + browser snapshot/screenshot/console/network; исправить real issues и reverify |
| External links | `docs/RULES.md`, `docs/TESTING.md`, `utils/externalLinks.ts` | никаких direct `window.open(...)` и `Linking.openURL(...)` вне chokepoint |
| Article editing / generated article images | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/DEVELOPMENT.md`, `$metravel-article-editor-agent` | токен только из `.secrets`/env без вывода значения; backup перед write; самостоятельная работа только с images/media; творческий текст статьи/квеста - только после отдельного confirmation question; не использовать интернет-картинки; generated images только как фотореалистичные raster-файлы через `imagegen`/licensed-local source; никаких SVG/Playwright/схематичных placeholder-картинок; verify через API и страницу |
| Frontend security review | `AGENTS.md`, `docs/RULES.md`, `$metravel-security-reviewer`, sanitizer/link/storage/deep-link code in scope | concrete PoC/data flow before finding; no secret output; read-only unless fixes explicitly requested; backend/infra → `area=back` evidence |
| Cross-screen design audit | `AGENTS.md`, `docs/RULES.md`, `$metravel-design-auditor`, design tokens/components, feature docs | screenshot/DOM evidence, consistency matrix, no taste-only findings; implementation only when explicitly requested |
| Branded raster asset | `AGENTS.md`, `docs/ICON_ART_PROMPTS.md`, `$metravel-visual-asset-designer`, `$metravel-prompt-maintainer` | reuse first; imagegen for new raster; exact prompt beside tracked asset; no raster replacement for standard Feather UI actions; media-slot restrictions stay authoritative |
| Child/teen quest cover | `AGENTS.md`, `docs/ICON_ART_PROMPTS.md`, `$metravel-child-quest-visuals`, `$metravel-prompt-maintainer` | explicit age band; watercolor/animated/graphic-novel story mode; original characters; role, goal, clue and safe central crop; upload remains a separate authorization |
| New quest authoring / full quest rewrite | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `$metravel-quest-writer`, текущие quest data/API contracts | отдельный confirmation question до creative text; duplicate check; проверенные факты и onsite tasks; anti-backtracking route; `$metravel-quest-geo-verifier` до publication; API write/publish только по явному запросу |
| Test running | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, профильный feature-doc при наличии | выбрать самый узкий надёжный test command, сначала проверить operation gate, не дублировать активный full/preflight/e2e run, не оставлять `.skip`, после фикса rerun обязателен |
| Repo-wide quality fix | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/DEVELOPMENT.md`, `docs/RELEASE.md` | запустить lint + Jest + Playwright, исправить реальные падения, повторить проверки и явно отметить только несвязанные блокеры |
| Test writing | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, профильный feature-doc, ближайшие существующие тесты | писать тест на ближайшем подходящем уровне, фиксировать реальный контракт, избегать flaky assertions |
| Browser / E2E | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `.env.e2e` при необходимости, профильный feature-doc | Playwright/browser flow, secret hygiene, screenshot/trace evidence, console/runtime checks |
| Android/native development | `AGENTS.md`, `docs/RULES.md`, `docs/NATIVE_COMPAT_RULES.md`, `docs/DEVELOPMENT.md`, `docs/MANUAL_TEST_CASES.md`, профильный feature-doc | web-first правило: не ломать production web; platform files вместо больших условий; native governance; перед `verify pending` проверить `adb devices -l` и использовать подключенный Android со статусом `device` |
| iPhone/iOS development | `AGENTS.md`, `docs/RULES.md`, `docs/NATIVE_COMPAT_RULES.md`, `docs/DEVELOPMENT.md`, `docs/MANUAL_TEST_CASES.md`, active iOS OpenSpec, `$metravel-ios-architect`, `$metravel-ios-developer` | iPhone-only v1; resolved Expo/Xcode identity; platform files; simulator basic pass; physical iPhone for capabilities; shared web/Android controls; release mutations excluded |
| iOS release/TestFlight/App Store | `AGENTS.md`, `docs/RULES.md`, `docs/RELEASE.md`, `docs/WORKFLOW_OPERATIONS.md`, `docs/IOS_OWNER_GUIDE.md`, active iOS OpenSpec, `$metravel-ios-release-operator`, `$metravel-ios-tester` | exact source/version/build/signing/privacy; exact TestFlight candidate; separate explicit gates for signed build, upload, App Review submit and storefront release; no auto-submit |
| Mobile QA | `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/NATIVE_COMPAT_RULES.md`, `docs/MANUAL_TEST_CASES.md`, профильный feature-doc | read-only mobile web/native checks, `AND-USB-*` для подключенного Android, Maestro где доступен, touch/layout/runtime evidence, no secrets, баги роутить к профильному owner |
| Performance analysis | `docs/RULES.md`, `docs/TESTING.md`, `docs/RELEASE.md`, профильный perf-doc (`docs/TRAVEL_PERFORMANCE_REFACTOR.md` при travel scope) | production incident: тот же live URL до и после deploy, viewport/browser/DPR + auth/cache state, page-wide request/API cardinality, bytes, response codes, media dimensions/variants и negative probe; preview/build не закрывают production Done gate |
| Growth / funnel analysis | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/CODEX.md`, `docs/GROWTH_PLAN.md`, `$metravel-growth-analyst` | свежие GA4/GSC stats, абсолютные даты, no secrets, факты отдельно от гипотез, instrumentation gaps и handoff к feature/test/ui skills |
| SEO / indexing operations | `AGENTS.md`, `docs/RULES.md`, `docs/GROWTH_PLAN.md`, `$metravel-seo-index-operator` | GSC/index data только из scripts/API/manual user metrics; не выдумывать цифры; owner URL list отдельно от code/content tasks |
| Backend/API diagnosis | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, `docs/TASK_BOARD_MCP.md`, `$metravel-backend-diagnostician` | backend read-only, production GET/HEAD probes only, back-задачи через board с Task Contract/evidence |
| Production smoke | `AGENTS.md`, `docs/RULES.md`, `docs/RELEASE.md`, `$metravel-production-smoke` | read-only GET/browser probes по real URL; для perf/media считать API/request fan-out, bytes, oversized/unsized sources и before/after scroll; no deploy/rollback; route confirmed failures to canonical frontend/backend task |
| Code review | `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, `$metravel-code-reviewer`, профильный feature-doc, полный task diff и validation logs | обязательный review-and-fix после code changes: проверять correctness, избыточность, duplication/reuse, efficiency, project contracts и tests; исправлять in-scope findings, re-review'ить весь итоговый diff и rerun'ить validation |
| SEO / route pages | `docs/DEVELOPMENT.md` SEO-раздел | `buildCanonicalUrl`, `buildOgImageUrl`, `LazyInstantSEO` |
| Release / deploy / performance | `docs/RELEASE.md`, `docs/PRODUCTION_CHECKLIST.md`, `$metravel-release-checks`, `$metravel-devops-agent` | operation gate перед build/deploy/rebuild/test gate, production build/export, explicit deploy target, secret hygiene, реальные URL для post-deploy проверок |
| Docs / skills | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл | обновляй существующие canonical docs, не создавай одноразовые отчеты |
| Codex self-orchestration | `AGENTS.md`, `docs/CODEX.md`, `docs/RULES.md`, `docs/README.md` | task triage, smallest skill set, role prompt pattern, validation plan, final self-check |
| Project analysis / onboarding | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл, `package.json`, `docs/INDEX.md` при необходимости | read-only карта структуры, активных фич, validation surface, risk hotspots и recommended agents; не создавай отчет без запроса |
| Multi-agent workflow | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл, нужные role skills | роли работают по контрактам; QA и BA не меняют код; programmer реализует задачу; обязательный code reviewer исправляет подтверждённые in-scope findings и повторяет review/validation; DevOps деплоит только при явном target env |

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
Architecture: platform impact <desktop web/mobile web/Android/iOS/shared/none>; localization impact <RU/BE/UK/PL/EN/none>.
Output: <role artifact>.
Validation: <expected checks/evidence>.
```

Стандартный feature flow:

1. `$metravel-codex-orchestrator` при сложном scope выбирает route: skills, prompts, constraints, validation.
2. `$metravel-project-analyst` при широком или неясном scope формирует `Project Analysis`: структура, активные фичи, validation map, risk hotspots, recommended agents.
3. `$metravel-growth-analyst` анализирует GA4/GSC/Yandex/manual stats, SEO/organic рост, registration/auth/content funnels и instrumentation gaps, когда задача начинается со статистики или поведения пользователей.
4. `$metravel-business-analyst` формирует `Feature Brief`: problem, audience, user stories, acceptance criteria, non-goals, metrics, risks, open questions.
5. `$metravel-system-architect` формирует `Technical Design`: reuse points, affected modules, API/data/UI/external-link impact, platform/localization impact, implementation steps, validation plan.
6. `$metravel-ui-guardrails` формирует UI contract для видимых web/mobile состояний, если задача затрагивает интерфейс; `$metravel-i18n-guardrails` фиксирует RU/BE/UK/PL/EN contract для UI copy и locale-sensitive логики.
7. `$metravel-domain-router` выбирает feature-owner map для travel/map/profile/achievements/quests/PDF/new pages, если scope доменный.
8. Доменный субагент уточняет ограничения и проверки: `$metravel-travel-expert`, `$metravel-map-expert`, `$metravel-profile-expert`, `$metravel-achievements-expert` или `$metravel-quest-expert`; конкретное прохождение сначала разбирает `$metravel-quest-playthrough-reviewer`, для нового quest content используй `$metravel-quest-writer`, для подтверждённой правки существующего — `$metravel-quest-editor`, для координат — `$metravel-quest-geo-verifier`.
9. `$metravel-android-developer` подключай для platform-specific поведения,
   native crashes, Expo modules и platform files; Android QA выполняй через
   локальную USB-сборку и обязательно сравнивай тот же flow с mobile web.
   Для iPhone flow используй `$metravel-ios-architect` →
   `$metravel-ios-developer` → `$metravel-ios-reviewer` →
   `$metravel-ios-tester`; store operations передавай
   `$metravel-ios-release-operator` только после exact authorization.
10. `$metravel-hook-builder` подключай дополнительно, если основной объём работы — вынос локальной логики в hooks или cleanup hook boundaries.
11. `$metravel-refactor-surgeon` подключай для behavior-preserving split больших компонентов и file-complexity violations.
12. `$metravel-feature-builder` реализует минимальный diff по утвержденному design/brief.
13. `$metravel-article-editor-agent` выполняет article API/media операции, если задача про статьи, generated images или publish/unpublish; творческие текстовые правки делает только после отдельного confirmation question.
14. `$metravel-seo-index-operator` выполняет SEO/index operations и формирует owner/code/content split.
15. `$metravel-backend-diagnostician` диагностирует backend/API blockers read-only и готовит back-задачи/evidence.
16. `$metravel-problem-memory` до любой board mutation проверяет problem registry
    и закрытые/открытые карточки; `$metravel-ticket-board` создаёт/обновляет задачи
    и спринты, а `$metravel-task-contract` проверяет обязательный контракт FE/BE
    задачи перед стартом, review и `done`, особенно когда FE зависит от BE
    endpoints/fields/events.
17. `$metravel-browser-reviewer` делает browser review/fix pass для видимых web-изменений.
18. `$metravel-mobile-tester` проверяет mobile web или Android/native сценарии и создает `Mobile QA Pass` или `Bug Report`.
19. `$metravel-qa-agent` тестирует общий сценарий read-only и создает `Bug Report` или `QA Pass`.
20. `$metravel-code-reviewer` обязательно review'ит полный итоговый diff после
    любых code changes, сам исправляет подтверждённые in-scope findings и
    повторяет review/validation; отдельный architecture review добавляется для
    high-risk design, но не заменяет этот pass. По возможности этот этап
    выполняет отдельный `review-auditor`; после своих fixes он re-review'ит diff
    сам, без рекурсивного запуска ещё одного reviewer.
21. `$metravel-sprint-reviewer` принимает тикеты активного спринта по Done gate и двигает только evidence-backed задачи в `done`.
    Неполная проверка остаётся в `review`/`testing`; `blocked_by` используется только когда новая hard dependency не позволяет начать или продолжить работу.
22. `$metravel-production-smoke` выполняет read-only smoke `metravel.by` после deploy или при аварийной проверке.
23. `$metravel-system-architect` в review mode проверяет findings, diff, проверки, known risks и соответствие правилам, когда нужен архитектурный review.
24. `$metravel-android-portable-builder` выполняет явно запрошенную локальную
    build-only сборку из `.secrets`; `$metravel-google-play-operator` выполняет
    только явно запрошенный Android store submit/track step и подтверждает
    фактический track/versionCode.
25. `$metravel-ios-release-operator` выполняет только отдельно разрешённый
    signed build, TestFlight upload, App Review submit или storefront release;
    следующий stage не выводится из предыдущего.
26. `$metravel-devops-agent` готовит и выполняет web/server deploy/build/release только при явном запросе на deploy/release, с environment gate, preflight и post-deploy validation.

Стандартный bug loop:

1. `$metravel-qa-agent` ходит по приложению, воспроизводит проблему и создает структурированный `Bug Report`.
2. `$metravel-feature-builder` чинит один подтвержденный bug report за раз.
3. `$metravel-hook-builder` подключай, если bugfix в основном упирается в неудачную hook-архитектуру или дублирующуюся hook-логику.
4. `$metravel-qa-agent` re-test'ит фикс.
5. `$metravel-code-reviewer` review'ит полный итоговый diff, исправляет findings
   и повторяет validation; `$metravel-system-architect` подключай дополнительно
   для high-risk design review.

Ролевые ограничения:

- BA, QA и audit-only reviewers не меняют код. Обязательный
  `$metravel-code-reviewer` работает в review-and-fix режиме и вправе менять
  task-owned frontend/app/docs files для устранения подтверждённых findings.
- Codex Orchestrator не подменяет профильные роли; он выбирает маршрут, проверяет правила и держит handoff компактным.
- В этом frontend workspace ни одна роль не редактирует backend/Django/API/server working tree. Backend blockers фиксируются через read-only diagnosis и `area=back` board tasks.
- Перед передачей роли на deploy, release/build, Android local/EAS build/install, server rebuild/restart, full/preflight tests, Playwright/e2e или Lighthouse orchestrator должен проверить operation gate из `AGENTS.md`/`docs/RULES.md`. Для занятого test/quality gate новый агент не ждёт, не poll'ит и не перезапускает проверку: если gate покрывает нужный scope и тесты — единственный оставшийся Done-gate шаг, фиксирует `validation delegated: active gate pid/name` и может завершить задачу; иначе фиксирует `validation skipped: active gate pid/name` и оставляет её открытой. Падения исправляет владелец активного gate. Для остальных операций применяется их обычный blocker/wait contract.
- Любая FE/BE задача на общем борде без `Task Contract` считается неготовой к старту и к `done`; ticket-board/оркестратор должны сначала дописать контракт или вернуть задачу в refinement.
- Любая задача на борде без семи обязательных разделов описания (`Простыми словами` → `В чём проблема` → `Из-за чего возникла` → `Что должно быть сделано` → `Что уже сделано` → `Что блокирует` → `Как протестировать`, по-русски и без терминов в лиде) или с английскими абзацами в описании считается неготовой к `todo` так же, как задача без контракта; ticket-board/оркестратор переписывают описание до старта. Заголовки контракта, имена его полей, пути, команды и статусы борда не переводятся. Правило: `docs/TASK_BOARD_MCP.md` → «Правило: описание задачи — по-русски и человеческим языком».
- Любая новая задача должна попасть в текущий active sprint; если board API вернул `401`, ticket-board/оркестратор обязан обновить staff token через `.env.e2e` по `docs/TASK_BOARD_MCP.md` до создания локального fallback.
- Project Analyst только анализирует и не меняет файлы, если пользователь отдельно не попросил перейти к docs/code changes.
- Backend Diagnostician не правит backend/frontend код; он дает диагноз, read-only probes и board follow-up.
- Mobile Tester по умолчанию не меняет код; он дает парное mobile-web/Android
  evidence и баг-репорты для `$metravel-android-developer`,
  `$metravel-feature-builder` или `$metravel-ui-guardrails`. Для Android evidence
  использует локально собранную и установленную по USB сборку; dev-client/export
  route допустим только по явному запросу пользователя.
- Android Developer не меняет release/build configs (`app.json`, `eas.json`, `plugins/**`, `scripts/**`) без явного запроса, никогда не запускает Android EAS/cloud build/submit и не заявляет Android-ready без local-build device evidence. Local production release передаётся Google Play Operator.
- iOS Developer реализует active iPhone scope, но не выполняет signed/store
  operations. iOS Architect по умолчанию read-only; iOS Tester read-only;
  iOS Reviewer делает review-and-fix; iOS Release Operator требует отдельную
  explicit authorization для build/upload/submit/storefront stages.
- Portable Android Builder использует cross-platform Node/Gradle entrypoint и
  gitignored `.secrets`, не меняя Play. Google Play Operator использует только
  local Gradle + production-only Play API;
  `alpha`, `internal`, `beta`, testers и countries не меняет.
- Programmer не начинает реализацию без bug report, feature brief или явного user request.
- Refactor Surgeon не меняет бизнес-логику и не делает редизайн; только behavior-preserving extraction.
- Sprint Reviewer не пишет feature code и не двигает `done` без runtime evidence.
- Production Smoke ничего не деплоит и не мутирует прод; только read-only health evidence.
- DevOps agent не деплоит `prod` без явного production deploy запроса, не меняет серверные/SSL пути без проверки на целевом host и не пишет самодельные `rsync`/`scp`/SSH deploy-команды в обход утвержденных scripts/wrapper.
- Article Editor Agent не выводит токены из `.secrets`, не использует интернет-картинки без явного разрешения, самостоятельно меняет только images/media, переспросом подтверждает любые творческие текстовые правки, делает rollback snapshot перед записью и проверяет результат после write.
- Designer не создает отдельную дизайн-систему: использует `components/ui`, `DESIGN_TOKENS`, Feather icons и существующие feature-компоненты.
- Каждая роль явно фиксирует platform и localization impact. Programmer/Designer
  не добавляют hardcoded app-owned UI text; Architect/Reviewer/QA не пропускают
  desktop web/mobile web/Android/iOS и RU/BE/UK/PL/EN impact в design, validation и findings.
- Orchestrator держит unrelated user changes отдельно и не завершает задачу с известными реальными проблемами в затронутом scope.
- Для visible web UI обязательны browser preview, screenshot и console check.

## Рабочий цикл AI-инженера

1. Сначала зафиксируй scope: какие user-facing сценарии, файлы и project rules могут быть затронуты.
2. Найди существующий путь реализации через поиск по компонентам, hooks, services, utils и тестам.
3. Перед правкой проверь текущую ветку и `git status --short`; работай только на `main`, а если текущая ветка не `main`, остановись и уточни дальнейшие действия.
4. Перед долгими эксклюзивными операциями проверь operation gate: не запускай дубль deploy/build/Android install/rebuild/full tests/e2e/Lighthouse. Если занят именно test/quality gate, сразу заверши свою validation как `skipped` без ожидания, polling, обходного теста или позднего ретрая; результат и исправление падений принадлежат владельцу активного запуска.
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
Platform impact: desktop web | mobile web | Android | iOS | shared | none
Localization impact: RU/BE/UK/PL/EN | selected locales | none
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
| Изменения в видимом shared UI | relevant targeted checks + desktop browser + mobile-web viewport + screenshots/console + тот же flow на локальной Android USB-сборке и iPhone |
| Mobile web, Android или iOS/native изменения | один flow/state/locale на affected mobile surfaces; Android local USB; iOS simulator/physical layer по риску; store mutation excluded |
| Localization / UI copy / locale formatting | `npm run test:i18n` + feature checks; проверка затронутых locales и platform lifecycle |
| External-link policy | `npm run guard:external-links` или `npm run governance:verify` |
| Крупное или сквозное изменение | `npm run lint` и `npm run test:run` |
| Release/performance | `npm run build:web:prod` + релевантные Lighthouse/performance scripts из `docs/RULES.md` |

Для e2e-авторизации используй `.env.e2e`, если значения уже заданы, и никогда не выводи секреты.

### Deploy commands for Codex

- Production deploys require an explicit user request and `$metravel-devops-agent`.
- On a machine with working GNU `rsync` (protocol >= 30), use `./build-prod.sh prod`. This is the
  normal path on the current macOS workstation, where Homebrew rsync is first in `PATH`. Check with
  `rsync --version | head -1` before deploying.
- Never deploy with the macOS system `openrsync` (protocol 29): it silently uploads an incomplete
  archive and breaks production. Install GNU rsync or upload with `tar+ssh` instead.
- The Windows/Codex machine (`D:\metravel\metravel2`) is a different, historical checkout, not this
  one. Its local `rsync` step fails, so deploys there went through `bash /d/metravel/ops/deploy-frontend.sh`
  — a wrapper that ran the canonical build/guards via `DEPLOY=0 bash ./build-prod.sh prod`, deployed
  with `tar+ssh`, swapped atomically, verified health, and rolled back on failure. That wrapper does
  not exist on macOS; do not invoke it here.
- SSH access comes from `.env.deploy` (git-ignored, template `.env.deploy.example`), loaded by
  `scripts/deploy-target.sh` as `$PROD_SSH_TARGET` / `$PROD_REMOTE_DIR`. The host is deliberately not
  in the repo — it is public. The `metravel-prod` alias is not defined on every machine — probe by
  direct host, and do not mistake a missing alias for missing access. See `docs/RELEASE.md`.
- `scripts/fix-prod.sh` is an emergency production frontend recovery path only. It has its own remote
  deploy lock, prod artifact config gate, in-container atomic swap, old Expo chunk overlap, Nginx config
  validation plus graceful reload without a container restart, and live chunk/config verification. Use
  it through `$metravel-devops-agent` only when normal deploy is
  unavailable or explicitly requested for recovery; do not replace approved deploy paths with ad-hoc
  `rsync`, `scp`, or SSH commands.

## Быстрая карта поиска

- Routes/pages: `app/`, `screens/`.
- Reusable UI: `components/ui`, затем feature-компоненты в `components/`.
- Business logic: `hooks/`, `services/`, `api/`, `utils/`.
- Localization: `i18n/config.ts`, `i18n/resources.ts`, `i18n/locales/**`,
  `i18n/format.ts`, `types/i18next.d.ts`, `__tests__/i18n/**`.
- Android/native rules and device cases: `docs/NATIVE_COMPAT_RULES.md`, `docs/MANUAL_TEST_CASES.md`, `e2e/maestro/`, `app.json`, `eas.json`, platform files `*.android.tsx`, `*.native.tsx`, `*.ios.tsx`, `*.web.tsx`.
- Places catalog: `docs/features/places.md`, `screens/tabs/PlacesScreen.tsx`, `api/places.ts`, `utils/placesCatalog.ts`, `components/places/`.
- Design tokens: `constants/designSystem.ts`, web CSS variables in `app/global.css`.
- External navigation chokepoint: `utils/externalLinks.ts`.
- Tests: `__tests__/` for Jest, `e2e/` for Playwright.
- Governance scripts: `scripts/`, command details in `docs/TESTING.md`.
- Feature maps: `docs/features/`.
- Task board: `docs/TASK_BOARD_MCP.md`; новые задачи создавай на общем MCP task board через `ticket-board` в текущем active sprint только с `area=front` или `area=back`. Android app bugs используют `area=front` + `[AND-...]`, iOS app bugs — `area=front` + `[IOS-...]`; shared mobile tasks называют mobile-web/Android/iPhone validation. Backend/API/server задачи — `area=back`. При `401` обновляй staff token через `.env.e2e`; `tasks/README.md` и `tasks/000-template.md` остаются только fallback/migration форматом.

## Кодировка документации

Документация хранится в UTF-8. Если PowerShell показывает кириллицу как `Ð...`/`Ñ...`, сначала перечитай файл с `Get-Content -Encoding UTF8`; не переписывай файл только из-за некорректного отображения консоли.

## Правила обновления skills

- Каждый skill хранится в `.codex/skills/<skill-name>/`.
- Обязательный файл: `SKILL.md` с YAML frontmatter `name` и `description`.
- Рекомендуемый UI metadata-файл: `agents/openai.yaml`.
- Не добавляй README/CHANGELOG внутри папки skill: инструкции должны быть в `SKILL.md`, а длинные справки - в `references/` только при реальной необходимости.
- Описывай в `description`, когда skill должен срабатывать. Тело `SKILL.md` должно быть коротким и операционным.
- Для implementation/review/test skills делай обязательным architecture preflight:
  platform impact для desktop web/mobile web/Android/iOS и localization impact
  для RU/BE/UK/PL/EN; shared mobile flow проверяется на affected mobile surfaces.
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
