---
name: metravel-test-runner
description: Choose and run the narrowest reliable metravel Jest, integration, smoke, or governance checks for the touched scope, analyze failures, rerun after fixes, and avoid leaving skipped or unresolved test failures in this repository.
---

# Metravel Test Runner

Read `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, and `docs/CODEX.md` before choosing commands.

Use this skill when the main job is to run tests rather than write product code.

## Command selection

- Before running tests, apply the operation coordination rule from `AGENTS.md`/`docs/RULES.md`. If a live quality gate already exists, stop your own launch immediately: do not wait, poll, monitor it, retry after release, or run a narrower bypass check. Use `validation delegated: active gate pid/name` when that gate covers the required scope and tests are the only remaining Done-gate step; the task may close without claiming `passed`. Otherwise use `validation skipped: active gate pid/name` and keep the task open.
- Start with the narrowest reliable command for the touched scope.
- Prefer targeted `npm run test:run -- <path-or-pattern>` when a single area already has focused coverage.
- Use `npm run check:fast` for a finished small logical block.
- Use `npm run check:preflight` before handoff for medium changes or when selective e2e matters.
- Use `npm run governance:verify` or `npm run guard:external-links` for governance-sensitive work.
- Use `npm run test:i18n` for app-owned UI copy, translation resources, locale
  state/storage, formatting/plurals, accessibility text, or SEO locale changes.
- Use full `npm run lint` and `npm run test:run` only for large or cross-cutting changes.

## Failure handling

- Treat failures in the touched scope as part of the task and rerun after fixing them.
- The chat that starts a gate owns its failures and rerun. It must fix real failures; if it cannot, it reopens the affected task or records a blocker. Do not take over or duplicate failures from another chat's active gate.
- Do not accept `.skip`, `it.skip`, `test.skip`, `describe.skip`, `xit`, or `xtest` as a workaround.
- If a failure is clearly unrelated, report the exact command, failing test, risk, and why it was not fixed.
- Keep logs and ad-hoc output only in ignored local folders such as `.codex-temp/` or `.codex-debug/`.

## Repo specifics

- Run commands from the repo root.
- Use feature docs from `docs/features/` when you need scope-specific test context.
- Map platform and localization impact before choosing commands. Web, Android,
  and iOS runtime evidence are separate; RU/BE/UK/PL/EN parity is part of i18n scope.
- For performance or browser behavior, hand off to `$metravel-performance-analyst` or `$metravel-e2e-runner` instead of inferring from unit-test output.
