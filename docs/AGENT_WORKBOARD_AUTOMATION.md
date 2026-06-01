# Agent workboard automation

This document defines the safe automation path for the local Metravel agent workboard.

## Goal

Automate evidence collection, backlog hygiene, status summaries, and validation suggestions without creating fake progress. The board may show activity only when there is a real artifact: a command result, browser check, manual QA note, review finding, requirement, or approved blocker.

## Current rule

- `docs/AGENT_WORKBOARD.md` is the canonical human-readable work journal.
- `docs/AGENT_WORKBOARD_LOCAL.html` is a local-only viewer.
- `.codex-temp/workboard/current.json` is the local automation evidence bridge.
- `localStorage` must not be treated as canonical task state.

## First automation layer

The project has a safe local runner:

```bash
npm run workboard:heartbeat
npm run workboard:cycle:dry
npm run workboard:cycle -- --run check-fast
```

The runner:

- runs only on branch `main`;
- writes evidence to `.codex-temp/workboard/`;
- uses an allowlist of safe local commands;
- records `activeCycle` while a run is in progress;
- self-recovers from stale lock files left by crashed runs;
- applies per-command timeouts so the heartbeat cannot hang forever;
- does not run deploy commands;
- does not move tasks to `Done`;
- redacts token-like output;
- uses a lock file so two cycles do not run at once.

## Evidence model

Each automation run writes:

```text
.codex-temp/workboard/current.json
.codex-temp/workboard/runs/<run-id>/run.json
.codex-temp/workboard/runs/<run-id>/*.stdout.log
.codex-temp/workboard/runs/<run-id>/*.stderr.log
```

The current bridge is ignored by git. It is for local visibility and can later be imported into the local board UI.

## What can be automated

- Daily status scan: active tasks, blocked tasks, stale tasks, tasks without evidence.
- Backlog hygiene: missing owners, missing next actions, `Done` without evidence.
- Safe validation: `check:fast:json`, `check:fast`, `check:preflight:dry`, governance checks.
- Evidence collection: command, exit code, duration, changed files, stdout/stderr log paths.
- Suggestions: next owner, next task, validation plan, whether a task is eligible for manual approval.

## Safe command allowlist

The runner is intentionally not a generic shell executor. It accepts only command IDs defined in `scripts/workboard-cycle.js`.

Current IDs:

- `check-fast-dry`: dry-run scope decision via `node scripts/run-fast-scope-checks.js --dry-run --json`.
- `check-fast`: local fast checks via `node scripts/run-fast-scope-checks.js`.
- `check-preflight-dry`: dry-run preflight decision.
- `governance`: local external-link guards via direct Node scripts, without requiring `npm` in the heartbeat environment.

The recurring heartbeat should use only `check-fast-dry`. Expensive checks and real e2e runs must be triggered by an explicit task decision, not by an endless background loop.

## What must stay manual

- Sprint commitment and priority decisions.
- Approval to start implementation.
- Moving a task to `Done`.
- Production, preprod, or dev deploy approval.
- Any server path, SSL, Nginx, SSH, EAS submit, or secret-related operation.
- UX/design judgment that requires human inspection.

## Target architecture

The complete version should move duplicated board data into a structured source:

```text
docs/AGENT_WORKBOARD.json
docs/AGENT_WORKBOARD.md
docs/AGENT_WORKBOARD_LOCAL.html
scripts/agent-workboard/
```

Recommended next steps:

1. Extract the current task list and evidence into `docs/AGENT_WORKBOARD.json`.
2. Add a validator: unique IDs, valid statuses, owners, priorities, `Done` requires evidence.
3. Generate Markdown and HTML from JSON to stop drift between files.
4. Restrict HTML `localStorage` to UI preferences only.
5. Show `.codex-temp/workboard/current.json` in the local board as latest automation evidence.
6. Add tests for the validator and generated outputs.

## QA automation matrix

- `T-023 Search`: existing e2e and desktop/mobile browser evidence can auto-propose Done, but final Done remains approval-based.
- `T-024 Home`: existing quick-filter e2e and desktop/mobile browser evidence can auto-propose Done.
- `T-025 Map`: use `e2e/map-page.spec.ts`, `map-mobile-panel-content`, `map-popup-close`, and `map-travel-card-no-image`.
- `T-026 Places`: add a direct `/places` e2e before auto-closing is honest.
- `T-027 Quests`: `quest-video.spec.ts` is partial only; add quest flow e2e.
- `T-028 PDF/export`: add browser download/print/export checks before Done can be proposed.

## Operating policy

Automation may propose. Андриуш approves. Мариночка retests. Ромик implements only approved, evidence-backed work. Витаутас keeps the runner healthy and local-only unless a deploy target is explicitly approved.
