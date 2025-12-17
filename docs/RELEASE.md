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
