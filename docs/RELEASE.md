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
  - `npm run android:build:preview`
  - `npm run android:build:prod`
  - `npm run android:submit:latest`

## Pre-release checklist

- Run tests: `npm run test:coverage`
- Verify env files: `.env.prod` / `.env.preprod` as applicable
- Verify web console has no debug noise

## MeTravel — Regression Summary (Web / iOS / Android)

- Command: `npm run test:coverage` (Jest coverage run across all suites).
- Result: suites pass except for `__tests__/utils/networkErrorHandler.test.ts` (`navigator.onLine` mocked as `false` while the assertion expects `true`), so the run exits with code 1 despite the rest of the platform-relevant tests finishing successfully. Coverage-report artifacts still appear in `coverage/` following the run.
