# Testing guide

## Project root

- Current project: `metravel2`
- Run all commands from the `metravel2/` app root (this folder contains `package.json`).

## Package manager

- This repo uses Yarn v1 (`packageManager: yarn@1.22.x`). Prefer `yarn ...`.
- `npm run ...` usually works too, but examples below use Yarn.

## Node.js version

- React Native `0.81.5` requires Node `>= 20.19.4`.
- Recommended: use `nvm` and the repo `.nvmrc`.

```bash
nvm install
nvm use
yarn install
```

## Unit / integration tests (Jest)

Commands:

```bash
yarn test        # watchAll
yarn test:run    # single run (recommended for CI/local checks)
yarn test:coverage
```

Related config:

- `jest.config.js`
- `jest.expo-globals.js`
- `__tests__/setup.ts`

Notes:

- Test environment is `jsdom`.
- Aliases: `@/*` resolves to the project root (`tsconfig.json` + `jest.config.js`).
- Many native/web APIs are mocked in `__tests__/setup.ts`. If a new test fails due to missing browser/native APIs, add a targeted mock there.

### API base URL rule for Jest

- **Jest must never rely on `window.location.origin` for API calls.**
- In unit/integration tests the API base must come from `EXPO_PUBLIC_API_URL`.
- The local webserver origin (usually `http://127.0.0.1:8085`) is an **E2E concern** (Playwright) and must not leak into Jest.

Defaults:

- `jest.expo-globals.js` and `__tests__/setup.ts` set a safe default `EXPO_PUBLIC_API_URL` to the dev server: `http://192.168.50.36`.
- If you need a different server for tests, override before running Jest (shell env wins).

If you see an error like:

- `Forbidden API base in Jest: http://127.0.0.1:8085/api/...`

it means some code path is building API URLs from `window.location.origin` instead of `process.env.EXPO_PUBLIC_API_URL`.

## E2E tests (Playwright)

### Test strategy

Tests are split into three tiers using tags in `test.describe()`:

| Tier | Tag | Purpose | ~Time |
|------|-----|---------|-------|
| **Smoke** | `@smoke` | Critical path — pages load, API works | 2 min |
| **Perf** | `@perf` | CLS, Web Vitals, performance budgets | 5 min |
| **Regression** | _(all)_ | Full suite | 15 min |

### Commands

```bash
yarn e2e                          # full regression (default)
E2E_SUITE=smoke yarn e2e          # smoke only (pre-deploy gate)
E2E_SUITE=perf  yarn e2e          # perf audits only
yarn e2e:headed                   # with visible browser
yarn e2e:ui                       # Playwright UI mode
```

### Parallelization

- `fullyParallel: true` — tests within a file run independently.
- **Local:** 50% of CPU cores.
- **CI:** 2 workers (stability over speed).
- Tests that share state use `test.describe.serial()`.

### How it works

- Config: `playwright.config.ts`
- By default it builds a static web export and serves `dist/` via `scripts/e2e-webserver.js` (then Playwright runs against it).
- Default port is `8085` (override via `E2E_WEB_PORT`).

### Shared helpers (`e2e/helpers/`)

| File | Purpose |
|------|---------|
| `navigation.ts` | `gotoWithRetry`, `preacceptCookies`, `assertNoHorizontalScroll`, `navigateToFirstTravel`, `waitForMainListRender`, `tid` |
| `auth.ts` | `isAuthenticated`, `getCurrentUser`, `waitForAuth`, `simpleEncrypt`, `ensureAuthedStorageFallback` |
| `e2eApi.ts` | Direct API calls, test data creation/cleanup |
| `consoleGuards.ts` | Console error detection |
| `layoutAsserts.ts` | `expectNoOverlap`, `expectFullyInViewport`, `expectNoHorizontalScroll` |
| `storage.ts` | `seedNecessaryConsent`, `hideRecommendationsBanner` (used internally by `navigation.ts`; specs should use `preacceptCookies` instead) |
| `routes.ts` | `getTravelsListPath` |

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

## Known peer dependency warnings

You may see warnings during `yarn install`:

- `react-leaflet@4.x` declares peer deps for React 18, while this repo uses React 19.
- `@react-pdf/renderer@3.x` declares peer deps up to React 18.

At the moment we keep them as-is because the app works and tests pass, but treat these as “watch items” after upgrades.
