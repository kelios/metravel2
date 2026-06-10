# Frontend workboard

Last updated: 2026-06-10.

> **Источник правды о задачах — общий MCP task board** (`metravel.by/board`, Django app
> `task_board`, единый для фронта и бэка). Заведение/трекинг — агент `ticket-board`, прогон по
> пайплайну — skill `/ticket-flow`. Setup и миграция: `docs/TASK_BOARD_MCP.md`.
> Эта страница — короткий журнал правил и открытого FE-бэклога, не дубль борда.

Backend-очередь и доказательства закрытия бэкенд-задач — на борде (`area=back`); статусы и
верификацию (код `origin/master` + прод-пробы) ведёт агент `backend-status-sync` в комментариях
тикетов. (Файл `docs/BACKEND_WORKBOARD.md` упразднён 2026-06-10, история в git.)

## Обязательные правила (load-bearing)

- **Browser verification rule** (все UI/web/perf-изменения): любое видимое или
  web-поведенческое изменение проверяется в реальном браузере (Playwright / preview / ручной
  прогон) до статуса `done`. Подтверждения: (1) браузерная проверка (скриншот / e2e pass /
  консоль без новых ошибок), (2) зелёный review diff. До этого максимум `review`/`in_progress`
  с пометкой «browser verification pending».
- **Authenticated QA rule** (sign-in-gated: travel create/edit/publish, drafts, favorites/
  rating/comments write, export, messages, subscriptions): только тестовый e2e-аккаунт из
  `.env.e2e` (`E2E_EMAIL`/`E2E_PASSWORD`/`E2E_API_URL`) через программный логин
  `POST /api/user/login/` → `Authorization: Token` (`e2e/helpers/e2eApi.ts`, web-токен в
  `localStorage['secure_userToken']`) ИЛИ Playwright auth setup / `storageState`
  (`e2e/global-setup.ts`, `e2e/fixtures.ts`). Запрещено: ручной ввод пароля в форму, вывод
  `E2E_PASSWORD`/токена в логи/скрины, деструктив под тестовым аккаунтом. Только локально/preview,
  read/navigation и обратимые проверки. Спеки: `e2e/auth-smoke.spec.ts`,
  `e2e/manual-qa-auth-entrypoints.spec.ts`, `e2e/travel-draft-owner-preview.spec.ts`,
  `e2e/travel-full-flow.spec.ts`.
- **Evidence rule:** `done` только с доказательством — changed files, тест/браузер-проверка,
  review, либо явный docs-only артефакт.

## Контракты кода (из CLAUDE.md)

Изображения → `components/ui/ImageCardMedia.tsx`; travel-карточки → `UnifiedTravelCard.tsx`;
внешние ссылки → `@/utils/externalLinks.openExternalUrl`; серверный стейт — React Query,
клиентский — Zustand; TS strict (без нового `any` в `api/`/`hooks/`/`stores/`); RN Web-совместимость.

## Открытый FE-бэклог (переходный — импортируется на борд)

| ID | Задача | Статус | Заметка |
|---|---|---|---|
| FE / tasks/070 | SPA new-version detection (подсказка обновить вкладку при новом билде) | Backlog | После деплоя пользователи остаются на старом бандле |
| FE / tasks/073 | SecureStorage token: слабый XOR → нормальное шифрование/хранение | Backlog | Security; см. `tasks/073` |
| FE / tasks/074 | Nominatim fetch → React Query (кэш/ретраи/инвалидация) | Backlog | Карта/гео |
| FE / tasks/004 | e2e-регрессия: старый slug → 301 → новая страница | Optional | BE-IDX-1 задеплоен, FE resolve-slug live — нужна только регрессия |
| TD-036 | `api/client.ts` >800 LOC — распил (file-complexity guard) | Backlog | Координировать перед правкой; `refactor-surgeon`/`split-component` |

Архитектурный аудит приложения — `docs/T-073-ARCHITECTURE-AUDIT.md` (порядок пикапов).
Perf-бэклог — `docs/PERF_HOME_LCP_BACKLOG.md`, `docs/PERF_SPEEDUP_PLAN.md`.

## История

Полный журнал закрытых задач (T-001…T-074, F-/D-/PERF-/TD-серии, спринты Travel QA /
Performance Refactor и fictional-team roster) удалён при миграции на MCP-борд 2026-06-10 —
история доступна в git. Закрытые бэкенд-задачи — на борде (`area=back`, статус `done`).
