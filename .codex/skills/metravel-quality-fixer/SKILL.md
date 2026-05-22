---
name: metravel-quality-fixer
description: Run metravel lint, Jest, and Playwright validation end to end, fix real failures in scope, rerun the affected checks, and leave the repository with a clean quality-gate baseline or an explicit unrelated blocker.
---

# Metravel Quality Fixer

Read `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/DEVELOPMENT.md`, `docs/RELEASE.md`, and the task triage in `docs/CODEX.md` before using this skill.

Use this skill when the task is to validate the repository broadly and fix what breaks, rather than to implement one feature first.

## When to use

- User explicitly asks to run `lint`, tests, and `e2e`
- A branch or local workspace must be brought back to a green validation baseline
- Multiple quality gates fail across code, tests, and browser flows

## Workflow

1. Start from repo root and check branch + `git status --short`.
2. Run the full gate requested by the user (`npm run lint`, `npm run test:run`, `npm run e2e`) unless docs or a blocker require a narrower first pass.
3. Fix real failures in the touched or failing scope; do not mask them with skips, retries-only hacks, or allowlist drift.
4. After each fix, rerun the failing command first, then rerun the broader confidence check that still matches the task scope.
5. If visible web behavior changed, verify the scenario in a real browser and confirm no new console errors.

## Repo specifics

- Keep temporary traces, screenshots, and reports only in ignored folders such as `playwright-report/`, `test-results/`, `.codex-temp/`, or `.codex-debug/`.
- For governance-sensitive fixes, rerun `npm run guard:external-links` or `npm run governance:verify`.
- For flaky `e2e`, capture the exact failing spec, rerun it narrowly, fix the root cause, and then return to the broader suite.
- If a failure is unrelated and cannot be safely fixed in this task, report the exact command, failing test/spec, risk, and next verification step.
