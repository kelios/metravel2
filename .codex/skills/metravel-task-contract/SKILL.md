---
name: metravel-task-contract
description: Define or review mandatory Task Contract blocks for metravel frontend/backend board tasks before creation, status changes, review, or Done handoff. Use when adding FE/BE tasks, linking FE work to BE dependencies, or checking whether a task can move to Done.
---

# Metravel Task Contract

Use this skill whenever a task is created or reviewed on the shared task board.

Board-first rule:

- Create all new FE/BE/backend tasks on the shared MCP task board through `ticket-board`; do not create local `tasks/*.md` files as the normal workflow.
- Every board task must include `area`, active sprint, owner/status when known, dependencies, blockers, Task Contract, validation, and Done gate.
- If the task-board MCP or API returns `HTTP 401`, refresh the staff token through `.env.e2e` using `docs/TASK_BOARD_MCP.md`, update `.secrets/metravel-task-board.env` without printing secrets, and retry before creating any local fallback.
- If the task-board MCP is unavailable after token refresh, prepare a ready-to-paste board task with the same contract fields and mark any local `tasks/*.md` draft as temporary fallback only. Sync/import it to the board before handoff and remove the local draft when possible.

Read first:

- `docs/TASK_BOARD_MCP.md`
- `docs/CODEX.md`
- Relevant feature docs from `docs/features/` only when needed.

## Required Contract

Every `area=front` or `area=back` board task must include:

```md
## Task Contract

Scope:
User-visible result:
Data/API contract:
Dependencies:
Fallback/mock policy:
Validation:
Done gate:
```

## Rules

- Do not create a FE/BE task without the contract block.
- Architect-level detail is mandatory: concrete request/response shapes (fields + types), real board ids for dependencies, concrete validation commands/URLs. Placeholder or empty fields mean the task is not ready — send it back to `$metravel-system-architect` or ask one clarifying question.
- Do not move a task to `todo` for implementation until the contract has concrete, testable acceptance.
- Do not move a task to `done` unless the `Done gate` evidence exists.
- For BE tasks that unblock FE, require deploy-target API evidence for the exact endpoints/fields/events.
- For FE tasks depending on BE, require browser/API evidence against the same target; unit tests and mock fallback alone are not enough.
- If board status says BE is done but runtime contract probes fail, keep FE in `review` or `blocked_by`, add evidence, and create or reopen a BE/deploy blocker.
- Keep secrets out of contract text and logs.

## Output

Return a compact contract or review verdict:

```md
Task:
Contract status: complete | incomplete
Missing fields:
Blocking dependency:
Required validation:
Can move to Done: yes | no
```
