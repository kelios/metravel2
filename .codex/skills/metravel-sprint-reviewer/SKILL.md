---
name: metravel-sprint-reviewer
description: Accept or reject metravel task-board tickets in an active sprint using real Done-gate evidence. Use when Codex is asked to review/close sprint tickets, move tasks from review/testing to done, verify Task Contracts, run acceptance checks, or decide what can safely ship from the MCP task board.
---

# Metravel Sprint Reviewer

Use this skill for board acceptance, not implementation. Code fixes go back to the owning implementation skill.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/TASK_BOARD_MCP.md`
- relevant feature docs and the ticket's Task Contract.

## Board Rules

- Use the shared MCP task board tools only.
- If board endpoints return `HTTP 401`, refresh the staff token through `.env.e2e` using `docs/TASK_BOARD_MCP.md`; never print the token.
- Review only the requested ticket or active sprint scope.
- Do not create new feature code while acting as reviewer.
- Do not move a task to `done` without real evidence for its Done gate. A live shared gate may satisfy only the remaining automated-test step as `validation delegated: active gate pid/name` when its scope covers the task; it is not `passed` and cannot replace deploy/browser/API/device evidence.

## Acceptance Loop

1. Load the active sprint or requested task.
2. For each candidate in `review` or `testing`, read the full description, dependencies, blockers, and Task Contract.
3. Reject refinement gaps before runtime work:
   - missing `Scope`, `User-visible result`, `Data/API contract`, `Platform impact`,
     `Localization impact`, `Dependencies`, `Fallback/mock policy`, `Validation`, or `Done gate`
   - unresolved blocking dependency
   - `needs_human=true` without the human step completed
4. Run or inspect the exact validation required by the Done gate:
   - targeted tests or governance checks
   - browser/API probes against the target environment
   - device/mobile evidence when the contract requires it
   - `npm run test:i18n` and affected RU/BE/UK/PL/EN evidence when localization is impacted
   - when the required automated gate is already owned by another live session, apply the delegated-validation contract from `AGENTS.md`: accept only if it covers the task and no non-test Done-gate step remains; otherwise reject with `validation skipped`
5. Append evidence to the task description without erasing prior history.
6. Move passing tasks, and tasks whose sole remaining automated gate is validly delegated, to `done`. Move failing or incompletely covered tasks back to `review` or `blocked_by` with a concise blocker. The active gate owner must reopen a delegated task or record a blocker if it cannot fix a discovered failure.

## Output

Return a compact `Sprint Review`:

- tasks accepted with evidence
- tasks rejected with blockers
- checks/probes run
- tasks that need human or backend follow-up
- any board/token/access blocker
