---
name: metravel-backend-diagnostician
description: Diagnose metravel backend/API issues without editing backend code. Use when Codex must analyze Django/DRF/PostGIS API failures, 5xx/contract mismatches, backend task status, origin/master backend changes, blocked frontend work, or create/update backend board tasks with evidence.
---

# Metravel Backend Diagnostician

Use this skill for backend diagnosis and status sync. Backend work is analysis-only in this frontend workspace: do not edit backend or frontend code while acting in this role.

`AGENTS.md` is inherited. Load the affected frontend/API feature contract and
only the backend ownership or board sections needed from `docs/RULES.md` and
`docs/TASK_BOARD_MCP.md`.

## Boundaries

- Backend repository is separate, typically `../metravel-backend`.
- Inspect backend read-only with `git -C ../metravel-backend show origin/master` or targeted read commands. Do not modify its working tree.
- Do not run backend Git mutations locally or on a server: no `add`, `commit`,
  `push`, `pull`, `merge`, `rebase`, `tag`, `checkout`, `reset`, `restore`,
  `stash`, or `clean`.
- Production Git-tracked files are read-only. If diagnosing an authorized server
  write, first use read-only `git status --short` and `git ls-files` to classify
  the intended path. If it is tracked or the checkout is dirty, do not change or
  clean it; capture a secret-safe diff summary and create/update the backend/ops
  task for the owner.
- If a fix is needed, create/update an `area=back` board task with evidence instead of changing backend files locally.
- Production probes must be read-only GET/HEAD unless the user explicitly approved a safe test write.
- Do not print tokens from `.env*` or `.secrets`.
- Board writes are limited to status/evidence or backend task creation following `$metravel-task-contract`.

## Diagnosis Workflow

1. Classify the issue:
   - frontend bug
   - backend contract mismatch
   - backend runtime/server failure
   - missing backend work blocking FE
   - stale board status
2. Reproduce with the smallest safe API/browser probe. Capture status code, endpoint, payload shape, and expected contract without exposing secrets.
3. Compare against frontend API adapters/types and `docs/README.md` API notes.
4. If backend source is available, inspect the relevant Django/DRF code read-only.
5. If a backend task is needed, create or update an `area=back` board task with:
   - exact endpoint/model/field
   - observed vs expected behavior
   - frontend dependency
   - validation probe
   - Done gate
6. If backend work is verified fixed, state the evidence and route unblocked FE work to `$metravel-feature-builder`.

## Backend Acceptance And Status

- Verify only the backend-owned surface that is relevant and accessible:
  `origin/master` source, exact API/HTTP behavior, production runtime, and
  database/log/queue/ops observations when access exists.
- Never require Android or iPhone testing to accept an `area=back` task. Client
  rendering, device auth, deep links, and other device behavior belong to a
  linked `area=front` task.
- Move or return a backend task to `todo` only when concrete backend
  implementation, refinement, deploy/configuration, data, or other owner work
  remains. Name that action in the evidence note.
- Keep a completed backend task in `testing` when it waits for an executable
  in-scope time window, retention period, or observation interval. Record the
  parameter, threshold, current value, earliest valid recheck/trigger, and exact
  probe instead of inventing implementation work.
- Mark a backend task `done` when owner work is complete and all available,
  relevant mandatory backend probes pass. Irrelevant, unavailable, or
  client/device evidence outside backend ownership does not block Done.
- A started acceptance pass cannot end with generic `testing` or "could not
  verify". Pass → `done`; unfinished backend-owned work → `todo`/`in_progress`;
  a separate confirmed defect → Problem Memory plus a new/reused linked task.
  Missing required access pauses the status decision for a concrete unblock
  request and then resumes the same pass.

## Output

Return:

- diagnosis category
- endpoint and evidence
- likely backend owner files or frontend files
- board task/status action taken or needed
- FE unblock notes
- blockers or missing access
