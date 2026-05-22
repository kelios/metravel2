---
name: metravel-performance-analyst
description: Analyze metravel performance using production builds or real URLs, compare Lighthouse and bundle baselines, validate perf budgets, and report actionable findings without drawing conclusions from Expo dev-server behavior.
---

# Metravel Performance Analyst

Read `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/RELEASE.md`, and `docs/CODEX.md` before doing performance analysis. For travel-page work, also read `docs/TRAVEL_PERFORMANCE_REFACTOR.md`.

## Core rules

- Never use Expo dev-server request counts or dev bundles as production truth.
- Run Lighthouse only against `npm run build:web:prod` output or the real production URL.
- Keep analysis aligned with repo budgets and canonical commands.
- Do not suggest service-worker caching, forced reloads, or user-facing cache-clearing workarounds.

## What to analyze

- Lighthouse mobile and desktop scores
- LCP element and first-screen behavior
- Bootup, main-thread work, and unused JavaScript
- Bundle composition via build output or `npm run analyze:bundle`
- Existing perf-budget tests such as `npm run test:travel:performance` or `npm run e2e:perf-budget`

## Repo command map

- `npm run build:web:prod`
- `npm run lighthouse:travel:mobile`
- `npm run lighthouse:travel:desktop`
- `npm run lighthouse:produrl:travel:mobile`
- `npm run lighthouse:produrl:travel:desktop`
- `npm run lighthouse:produrl:summary`
- `npm run analyze:bundle`

## Output contract

Report:

- exact URL or build target
- command(s) used
- score/budget result
- key regression or improvement
- likely files or layers involved
- next validation step

