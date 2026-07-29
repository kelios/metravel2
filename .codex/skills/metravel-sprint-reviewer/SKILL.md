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
     `Localization impact`, `Dependencies`, `Fallback/mock policy`, `Validation`,
     `Regression control`, or `Done gate`
   - `Regression control` empty or `none` on a `kind=bug` or consolidation task
   - unresolved blocking dependency
   - `needs_human=true` without the human step completed
4. Run or inspect the exact validation required by the Done gate. Reject evidence that
   violates `docs/TASK_BOARD_MCP.md` → `#### Качество evidence`:
   - a `200`/no-crash result offered for a task about size, count, duration or order,
     with no before/after number
   - no negative probe where an unsupported input exists: it must be observably
     distinguishable from a valid one, never a silent heavy/generic fallback
   - a build-time or deploy-time check offered for a user/crawler-visible production
     surface instead of a recurring production probe
   - `production-backed preview`, local production build, production API behind a
     local bundle, or deploy logs offered as evidence that the live production URL
     is fixed
   - a production optimization without the same before/after URL, viewport/browser/DPR,
     auth/cache state, request/API count, bytes, response codes, and relevant
     scroll/lazy-loading probe
   - a page-level performance task whose evidence proves one component or URL but
     does not remeasure the whole page budget and adjacent consumers touched by
     shared media/source/pagination code
   - a test that mocks the very primitive under investigation offered as contract evidence
   - a consolidation closed without naming the CI guard that fails when the new single
     contract is bypassed
   - targeted tests or governance checks
   - browser/API probes against the target environment
   - device/mobile evidence when the contract requires it
   - `npm run test:i18n` and affected RU/BE/UK/PL/EN evidence when localization is impacted
   - when the required automated gate is already owned by another live session, apply the delegated-validation contract from `AGENTS.md`: accept only if it covers the task and no non-test Done-gate step remains; otherwise reject with `validation skipped`
5. Append evidence to the task description without erasing prior history.
6. Move passing tasks, and tasks whose sole remaining automated gate is validly delegated, to
   `done`. Keep tasks with missing validation evidence in `review` or `testing`. If validation
   finds a defect that requires implementation changes, return the task to `in_progress` with the
   evidence. Use `blocked_by` only when a newly discovered hard dependency makes it impossible to
   start or continue the remaining work; waiting for review, tests, production/API/device checks,
   or an incomplete Done gate is never such a blocker. The active gate owner must reopen a
   delegated task or record a blocker if it cannot fix a discovered failure.

For a production incident, no deploy authorization is not a reason to lower the
Done gate: accept the implementation into `review`/`testing` with `local fix
ready; production verification pending`, but do not move it to `done` and do not
describe production as fixed until the live target is remeasured.

## Output

Return a compact `Sprint Review`:

- tasks accepted with evidence
- tasks rejected with blockers
- checks/probes run
- tasks that need human or backend follow-up
- any board/token/access blocker
