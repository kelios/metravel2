# Testing guide

## Project root

- Current project: `metravel2`
- Run all commands from the `metravel2/` app root (this folder contains `package.json`).

## Package manager

- This repo uses Yarn v1 (`packageManager: yarn@1.22.x`). Prefer `yarn ...`.
- `npm run ...` usually works too, but examples below use Yarn.

## Unit / integration tests (Jest)

Commands:

```bash
yarn test        # watchAll
yarn test:run    # single run (recommended for CI/local checks)
yarn test:coverage
```

Related config:

- `jest.config.js`
- `__tests__/setup.ts`

Notes:

- Test environment is `jsdom`.
- Aliases: `@/*` resolves to the project root (`tsconfig.json` + `jest.config.js`).
- Many native/web APIs are mocked in `__tests__/setup.ts`. If a new test fails due to missing browser/native APIs, add a targeted mock there.

## E2E tests (Playwright)

Command:

```bash
yarn e2e
```

Additional:

```bash
yarn e2e:headed
yarn e2e:ui
```

How it works:

- Config: `playwright.config.ts`
- By default it builds a static web export and serves `dist/` via `scripts/e2e-webserver.js` (then Playwright runs against it).
- Default port is `8085` (override via `E2E_WEB_PORT`).

First-time setup:

```bash
npx playwright install
```

Environment:

- `E2E_API_URL` — if set, Playwright web server will use it as `EXPO_PUBLIC_API_URL`.
- If you want to run against an already running server:
  - set `E2E_NO_WEBSERVER=1` and `BASE_URL`.

Local proxy (used by `scripts/serve-web-build.js`):

- `E2E_API_PROXY_TARGET` (default `https://metravel.by`) — upstream API host for `/api/*` and media routes.
- `E2E_API_PROXY_INSECURE=true` — allow insecure HTTPS proxy (helpful for local cert issues).
- `E2E_API_PROXY_TIMEOUT_MS` (default `20000`) — upstream request timeout. Proxy can log `Proxy timeout...` even when tests still pass.

Cleanup (created travels):

- `E2E_API_CLEANUP_TIMEOUT_MS` (default `20000`) — per-request timeout for teardown deletes.
- `E2E_API_CLEANUP_BUDGET_MS` (default `60000`) — total teardown budget.

## CI-style test run

```bash
yarn test:ci
```

Includes `npm run check:image-architecture` and then runs Jest in CI mode.
