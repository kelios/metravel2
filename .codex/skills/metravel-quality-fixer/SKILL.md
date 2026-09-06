---
name: metravel-quality-fixer
description: "Run and repair the full metravel lint, Jest, and Playwright quality baseline. Use when the user asks for a repository-wide validation/fix cycle."
---

# Metravel Quality Fixer

`AGENTS.md` is inherited. Load the quality-gate and operation sections from
`docs/TESTING.md`/`docs/WORKFLOW_OPERATIONS.md`; load development or release
sections only when a failure touches them.

Use this skill when the task is to validate the repository broadly and fix what breaks, rather than to implement one feature first.

## When to use

- User explicitly asks to run `lint`, tests, and `e2e`
- A branch or local workspace must be brought back to a green validation baseline
- Multiple quality gates fail across code, tests, and browser flows

## Workflow

1. Start from repo root and check branch + `git status --short`.
2. Apply the operation coordination rule from `AGENTS.md`/`docs/RULES.md`; if another full/preflight/e2e gate is active, stop your duplicate launch immediately. Do not wait, poll, rerun after release, or start a narrower bypass. Record `validation delegated/skipped: active gate pid/name` only as coordination. If its result is required for acceptance, request it from the owner and resume the same pass; do not close from delegation or park the task in `testing`.
3. Run the full gate requested by the user (`npm run lint`, `npm run test:run`, `npm run e2e`) unless docs or a blocker require a narrower first pass.
4. Fix real failures in the touched or failing scope; do not mask them with skips, retries-only hacks, or allowlist drift.
5. After each fix, rerun the failing command first, then rerun the broader confidence check that still matches the task scope.
6. If visible web behavior changed, verify the scenario in a real browser and confirm no new console errors.

## Repo specifics

- For governance-sensitive fixes, rerun `npm run guard:external-links` or `npm run governance:verify`.
- For flaky `e2e`, capture the exact failing spec, rerun it narrowly, fix the root cause, and then return to the broader suite.
- If a failure is unrelated and cannot be safely fixed in this task, report the exact command, failing test/spec, risk, and next verification step.
