# Project documentation

`docs/` — источник проектных правил и feature contracts. Полный каталог и
классификация файлов находятся в `docs/INDEX.md`.

## Канонические документы

- `ARCHITECTURE.md` — текущая архитектура и feature/runtime boundaries;
- `RULES.md` — обязательные development/UI/security/operation правила;
- `CODEX.md` — AI triage, skills и validation matrix;
- `DEVELOPMENT.md` — local setup и day-to-day workflow;
- `TESTING.md` — Jest, Playwright, governance и quality gates;
- `MANUAL_TEST_CASES.md` — повторяемые browser/mobile/device cases;
- `RELEASE.md` и `PRODUCTION_CHECKLIST.md` — release/deploy workflow;
- `DESIGN_SYSTEM.md` — design tokens и visual roles;
- `features/` — domain maps; `adr/` — принятые architecture decisions.

Общий application contract: единый Expo/React Native codebase для
production web, Android и iOS/iPadOS; production UI поддерживает
RU/BE/UK/PL/EN. Перед задачей фиксируй platform/localization impact по
`AGENTS.md` и `CODEX.md`; implementation-детали i18n — в
`DEVELOPMENT.md#localization`.

Dated analytics/SEO/content files — snapshots, а не live source of truth.
Legacy local workboard files — compatibility tooling, а не task state.

## Быстрый старт

Запускайте команды из корня с `package.json`. Требуется Node `>=22.13.1 <23` и
Yarn `1.22.22`.

```bash
nvm use
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
yarn start
```

Версия Node закреплена в `.node-version` и `.nvmrc`. Install, quality-gate
проверки и web build wrappers падают сразу, если в PATH оказался Node 20 или
другая неподдерживаемая версия; в этом случае запустите `nvm use` из корня
репозитория.

Web и базовые проверки:

```bash
yarn web
yarn check:fast
yarn lint
yarn test:run
```

Production web export:

```bash
yarn build:web:prod
```

Перед full/preflight/e2e/build/deploy/Lighthouse/Android install проверьте
operation gate из `AGENTS.md` и `RULES.md`.

Если test/quality gate уже принадлежит другому живому процессу, текущий чат
сразу получает `SKIPPED`: не ждёт, не перезапускает проверку после освобождения
lock и не запускает обходной тест. Если этот gate покрывает нужный scope и тесты
были единственным оставшимся Done-gate шагом, handoff фиксирует
`validation delegated: active gate pid/name`, и задачу можно закрыть без заявления
`passed`. Владелец активного gate исправляет падения и повторяет проверку; иначе
используется `validation skipped`, и задача остаётся открытой.

## Backend boundary

Этот workspace не содержит backend implementation. Backend/Django/API/server
можно анализировать read-only; исправления оформляются как `area=back` tasks на
MCP board. Frontend не маскирует отсутствующий contract mock-only fallback.

API origin задаётся `EXPO_PUBLIC_API_URL`; API clients нормализуют `/api` path.
OpenAPI/Redoc URL строится от текущего configured origin. Не закрепляйте в
документации частный LAN host.

Auth contract использует backend session/token semantics через общий API client.
Credentials и tokens берутся только из gitignored env/secret files и никогда не
копируются в docs или логи.

## API family map

Точные DTO и fallback rules принадлежат соответствующим `api/*.ts`, normalizers
и tests. Основные endpoint families:

### Auth and user

- `/api/user/login/`, `/logout/`, `/registration/`, confirmation/reset flows;
- `/api/user/{id}/profile/` и profile update/avatar upload;
- `/api/user/{id}/favorite-travels/`, `/history/`, recommendations и travel
  statuses;
- subscriptions, contacts, messages и user points через профильные adapters.

### Travel and articles

- `/api/travels/` — public/user lists;
- `/api/travels/{id}/`, `/by-slug/{slug}/`, `/resolve-slug/{slug}/` — detail;
- `/api/travels/upsert/` — create/edit save contract;
- favorite/rating/comments/routes/media actions — отдельные typed adapters;
- `/api/articles/` — article list/detail/editor-related contract.

### Map, quests and social

- map search/clusters/filter/routing families — `api/map.ts` и map hooks;
- quests — quest adapters/hooks;
- planned/public trips, chat, Telegram/contact flows — `api/*Trips*`,
  `api/trip*`, `api/contactRequests.ts`;
- achievements/gamification — `api/achievements*.ts`, `api/gamification*.ts`.

При расхождении этой карты с adapter code источником факта является код; docs
обновляются в той же задаче.

## Task tracking

Общий MCP task board — единственный постоянный backlog. Каждая задача содержит
active sprint, `area=front|back`, Task Contract, dependencies, validation и Done
gate. При `401` сначала обновляется staff token по `TASK_BOARD_MCP.md` через
`.env.e2e`; локальный `tasks/000-template.md` допустим только как временный
fallback.

## Governance templates

- `EXTERNAL_LINK_GOVERNANCE_PR_SUMMARY.md` — краткое описание governance change;
- `EXTERNAL_LINK_GOVERNANCE_PR_BODY.md` — PR body template.

Каноническая external-link policy находится в `RULES.md`, команды — в
`TESTING.md#governance-commands`.
