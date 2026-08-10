---
name: metravel-ticket-board
description: >-
  Operate the shared metravel MCP task board: list, create, update, sync, and audit tasks/sprints.
  Use when the user asks to create a ticket, show the board, update task status, import task drafts,
  split human/agent work, assign active sprint, or sync board evidence. Does not write feature code.
---

# Metravel Ticket Board

Use this skill for task-board operations through the MCP task board tools.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/TASK_BOARD_MCP.md`
- `docs/PROBLEM_MEMORY.md`
- `$metravel-problem-memory` before create, reopen, split, or recurrence update.
- `$metravel-task-contract` guidance for FE/BE tasks.

## Scope

- `metravel_task_board`, `metravel_tasks_list`, `metravel_task_get`, `metravel_task_create`, `metravel_task_update`, `metravel_task_delete`
- `metravel_sprints_list`, `metravel_sprint_get`, `metravel_sprint_create`, `metravel_sprint_update`
- Task Contract creation/review, active sprint assignment, dependency/blocker links, evidence updates

## Rules

- Board is the source of truth for frontend and backend work.
- Before creating/reopening/splitting, require a Problem Memory Verdict based on
  the registry plus every board status. Reuse open work; reopen the canonical
  task for the same confirmed cause; create a related task only for a different
  cause/owner. Append a dated Recurrence Log for repeated families.
- Use only `area=front` or `area=back` in the active workflow. Android/native app
  bugs are frontend tasks (`area=front`) with `[AND-...]` and paired mobile-web/
  Android context in the title/description; backend/API/server tasks are `area=back`.
- Every new `area=front` or `area=back` task needs active sprint, Problem History,
  Task Contract, `Platform impact`, `Localization impact`, dependencies/blockers,
  validation, and Done gate.
- Write every task description in Russian, in plain language, using the seven mandatory
  sections in order: `## Простыми словами` (что сейчас / как должно быть / кого задевает),
  `## В чём проблема`, `## Из-за чего возникла`, `## Что должно быть сделано`,
  `## Что уже сделано`, `## Что блокирует`, `## Как протестировать` — then Problem History
  and Task Contract. Never drop a section; when there is nothing to say, say why. The same
  applies to evidence notes appended later. Contract
  headings, field names, paths, commands, URLs and board statuses stay untranslated as
  identifiers. English prose paragraphs and loan-phrases («tracked-config classification»,
  «paired evidence») are refinement debt, exactly like an incomplete contract. Full rule:
  `docs/TASK_BOARD_MCP.md` → «Правило: описание задачи — по-русски и человеческим языком».
- Visible UI/UX tasks must reference durable `Design evidence` (tracked `docs/` mock or stable Figma URL) and name the required states/platforms. The current board API has no file-attachment field, so never reference a temporary `.codex-temp/` artifact as the task attachment.
- Human work and agent work must be separate tasks linked by `blocked_by_id`, `depends_on_ids`, or `related_to_ids`.
- If board tools return HTTP 401, refresh the staff token through `.env.e2e` following `docs/TASK_BOARD_MCP.md`; never print token values.
- Do not write feature code.
- Do not move work to `done` unless acting as `$metravel-sprint-reviewer` with runtime evidence.

## Status Semantics

Use the canonical status map from `docs/TASK_BOARD_MCP.md`:

- `todo`: ready to implement, not started.
- `in_progress`: implementation/fix work is active.
- `review`: implementation is complete and awaits code/architecture/security review.
- `testing`: implementation/review is ready and awaits or is undergoing automated, QA,
  browser, API, backend/deploy, production, device, or release validation.
- `blocked_by`: implementation cannot start or continue because a concrete hard dependency or
  external gate is unresolved. Record `blocked_by_id` when a board task is the blocker and state
  the exact unblock event.

Never use `blocked_by` merely because review/testing has not happened, production evidence is
pending, a Done gate is incomplete, or a validation failed. Keep evidence gaps in `review` or
`testing`; return failures that require code changes to `in_progress`.

## Workflow

1. Run `$metravel-problem-memory` and read the existing sprint/task state before
   mutating.
2. For new tasks, persist the Problem History verdict and fill Task Contract,
   including desktop-web/mobile-web/Android and RU/BE/UK/PL/EN impact, paired
   mobile-web/Android validation, plus any required UI `Design evidence`, before
   `todo`/handoff.
3. For status updates, preserve existing description and append concise evidence/blocker notes.
   Before setting `blocked_by`, name the work that cannot proceed, the concrete dependency/gate,
   and the event that releases it.
4. For human-needed work, set `needs_human=true` and keep the body human-readable without agent mechanics.
5. Verify the updated task or board after mutation.

## Output

Return a compact `Board Update` with changed task/sprint ids, status, dependencies, and blockers.
