# MeTravel Testing Guide

## Project Root (важно)

Все команды ниже предполагают, что вы находитесь в папке с `package.json`:

```bash
metravel2/metravel2
```

Если запускать `npm` из родительской папки, будет ошибка вида `Could not read package.json`.

## Test Scripts Overview

### Unit/UI Tests
- **`npm run test`** - Watch all files in interactive mode (requires 'q' to exit)
- **`npm run test:run`** - Single run, no interactive mode (recommended for CI/automation)
- **`npm run test:watch`** - Watch only changed files
- **`npm run test:coverage`** - Run tests with coverage report
- **`npm run test:ci`** - CI mode with JSON output and image architecture check

### E2E Tests (Playwright)
- **`npm run e2e`** - Headless E2E tests
- **`npm run e2e:headed`** - E2E tests with browser UI
- **`npm run e2e:ui`** - Interactive Playwright UI

## Usage Examples

### Development
```bash
# Run tests once without interactive mode
npm run test:run

# Watch for changes in all files
npm run test

# Watch only changed files
npm run test:watch

# Run with coverage
npm run test:coverage

# Run only tests matching a pattern (passes args to Jest)
npm run test:run -- pdf
npm run test:run -- TravelDataTransformer
```

### CI/CD
```bash
# Automated test run (no interaction required)
npm run test:run

# CI mode with full reporting
npm run test:ci
```

### E2E Testing
```bash
# Start web server
npm run web

# Run E2E tests
BASE_URL=http://localhost:19006 npm run e2e

# Run with custom thresholds
E2E_CLS_MAX=0.05 E2E_LCP_MAX_MS=4500 E2E_INP_MAX_MS=250 BASE_URL=http://localhost:19006 npm run e2e
```

## Configuration Notes

- `test:run` uses `--passWithNoTests` flag to avoid failures when no tests found
- `test:watch` uses `--watch` for changed files only
- `test` remains with `--watchAll` for backward compatibility
- `test` (`--watchAll`) is interactive and may require manual exit (`q`)

## Test Structure

- Unit tests: `__tests__/**/*.test.tsx` and `__tests__/**/*.test.ts`
- Coverage excludes Map components and other heavy dependencies
- Jest configured with jsdom environment and Expo preset
- Module mocks for images, styles, and native modules
