---
name: metravel-ticket-board
description: Operate the shared metravel MCP task board: list, create, update, sync, and audit tasks/sprints. Use when the user asks to create a ticket, show the board, update task status, import task drafts, split human/agent work, assign active sprint, or sync board evidence. Does not write feature code.
---

# Metravel Ticket Board

Use this skill for task-board operations through the MCP task board tools.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/TASK_BOARD_MCP.md`
- `$metravel-task-contract` guidance for FE/BE tasks.

## Scope

- `metravel_task_board`, `metravel_tasks_list`, `metravel_task_get`, `metravel_task_create`, `metravel_task_update`, `metravel_task_delete`
- `metravel_sprints_list`, `metravel_sprint_get`, `metravel_sprint_create`, `metravel_sprint_update`
- Task Contract creation/review, active sprint assignment, dependency/blocker links, evidence updates

## Rules

- Board is the source of truth for frontend and backend work.
- Use only `area=front` or `area=back` in the active workflow. Android/iOS/native app bugs are frontend tasks (`area=front`) with platform context in the title/description; backend/API/server tasks are `area=back`.
- Every new `area=front` or `area=back` task needs active sprint, Task Contract, dependencies/blockers, validation, and Done gate.
- Human work and agent work must be separate tasks linked by `blocked_by_id`, `depends_on_ids`, or `related_to_ids`.
- If board tools return HTTP 401, refresh the staff token through `.env.e2e` following `docs/TASK_BOARD_MCP.md`; never print token values.
- Do not write feature code.
- Do not move work to `done` unless acting as `$metravel-sprint-reviewer` with runtime evidence.

## Workflow

1. Read the existing sprint/task state before mutating.
2. For new tasks, fill Task Contract before `todo`/handoff.
3. For status updates, preserve existing description and append concise evidence/blocker notes.
4. For human-needed work, set `needs_human=true` and keep the body human-readable without agent mechanics.
5. Verify the updated task or board after mutation.

## Output

Return a compact `Board Update` with changed task/sprint ids, status, dependencies, and blockers.
