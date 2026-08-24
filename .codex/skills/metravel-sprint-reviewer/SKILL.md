---
name: metravel-sprint-reviewer
description: Accept or reject metravel task-board tickets in an active sprint using real Done-gate evidence. Use when Codex is asked to review/close sprint tickets, move tasks from review/testing to done, verify Task Contracts, run acceptance checks, or decide what can safely ship from the MCP task board.
---

# Metravel Sprint Reviewer

Use this skill for board acceptance, not implementation. Code fixes go back to the owning implementation skill.

`AGENTS.md` is inherited. Read the ticket's Task Contract, the matching feature
contract, and only the acceptance/status/evidence headings from
`docs/TASK_BOARD_MCP.md` required by that gate.

## Board Rules

- Use the shared MCP task board tools only.
- If board endpoints return `HTTP 401`, refresh the staff token through `.env.e2e` using `docs/TASK_BOARD_MCP.md`; never print the token.
- Review only the requested ticket or active sprint scope.
- Review `area=back` tickets only when the user explicitly requests backend
  acceptance/status work. Otherwise skip them and report the skipped count.
- Do not create new feature code while acting as reviewer.
- Do not move a task to `done` without real evidence for its Done gate. A live shared gate records only `validation delegated: active gate pid/name`; it is not `passed`. Request its result and resume acceptance instead of closing or parking the task.

## Acceptance Loop

1. Load the active sprint or requested task.
2. For each candidate in `review` or `testing`—and any explicitly requested
   `todo` ticket whose prior acceptance decision is being re-audited—read the
   full description, dependencies, blockers, and Task Contract.
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
   - when the required automated gate is already owned by another live session, apply the coordination contract from `AGENTS.md`: do not duplicate it; request the result/unblock action and resume this acceptance pass
   Then collect every applicable positive check required by the contract:
   targeted tests or governance checks, browser/API probes against the target
   environment, `npm run test:i18n` plus affected locale evidence, and
   device/mobile evidence only when a frontend ticket owns Android- or
   iOS-specific observable behavior. Client/device evidence belongs to a linked
   frontend task, not to a backend Done gate.
5. Append evidence to the task description without erasing prior history.
6. Finish each started acceptance with a decision. Passing task → `done`.
   Unfinished work promised by the current ticket → `todo`, or `in_progress`
   only when that work actually starts. A separate confirmed defect → run
   `$metravel-problem-memory`, create/reuse a linked task, and do not park the
   accepted ticket. Keep `testing` only for an exact repeated measurement or
   temporal gate with parameter, threshold, current value, trigger/earliest
   recheck, and command/scenario. Missing access/device/gate result stops the
   turn for an unblock request; it is not a board verdict. Use `blocked_by` only
   when a hard dependency prevents implementation from starting or continuing.

## Backend Acceptance

For an explicitly requested `area=back` review, accept only the evidence that is
both relevant to the backend task and available to this workspace: read-only
`origin/master` source inspection, exact API/HTTP probes, production/runtime
status, database/log/queue observations when access exists, and negative or
authorization probes where the contract requires them.

- Do not require Android or iPhone evidence for a backend ticket. A client flow
  that consumes the API is verified in its linked `area=front` task.
- `todo` means backend implementation, refinement, deploy, configuration, data,
  or other owner work still remains. Return a failed backend ticket to `todo`
  with the exact observed defect and required owner action.
- Keep a completed backend ticket in `testing` when a concrete, executable
  in-scope time window or observation period has not elapsed yet. Record the
  parameter, threshold, current measured value, earliest recheck/trigger, and
  exact probe; do not return it to `todo` when there is nothing to implement or
  operate.
- Move the ticket to `done` when backend work is complete and all available,
  relevant mandatory source/API/production probes are green. Irrelevant,
  unavailable, or client/device evidence outside backend ownership does not
  block acceptance and must not create a synthetic `todo` item.

For a production incident, no deploy authorization is not a reason to lower the
Done gate. If the live probe is mandatory, request exact deploy authorization
and stop the acceptance decision until it is granted; resume with the real
remeasurement. Do not describe production as fixed, close, or park the task from
`local fix ready` alone.

## Output

Return a compact `Sprint Review`:

- tasks accepted with evidence
- tasks rejected with blockers
- checks/probes run
- tasks that need human or backend follow-up
- any board/token/access blocker
