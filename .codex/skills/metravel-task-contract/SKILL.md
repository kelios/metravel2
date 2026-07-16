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

- `AGENTS.md`
- `docs/RULES.md`
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
Platform impact:
Localization impact:
Dependencies:
Fallback/mock policy:
Validation:
Done gate:
```

## Rules

- Do not create a FE/BE task without the contract block.
- Architect-level detail is mandatory: concrete request/response shapes (fields +
  types), desktop-web/mobile-web/Android impact, RU/BE/UK/PL/EN impact, real
  board ids for dependencies, and concrete validation commands/URLs. Placeholder
  or empty fields mean the task is not ready — send it back to
  `$metravel-system-architect` or ask one clarifying question.
- `Platform impact` must name
  `desktop web | mobile web | Android | shared | none` and the required
  browser/device evidence. Any mobile-web or Android impact requires paired
  evidence for both. `Localization impact` must name affected
  locales or `none`; localization work includes namespaces/keys and `npm run test:i18n`.
- Do not move a task to `todo` for implementation until the contract has concrete, testable acceptance.
- `blocked_by` is valid only while a concrete hard dependency prevents implementation from
  starting or continuing. Missing review/QA/runtime/production evidence belongs in `review` or
  `testing`, not `blocked_by`; a failed check requiring changes returns the task to `in_progress`.
- Do not move a task to `done` unless the `Done gate` evidence exists. If automated tests are the only remaining step and an active shared gate covers them, `validation delegated: active gate pid/name` is acceptable coordination evidence for Done without being reported as `passed`; deploy/browser/API/device evidence cannot be delegated to a test gate.
- For BE tasks that unblock FE, require deploy-target API evidence for the exact endpoints/fields/events.
- For backend/ops/server tasks, require a tracked-vs-untracked path
  classification. The contract must state that this frontend workspace will not
  edit or run Git mutations in the backend checkout; canonical tracked changes
  belong to the backend owner, and the Done gate must include a clean production
  `git status --short` plus runtime validation after the normal deploy.
- For FE tasks depending on BE, require browser/API evidence against the same target; unit tests and mock fallback alone are not enough.
- If board status says BE is done but runtime contract probes fail after FE implementation is
  complete, keep FE in `testing`, add evidence, and create or reopen a separate BE/deploy task.
  Use `blocked_by` only when the missing contract prevents remaining FE implementation work from
  starting or continuing.
- Keep secrets out of contract text and logs.
- For visible UI/UX work, add `Design evidence` next to the contract: a tracked `docs/` mock path or stable Figma URL, the normative states/platforms, parity expectations, and runtime comparison in `Validation`/`Done gate`. Do not use `.codex-temp/` as a board attachment.

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
