# Development guide

## Project root

- Current project: `metravel2`
- Run all commands from the `metravel2/` app root (this folder contains `package.json`).

## Setup

```bash
npm install
cp .env.dev .env
```

## Start

```bash
npm run start
```

### Web

```bash
npm run web
```

### iOS / Android

```bash
npm run ios
npm run android
```

## Useful scripts

- `npm run lint` — ESLint.
- `npm run format` — Prettier.
- `npm run clean` — Expo start with clear cache.
- `npm run reset` — Expo reset cache.
- `npm run check-deps` — dependency checks.
- `npm run check:image-architecture` — enforces image/card architecture rules (also runs in `npm run test:ci`).

## Environment variables

Minimum required for unit tests and local dev:

- `EXPO_PUBLIC_API_URL` — backend base URL.

Optional:

- OpenRouteService key for routing (see `README.md`).

## Project structure (high level)

- `app/` — Expo Router routes/pages.
- `components/` — UI/components.
- `hooks/`, `utils/`, `src/` — business logic and utilities.
- `__tests__/` — unit/integration tests.
- `e2e/` — Playwright end-to-end tests.
- `constants/` — design system tokens.

## UI implementation rules

See `RULES.md`.
