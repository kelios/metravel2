# Docs index

Актуализировано: 2026-08-28.

`docs/RULES.md` определяет обязательные правила. Не каждый файл в `docs/`
является source of truth: dated snapshots и legacy adapters классифицированы
отдельно.

## Канонические документы

- `docs/INDEX.md` — классификация всех файлов в `docs/`;
- `docs/README.md` — quick start и API family map;
- `docs/ARCHITECTURE.md` — текущая архитектура и runtime boundaries;
- `docs/RULES.md` — обязательные project policies;
- `docs/CODEX.md` — AI triage, skills и validation matrix;
- `docs/GROK.md` — адаптер Grok Build; не source of truth правил;
- `docs/AGENT_ANALYSIS_PROTOCOL.md` — обязательная глубина разбора задачи для
  агентов: уровни, постановка, механизм отказа, план, доказательства, формат
  отчёта и стоп-слова;
- `docs/CODEX_SKILLS.md` — служебная grouped-карта `$metravel-*` skills; читать
  только при добавлении, удалении, переименовании или аудите каталога;
- `docs/WORKFLOW_OPERATIONS.md` — условные протоколы `AGENTS.md` §4:
  e2e-доступы, тестовые данные на production, Android device testing,
  production-target validation и координация долгих операций/locks;
- `docs/spec-driven-development.md` — канонический OpenSpec/SDD workflow;
- `docs/spec-driven-development-requirements.md` — обязательные требования к
  proposal, delta specs, design и tasks;
- `docs/DEVELOPMENT.md` — local development workflow;
- `docs/TESTING.md` — test/governance/quality-gate commands;
- `docs/MANUAL_TEST_CASES.md` — повторяемая risk-based QA/device матрица;
- `docs/DESIGN_SYSTEM.md` — design tokens и palette roles;
- `docs/RELEASE.md` — release/deploy flow;
- `docs/PRODUCTION_CHECKLIST.md` — production checklist;
- `docs/DB_BACKUP.md` — бэкап production-базы: где лежат копии, как снять дамп
  вручную, как включить регулярную выгрузку и как восстановиться;
- `docs/NATIVE_COMPAT_RULES.md` — web/native compatibility contract;
- `docs/TASK_BOARD_MCP.md` — единый task board и Task Contract workflow.
- `docs/PROBLEM_MEMORY.md` — recurring problem families, root causes,
  canonical task chains и duplicate/reopen preflight; не является backlog.

## Feature maps и load-bearing contracts

- `docs/features/README.md` — правила feature maps;
- `docs/features/travel.md` — catalog/detail/wizard ownership;
- `docs/features/map.md` — web/native map engines, bridge и place contract;
- `docs/features/places.md` — places catalog;
- `docs/features/auth.md` — вход/регистрация и матрица «провайдер × поверхность»;
- `docs/features/user.md` — profile, collections и author stats;
- `docs/features/calendar.md` — travel status calendar;
- `docs/features/offline.md` — offline-first shell, package storage, UX states
  и platform-scoped mobile-web/Android validation contract;
- `docs/features/quests.md` — квесты: список, лендинг города, прохождение,
  правила ответа, офлайн и печать;
- `docs/features/achievements.md` — достижения: значки, ранги, XP, peer- и
  редкие награды, gamification-прогрессия;
- `docs/features/trips.md` — совместные поездки, заявки и планировщик маршрута;
- `docs/features/article.md` — rich-text тело статьи: редактор, санитизация,
  черновики, SSG-подача и SEO;
- `docs/features/export.md` — PDF-книга, печатная версия квеста и выгрузка
  маршрута в GPX/KML;
- `docs/features/images.md` — сквозной пайплайн изображений (загрузка, хранение,
  раздача, выбор размера на фронте), зафиксированные решения и инварианты;
  читать ДО любой правки, касающейся картинок, чтобы не переизобретать пайплайн;
- `docs/features/social-trips-gamification-roadmap.md` — current social
  trips/gamification feature map, не backlog;
- `docs/features/map-current-location-route-mobile-mock.svg` — mobile map state
  mock;
- `docs/TRAVEL_SAVE_MODERATION_CONTRACT.md` — save ≠ moderation;
- `docs/TRAVEL_DRAFT_RECOVERY.md` — local draft persistence/recovery;
- `docs/TRAVEL_PERFORMANCE_REFACTOR.md` — current travel details performance
  contract;
- `docs/ACHIEVEMENTS_DESIGN.md` — achievements/ranks/peer/rare contract;
- `docs/PERF_014_EAGER_BUNDLE_AUDIT.md` — rationale и guard contract для web
  eager bundle;
