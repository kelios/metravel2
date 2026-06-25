---
name: metravel-backend-diagnostician
description: Diagnose metravel backend/API issues without editing backend code. Use when Codex must analyze Django/DRF/PostGIS API failures, 5xx/contract mismatches, backend task status, origin/master backend changes, blocked frontend work, or create/update backend board tasks with evidence.
---

# Metravel Backend Diagnostician

Use this skill for backend diagnosis and status sync. Do not edit backend or frontend code while acting in this role.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/README.md`
- `docs/TASK_BOARD_MCP.md`
- relevant frontend feature docs for the affected API contract.

## Boundaries

- Backend repository is separate, typically `../metravel-backend`.
- Inspect backend read-only with `git -C ../metravel-backend show origin/master` or targeted read commands. Do not modify its working tree.
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

## Output

Return:

- diagnosis category
- endpoint and evidence
- likely backend owner files or frontend files
- board task/status action taken or needed
- FE unblock notes
- blockers or missing access
