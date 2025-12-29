# Release

## Web

- Dev: `npm run web`
- Production-mode dev server: `npm run web:prod`
- Static export: `npm run build:web`

## iOS / Android (EAS)

Use scripts from `package.json`:

- iOS:
  - `npm run ios:build:dev`
  - `npm run ios:build:preview`
  - `npm run ios:build:prod`
  - `npm run ios:submit:latest`
- Android:
  - `npm run android:build:dev`

## Pre-release checklist

- Run tests: `npm run test:coverage`
- Verify env files: `.env.prod` / `.env.preprod` as applicable
- Verify web console has no debug noise

## Модерация и публикация (travel)

- Пользователь:
  - При отправке на модерацию должен выставлять `publish=true`.
  - `moderation` пользователь сам не ставит.
- Администратор:
  - Меняет `moderation` (одобрение/отклонение) в своей панели.
  - Email на администратора отправляется на бэке при сохранённом `publish=true` + `moderation` согласно серверной логике.
- UI/сохранение:
  - Если `publish=true` и `moderation=false` (отправлено на модерацию), блок выбора статуса скрыт, чтобы пользователь не нажимал повторно.
  - Для всех действий (отправка, одобрение, отклонение) стоит защита `actionPending`, чтобы в сеть уходил **один** запрос.
  - После ручного сохранения обновляется baseline автосейва, чтобы автосейв не отправлял старое состояние.

## MeTravel — Regression Summary (Web / iOS / Android)

- Command: `npm run test:coverage` (Jest coverage run across all suites).
- Result: command exits with code 1 today; `__tests__/api/travels.auth.test.ts` still asserts against a bare string while the mocked registration helper now returns `{ message, ok }`, and `__tests__/components/travel/UpsertTravel.integration.test.ts` cannot locate the moderation hint text `Нужно дополнить перед модерацией`. `__tests__/utils/networkErrorHandler.test.ts` now passes after the navigator guard was rewritten. Coverage-report artifacts still appear in `coverage/` despite the failure.
