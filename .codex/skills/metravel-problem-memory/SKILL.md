---
name: metravel-problem-memory
description: Audit MeTravel problem history before creating, reopening, splitting, or accepting a task. Use for new bug/debt/incident tickets, suspected regressions, repeated symptoms, duplicate checks, recurring frontend/backend/ops failures, backlog refinement, and root-cause follow-up. It searches the canonical problem registry and the full task board, then returns reuse, reopen, create-linked, or create-new; it does not replace the ticket-board operator.
---

# Metravel Problem Memory

Prevent repeated symptom fixes and duplicate board cards. Treat
`docs/PROBLEM_MEMORY.md` as the durable problem-family registry and the MCP task
board as the operational task/evidence history.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/PROBLEM_MEMORY.md`
- `docs/TASK_BOARD_MCP.md`
- `$metravel-ticket-board` and `$metravel-task-contract` for any board mutation

## Pre-create workflow

1. Describe the candidate with six facts: symptom, invariant violated, affected
   surface, owning layer, endpoint/files, and target environment.
2. Search `docs/PROBLEM_MEMORY.md` by problem key, aliases, endpoint, file, and
   prior board ids.
3. Search the task board across every status, including `done` and `wont_do`.
   Fetch full descriptions for plausible matches; title-only matching is not
   sufficient. Do not trust `search` or `limit` unless the response proves they
   were applied; the current API may require a full-list plus detail reads.
4. Compare root cause and invariant, not only wording:
   - `reuse`: the same work is already open; append evidence to that task;
   - `reopen`: the same confirmed root cause or previously accepted invariant
     failed again; move the canonical task back to `in_progress` and append a
     dated Recurrence Log entry;
   - `create-linked`: the symptom family matches but the confirmed root cause or
     corrective owner differs; create one task related to the canonical chain;
   - `create-new`: no material historical match exists.
5. Route mutations through `$metravel-ticket-board`. Never create a competing
   card while the canonical one is in `todo`, `in_progress`, `review`,
   `testing`, or `blocked_by`.
6. Update the registry only for a confirmed new family, changed root cause,
   recurrence, or new permanent control. Do not copy ordinary progress logs into
   docs.

## Recurrence evidence

When reopening or creating a linked recurrence, append this to the canonical
task description:

```md
## Recurrence Log — YYYY-MM-DD

Problem key:
Prior task/evidence:
Observed invariant failure:
Same or different root cause:
Why the previous Done gate did not prevent recurrence:
Corrective layer:
New regression control:
```

Do not claim an exact reopen count unless the board exposes immutable status
events. `created_at` and `updated_at` alone are not status history.

## Done-gate review

For a recurring family, require all of the following before `done`:

- the root cause is marked `confirmed`, or uncertainty and follow-up owner are
  explicit;
- the permanent invariant is tested at the layer where it failed;
- deploy/API/browser/device evidence covers the target named in the contract;
- the implementation commit is reachable from canonical `main`/`origin/main`
  when integration or publication is part of the task;
- workarounds have an owner and removal condition;
- the registry records the canonical task chain and new control.

## Output

Return this before any create/update:

```md
## Problem Memory Verdict

Candidate:
Problem key:
Historical matches:
Root-cause comparison:
Decision: reuse | reopen | create-linked | create-new
Canonical task:
Required links:
Registry update:
```

Keep platform and localization impact explicit. Backend remains read-only from
this workspace; backend fixes are `area=back` tasks with runtime evidence.
