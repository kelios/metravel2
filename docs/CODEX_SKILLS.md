# Codex skills

Каталог project skills для Codex (`$metravel-*`). Вынесен из `AGENTS.md`,
чтобы не занимать контекст в каждой сессии: Claude Code пользуется собственными
`.claude/agents` и `.claude/skills`, а этот список нужен только Codex и при
правке самого набора skills.

Читать: при работе в Codex, при добавлении/переименовании skill и при
обновлении `.agents/skills`.

Перед работой выбери минимальный набор project skills:

- `$metravel-feature-builder` - фичи, рефакторинг, баги, API, hooks, services, SEO и обычная разработка.
- `$metravel-domain-router` - карта доменных feature areas (travel/map/profile/achievements/quests/PDF/new pages), файлов, owner-boundaries и нужных проверок перед разработкой.
- `$metravel-travel-expert` - доменный субагент travel: списки/детали/мастер, route points, save/moderation, export/PDF.
- `$metravel-map-expert` - доменный субагент карты и places: MapPage, Leaflet web, native map/WebView, ORS и попапы.
- `$metravel-profile-expert` - доменный субагент профиля: личный/публичный профиль, settings, подписки, счётчики, profile IA.
- `$metravel-achievements-expert` - доменный субагент achievements/badges: ранги, XP, peer-награды, моки и profile embeds.
- `$metravel-quest-expert` - доменный субагент quest-кода: список/деталь/прохождение, адаптеры, answer checker, печать.
- `$metravel-quest-writer` - автор нового городского квеста: research, связный пеший маршрут, intro/steps/finale, задания, hints и answer patterns; творческий текст только после отдельного подтверждения пользователя.
- `$metravel-quest-editor` - субагент редактирования контента существующих квестов: тексты, задания, подсказки, answer patterns.
- `$metravel-quest-playthrough-reviewer` - ревью конкретного прохождения по `QuestProgress`: связывает сохранённый прогресс, сырые попытки, подсказки и актуальный текст шагов, объясняет drop-off и передаёт редактору только evidence-backed правки.
- `$metravel-quest-geo-verifier` - read-only субагент гео-сверки точек квестов через OSM/Nominatim и локальные geocheck scripts.
- `$metravel-hook-builder` - проектирование, вынос и рефакторинг focused React hooks в `hooks/` и рядом с фичами без нарушения public contracts.
- `$metravel-ui-guardrails` - видимый UI, layout, media, placeholders, icons, design tokens, external links.
- `$metravel-i18n-guardrails` - многоязычный UI и locale-sensitive логика:
  translation keys/resources, language persistence, Intl/plurals,
  accessibility, SEO locale и i18n validation; native lifecycle проверяется
  только для затронутой Android/iOS реализации.
- `$metravel-design-auditor` - read-only сквозной аудит нескольких экранов: design-system consistency, responsive/mobile parity, состояния, accessibility и evidence matrix.
- `$metravel-visual-asset-designer` - генерация и интеграция брендовых raster icons/badges/app/marketing assets через imagegen по `docs/ICON_ART_PROMPTS.md`; не подменяет Feather icons или фотореалистичные travel/article media.
- `$metravel-child-quest-visuals` - отдельный автор визуалов детских/семейных/подростковых квестов: возрастной режим, акварель/сказка/анимация, сюжетная читаемость обложки, imagegen, prompt и production verification.
- `$metravel-browser-reviewer` - browser review/fix loop для видимых web-изменений: diff + preview/browser + screenshot + console/network + reverify.
- `$metravel-refactor-surgeon` - распил god-components и file-complexity нарушений без изменения поведения.
- `$metravel-release-checks` - выбор и запуск проверок, preflight, release/deploy, production web checks.
- `$metravel-quality-fixer` - полный прогон lint + Jest + Playwright с исправлением найденных проблем и обязательным rerun проверок.
- `$metravel-test-runner` - точечный запуск Jest/unit/integration/governance проверок, выбор минимального набора команд и разбор падений.
- `$metravel-test-writer` - написание и обновление unit/integration/governance тестов без `.skip`, с опорой на реальные контракты фичи.
- `$metravel-e2e-runner` - запуск и отладка Playwright/e2e сценариев, browser smoke, работа с `.env.e2e`, trace и screenshot evidence.
- `$metravel-performance-analyst` - Lighthouse, bundle/perf budget analysis, сравнение baseline и проверка performance только по production build или real URL.
- `$metravel-growth-analyst` - анализ GA4/GSC/Yandex/affiliate-цифр, SEO/organic роста, поведения пользователей, воронок регистрации и добавления маршрутов/статей.
- `$metravel-seo-index-operator` - ежедневная SEO/index рутина, GSC/index diagnostics, IndexNow backup, выполнение явно заданных URL Inspection / «Запросить индексирование» через авторизованный браузер и SEO task routing.
- `$metravel-code-reviewer` - обязательный review/fix pass после любых изменений
  кода: проверка полного task diff на баги, избыточность, дублирование, плохой
  reuse и неоптимальную логику, исправление findings, повторный review и validation.
