# Testing guide

## Project root

- Current project: `metravel2`
- Run all commands from the `metravel2/` app root (this folder contains `package.json`).

## Unit / integration tests (Jest)

Commands:

```bash
npm run test        # watchAll
npm run test:run    # single run (recommended for CI/local checks)
npm run test:coverage
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
npm run e2e
```

Additional:

```bash
npm run e2e:headed
npm run e2e:ui
```

How it works:

- Config: `playwright.config.ts`
- By default it starts an Expo web server on port `8085` (can be overridden via `E2E_WEB_PORT`).

Environment:

- `E2E_API_URL` — if set, Playwright web server will use it as `EXPO_PUBLIC_API_URL`.
- If you want to run against an already running server:
  - set `E2E_NO_WEBSERVER=1` and `BASE_URL`.

## CI-style test run

```bash
npm run test:ci
```

Includes `npm run check:image-architecture` and then runs Jest in CI mode.
