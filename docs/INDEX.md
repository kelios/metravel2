# Docs index

Актуализировано: 2026-07-15.

`docs/RULES.md` определяет обязательные правила. Не каждый файл в `docs/`
является source of truth: dated snapshots и legacy adapters классифицированы
отдельно.

## Канонические документы

- `docs/INDEX.md` — классификация всех файлов в `docs/`;
- `docs/README.md` — quick start и API family map;
- `docs/ARCHITECTURE.md` — текущая архитектура и runtime boundaries;
- `docs/RULES.md` — обязательные project policies;
- `docs/CODEX.md` — AI triage, skills и validation matrix;
- `docs/DEVELOPMENT.md` — local development workflow;
- `docs/TESTING.md` — test/governance/quality-gate commands;
- `docs/MANUAL_TEST_CASES.md` — повторяемая QA/device матрица;
- `docs/DESIGN_SYSTEM.md` — design tokens и palette roles;
- `docs/RELEASE.md` — release/deploy flow;
- `docs/PRODUCTION_CHECKLIST.md` — production checklist;
- `docs/NATIVE_COMPAT_RULES.md` — web/native compatibility contract;
- `docs/TASK_BOARD_MCP.md` — единый task board и Task Contract workflow.

## Feature maps и load-bearing contracts

- `docs/features/README.md` — правила feature maps;
- `docs/features/travel.md` — catalog/detail/wizard ownership;
- `docs/features/map.md` — web/native map engines, bridge и place contract;
- `docs/features/places.md` — places catalog;
- `docs/features/user.md` — profile, collections и author stats;
- `docs/features/calendar.md` — travel status calendar;
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
- `docs/ICON_ART_PROMPTS.md` — canonical raster icon/art prompt specification.
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

- `docs/ANDROID_OWNER_GUIDE.md` — owner-only Android build/Play flow;
- `docs/ANDROID_STORE_LISTING.md` — текущий store listing draft.

Android EAS build/submit запрещены; Android production использует local Gradle и
production-only Play API, а обычная QA — локальную USB-сборку.

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
  (poi_info, утечки, финале), перелинковка квест↔статья, план новых квестов.

Dated snapshots — использовать только с указанным окном данных и не называть
«текущими» без нового замера:

- `docs/ANALYTICS_AUDIT_2026-07.md` — snapshot 2026-07-02;
- `docs/SEO_AUDIT_2026-07-11.md` — snapshot 2026-07-11;
- `docs/SEO_AUDIT_2026-07-18.md` — snapshot 2026-07-18 (on-page зрелость: рычаги = индексация + off-site + title-redirects);
- `docs/SOCIAL_CONTENT_PACK_2026-07.md` — content pack по июльскому GSC snapshot.

## Legacy local tooling

Эти файлы не являются task source of truth:

- `docs/AGENT_WORKBOARD.md` — compatibility adapter;
- `docs/AGENT_WORKBOARD_AUTOMATION.md` — local evidence runner notes;
- `docs/AGENT_WORKBOARD_LOCAL.html` — legacy local viewer.

Постоянный backlog находится только на MCP task board.