- `docs/ICON_ART_PROMPTS.md` — canonical raster icon/art prompt specification;
- `docs/ACHIEVEMENTS_BADGE_PROMPTS.md` — badge visual spec: векторная эмблема
  (`components/achievements/BadgeEmblem.tsx`, `badgeMotif`) как дефолт и
  AI-промпт-схема как опциональный фоллбэк для `image_url`.
- `docs/FACEBOOK_LOGIN_DESIGN.md` — normative web auth states for Facebook
  registration/login rollout (implemented behind flag, blocked by backend contract).

`docs/features/TEMPLATE.md` — шаблон новой feature map; не runtime document.

## Architecture decisions

- `docs/adr/README.md` — ADR process;
- `docs/adr/0001-no-direct-linking-openurl.md`;
- `docs/adr/0002-images-via-image-card-media.md`;
- `docs/adr/0003-root-runtime-patches-and-metro-stubs.md`;
- `docs/adr/TEMPLATE.md` — шаблон ADR.

## Native/store operations

- `docs/IOS_OWNER_GUIDE.md` — пошаговая owner-инструкция для подготовки Apple
  Developer и App Store Connect по человеческой задаче #1410; создание App
  Store record, TestFlight и submission в этот этап не входят;
- `docs/ANDROID_OWNER_GUIDE.md` — owner-only Android build/Play flow;
- `docs/ANDROID_STORE_LISTING.md` — текущий store listing draft.

Android EAS build/submit запрещены; Android production использует local Gradle и
production-only Play API, а Android-specific QA — локальную USB-сборку. Общий
UI принимается в desktop/mobile web; iPhone проверяется только для iOS-specific
scope.

## External-link governance templates

- `docs/EXTERNAL_LINK_GOVERNANCE_PR_SUMMARY.md`;
- `docs/EXTERNAL_LINK_GOVERNANCE_PR_BODY.md`.

Каноническая policy остаётся в `docs/RULES.md`, а команды — в
`docs/TESTING.md#governance-commands`.

## Growth/content artifacts

Стратегия и append-only operational logs:

- `docs/GROWTH_PLAN.md` — шестимесячный plan с baseline/review dates;
- `docs/ARTICLE_ATTENTION_LOG.md` — журнал article attention cycles;
- `docs/QUEST_DEMAND_LOG.md` — журнал quest demand cycles;
- `docs/QUEST_CONTENT_PLAN.md` — план контента квестов: очереди доработки
  (poi_info, утечки, финале), перелинковка квест↔статья (включая канонический
  формат блока «Квесты по городам рядом», §3.3), план новых квестов.
- `docs/QUEST_ANSWER_INSIGHTS.md` — цикл «отчёт трения шага → решение редактора
  → правка квеста»: `npm run quest:insights`, группы кандидатов и почему
  автоприменение словаря запрещено.
- `docs/QUEST_FRICTION_ANALYSIS_LOG.md` — журнал разобранных прохождений:
  граница следующего прогона, вердикт и правка по каждому `progress_id`.

Dated snapshots — использовать только с указанным окном данных и не называть
«текущими» без нового замера:

- `docs/ANALYTICS_AUDIT_2026-07.md` — snapshot 2026-07-02;
- `docs/SEO_AUDIT_2026-07-11.md` — snapshot 2026-07-11;
- `docs/SEO_AUDIT_2026-07-18.md` — snapshot 2026-07-18 (on-page зрелость: рычаги = индексация + off-site + title-redirects);
- `docs/SEO_AUDIT_2026-07-27.md` — snapshot 2026-07-27 (P0: travel-URL отдают noindex-заглушку; индексация 291/306 закрыта; кластер «вторая страница»; 301-ремонт заголовков разблокирован);
- `docs/SEO_AUDIT_2026-08-08.md` — snapshot 2026-08-08 (авария 26.07 закрыта, цель 90 дн. перевыполнена; SSG режет тело статьи на 9 000 симв.; две страницы 55.6/25.8 МБ из-за base64 в `media`; `stats:index` проверял 0 статей);
- `docs/SOCIAL_CONTENT_PACK_2026-07.md` — content pack по июльскому GSC snapshot.

## Legacy local tooling

Эти файлы не являются task source of truth:

- `docs/AGENT_WORKBOARD.md` — compatibility adapter;
- `docs/AGENT_WORKBOARD_AUTOMATION.md` — local evidence runner notes;
- `docs/AGENT_WORKBOARD_LOCAL.html` — legacy local viewer.

Постоянный backlog находится только на MCP task board.