- `$metravel-security-reviewer` - evidence-backed frontend security review: XSS/sanitization, unsafe URLs/redirects, secrets/tokens, WebView/deep links и production dependencies; read-only без явного запроса на fixes.
- `$metravel-devops-agent` - подготовка, запуск и проверка deploy на dev/preprod/prod с preflight, secret hygiene и post-deploy validation.
- `$metravel-android-portable-builder` - переносимая локальная Android-сборка на
  macOS/Windows/Linux из gitignored `.secrets` bundle без ручной настройки
  Keychain и без EAS; build-only, Play tracks не меняет.
- `$metravel-google-play-operator` - локальная Android production AAB-сборка и
  production-only Google Play API без EAS; closed-testing tracks и настройки
  защищены от изменений.
- `$metravel-production-smoke` - read-only smoke production `metravel.by` после deploy или при подозрении на 502/white screen/static/API/sitemap регрессию.
- `$metravel-docs-maintainer` - обновление `docs/`, `AGENTS.md`, `.codex/skills` и правил для Codex.
- `$metravel-prompt-maintainer` - аудит и поддержка `docs/*PROMPTS.md`, `assets/**/PROMPT.md`, skill metadata/default prompts, воспроизводимости и prompt-governance без написания самого article/quest content.
- `$metravel-task-contract` - обязательный контракт FE/BE задач на борде: scope, user-visible result, Data/API contract, platform/localization impact, dependencies, fallback/mock policy, validation и Done gate перед стартом/review/done.
- `$metravel-problem-memory` - обязательная проверка истории перед созданием,
  переоткрытием или дроблением задачи: ищет прежние `done`/`wont_do`/open
  карточки и реестр `docs/PROBLEM_MEMORY.md`, затем выбирает
  `reuse | reopen | create-linked | create-new`.
- `$metravel-ticket-board` - оператор общего MCP task board: list/create/update/sync задач и спринтов без правки feature-кода.
- `$metravel-sprint-reviewer` - приёмка тикетов активного спринта на MCP task
  board по Task Contract/Done gate с in-scope тестами/browser/API evidence;
  pass закрывает текущую карточку, `testing` сохраняется только для exact
  retest/temporal gate, отдельный дефект получает связанную карточку через
  Problem Memory, а missing access/device вызывает unblock-запрос и продолжение
  приёмки.
- `$metravel-backend-diagnostician` - read-only диагностика backend/API проблем,
  5xx/contract mismatch, backend status sync и создание/обновление back-задач с
  source/API/log evidence без автоматического Android/iPhone gate.
- `$metravel-article-editor-agent` - создание/редактирование/публикация article и travel-guide записей через API, photo-folder drafts, generated images/media, author/publish verification и только подтвержденные текстовые правки без вывода токенов.
- `$metravel-codex-orchestrator` - верхний workflow для Codex: triage, выбор skills/агентов, промты ролей, план проверок и финальный self-check.
- `$metravel-agent-workflow` - координация ролей business analyst, system architect, designer, programmer, QA, reviewer и DevOps.
- `$metravel-project-analyst` - read-only анализ структуры проекта, активных фич, рисков, проверок и handoff к профильным агентам.
- `$metravel-android-developer` - Android/native разработка и отладка Expo/React Native без регресса production web.
- `$metravel-ios-analyst` - требования и compliance первого iPhone-релиза: scope/non-goals,
  acceptance criteria со слоем evidence, маппинг App Review Guidelines, метаданные
  App Store и разделение agent-owned работы и Apple-действий владельца.
- `$metravel-ios-architect` - архитектура активного iPhone-приложения: shared/iOS
  boundaries, Apple capabilities, privacy/signing, task slicing и validation plan.
- `$metravel-ios-designer` - HIG и дизайн-система на iPhone: safe area, touch-таргеты,
  Dynamic Type, тёмная тема, accessibility, иконка/splash под release guard,
  локализованные скриншоты App Store и паритет mobile web/Android/iPhone.
- `$metravel-ios-developer` - реализация и отладка активного iPhone-приложения:
  iOS platform files, Xcode/runtime, Keychain, Apple auth UI, APNs, Universal Links,
  permissions, maps, media и safe areas.
- `$metravel-ios-reviewer` - независимый review-and-fix полного iOS task diff с
  Apple/privacy/release checklist и повторной validation.
- `$metravel-ios-tester` - read-only QA на simulator, physical iPhone и exact
  TestFlight candidate; device evidence не подменяется симулятором.
- `$metravel-ios-release-operator` - signed build, TestFlight/App Store Connect,
  App Review и storefront operations по четырём отдельным explicit gates.
- `$metravel-mobile-tester` - read-only проверка mobile web и, когда scope
  затрагивает Android-specific behavior, локальной Android USB-сборки;
  touch/layout/runtime evidence выбирается по реально затронутой поверхности.
- `$metravel-play-campaign-tester` - ежедневный проход общей Google Play closed-testing кампании на настроенном USB Android, проверка заданий/обновлений/крашей и ведение общего campaign log без покупок, отзывов, удаления приложений или смены аккаунтов.
- `$metravel-business-analyst` - продуктовые требования, user stories, acceptance criteria, non-goals, metrics и risks.
- `$metravel-system-architect` - technical design, разбиение работ, validation plan и review diff на соответствие правилам.
- `$metravel-qa-agent` - read-only исследование приложения, воспроизведение багов, bug reports и re-test фиксов.

Если задача попадает сразу в несколько областей, используй skills вместе, но не загружай лишние справки.
