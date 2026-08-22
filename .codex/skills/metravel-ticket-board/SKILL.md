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
- Use only `area=front` or `area=back` in the active workflow. Android app bugs
  use `area=front` + `[AND-...]`; iOS app bugs use `area=front` + `[IOS-...]`;
  shared responsive UI tasks name desktop-web and mobile-web validation, while
  Android/iOS validation is added only for platform-specific observable scope.
  Backend/API/server tasks are `area=back`.
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
- `needs_human=true` и `Task Contract` взаимоисключающи. Флаг ставится только на карточку,
  которая целиком является ручным действием человека (апрув владельца, CAPTCHA, секрет, чужой
  кабинет, публикация в сторе), и такая карточка пишется по
  `.claude/skills/metravel-issue/human-task.md` без контракта. Реализация backend-задачи
  владельцем бэкенда — не `needs_human`: владельца кодирует `area=back`, а лишний флаг вынимает
  карточку из приёмки.
- Имя поля контракта — идентификатор: `Scope:` с начала строки. `**Scope.**` или `- Scope:`
  равносильны отсутствию поля, потому что гейты и приёмка ищут строку `Имя:`.
- Контракт описания проверяется машиной: `scripts/lib/boardTaskContract.mjs` плюс PreToolUse-хук
  `.claude/hooks/task-quality-gate.mjs`. Черновик — `node .claude/hooks/task-quality-gate.mjs
  check --file <файл.md>`, борд целиком — `npm run board:audit`.
- If board tools return HTTP 401, refresh the staff token through `.env.e2e` following `docs/TASK_BOARD_MCP.md`; never print token values.
- Do not write feature code.
- Move work to `done` only through an acceptance pass: normally
  `$metravel-sprint-reviewer`, or the equivalent explicit backend-acceptance
  path using relevant available backend evidence and the same status contract.

## Status Semantics

Use the canonical status map from `docs/TASK_BOARD_MCP.md`:

- `todo`: implementation, refinement, deploy/configuration, data, or other owner
  work remains; it may be not started or returned with a concrete action.
- `in_progress`: implementation/fix work is active.
- `review`: implementation is complete and awaits code/architecture/security review.
- `testing`: implementation/review is ready and QA is active, or an exact
  in-scope retest/time-window gate is recorded with parameter, threshold,
  current value, trigger/earliest recheck, and command/scenario.
- `done`: implementation/owner work is complete and all available, relevant
  mandatory probes for the task's owned scope are green.
- `blocked_by`: implementation cannot start or continue because a concrete hard dependency or
  external gate is unresolved. Record `blocked_by_id` when a board task is the blocker and state
  the exact unblock event.

Never use `blocked_by` merely because review/testing has not happened, production
evidence is pending, a Done gate is incomplete, or validation failed. Missing
access/device/gate output is not a parking verdict: request the exact unblock
action and resume acceptance. After a completed pass use `done`; return
unfinished ticket-owned work to `todo`/`in_progress`; route a separate confirmed
defect through Problem Memory to a new/reused linked task.

For `area=back`, do not return a completed implementation to `todo` because a
time-based observation is still accumulating or client/device evidence is
unavailable. Keep an executable time gate in `testing` only with the full retest
record; close when the relevant backend probes are green. Use `todo` only when
backend implementation/refinement/deploy/configuration/data work still remains.
Unavailable required access pauses the board mutation for an unblock request.

## Workflow

1. Run `$metravel-problem-memory` and read the existing sprint/task state before
   mutating.
2. For new tasks, persist the Problem History verdict and fill Task Contract,
   including explicit affected-platform and RU/BE/UK/PL/EN impact, the correct
   desktop/mobile-web validation for shared responsive UI, target-specific
   Android/iOS validation only when owned, plus any required UI `Design evidence`, before
   `todo`/handoff.
3. For status updates, preserve existing description and append concise evidence/blocker notes.
   Before setting `blocked_by`, name the work that cannot proceed, the concrete dependency/gate,
   and the event that releases it.
4. For human-needed work, set `needs_human=true` and keep the body human-readable without agent mechanics.
5. Verify the updated task or board after mutation.

## Output

Return a compact `Board Update` with changed task/sprint ids, status, dependencies, and blockers.
