---
name: metravel-task-contract
description: Define or review mandatory Task Contract blocks for metravel frontend/backend board tasks before creation, status changes, review, or Done handoff. Use when adding FE/BE tasks, linking FE work to BE dependencies, or checking whether a task can move to Done.
---

# Metravel Task Contract

Use this skill whenever a task is created or reviewed on the shared task board.

Board-first rule:

- Create all new FE/BE/backend tasks on the shared MCP task board through `ticket-board`; do not create local `tasks/*.md` files as the normal workflow.
- Every board task must include `area`, active sprint, owner/status when known,
  dependencies, blockers, Problem History, Task Contract, validation, and Done
  gate.
- If the task-board MCP or API returns `HTTP 401`, refresh the staff token through `.env.e2e` using `docs/TASK_BOARD_MCP.md`, update `.secrets/metravel-task-board.env` without printing secrets, and retry before creating any local fallback.
- If the task-board MCP is unavailable after token refresh, prepare a ready-to-paste board task with the same contract fields and mark any local `tasks/*.md` draft as temporary fallback only. Sync/import it to the board before handoff and remove the local draft when possible.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/TASK_BOARD_MCP.md`
- `docs/PROBLEM_MEMORY.md`
- `docs/CODEX.md`
- Relevant feature docs from `docs/features/` only when needed.

## Required Contract

Every `area=front` or `area=back` board task must include, in this order:

```md
## Простыми словами

Что сейчас:
Как должно быть:
Кого задевает:

## В чём проблема

## Из-за чего возникла

## Что должно быть сделано

## Что уже сделано

## Что блокирует

## Как протестировать

## Problem History

Problem key:
Historical matches:
Verdict: reuse | reopen | create-linked | create-new
Canonical task:
Root-cause delta:

## Task Contract

Scope:
User-visible result:
Data/API contract:
Platform impact:
Localization impact:
Dependencies:
Fallback/mock policy:
Validation:
Regression control:
Done gate:
```

## Rules

- Do not create a FE/BE task without the contract block.
- `needs_human=true` и `Task Contract` взаимоисключающи: флаг маркирует карточку, которая целиком
  является ручным действием человека, и такая карточка пишется по
  `.claude/skills/metravel-issue/human-task.md` без контракта. Реализация backend-задачи владельцем
  бэкенда — не `needs_human` (владельца кодирует `area=back`); ручной шаг внутри инженерной задачи
  выносится отдельной связанной карточкой.
- Имя поля — идентификатор: строго `Scope:` с начала строки. `**Scope.**`, `- Scope:` и
  `__Scope__:` равносильны отсутствию поля — по этим строкам ходят гейты, приёмка и
  governance-тесты. `none` законно для `Localization impact`, `Platform impact` (с обоснованием)
  и `Regression control` (контент, разовые операции, исследования); прочерк и `TBD` — нет.
- Проверяй контракт машиной, а не памятью: `node .claude/hooks/task-quality-gate.mjs check --file
  <черновик.md>` до отправки, `npm run board:audit` для борда целиком. PreToolUse-хук
  `.claude/hooks/task-quality-gate.mjs` блокирует create и перевод в `todo` при нарушении.
- Write the whole description in Russian, in plain language, and in the seven mandatory
  sections above, in that exact order: plain-language lead, the observed problem in detail,
  the root cause (write «не установлена» rather than guessing), the numbered plan plus what
  is out of scope, the dated progress log, the blocker (must match `blocked_by`/`depends_on`),
  and a hands-on test walkthrough for a human (`Validation` keeps the exact gate commands —
  they are not the same thing). Never delete a section: if there is nothing to say, say why. Keep contract headings (`## Problem History`,
  `## Task Contract`), field names, paths, commands, URLs and board statuses
  untranslated — they are identifiers used by gates and acceptance. English prose
  paragraphs, loan-phrases («tracked-config classification», «paired evidence») and a
  description that opens with the technical analysis are rejected exactly like an empty
  contract. Full rule: `docs/TASK_BOARD_MCP.md` → «Правило: описание задачи — по-русски
  и человеческим языком».
- Do not create, reopen, or split a task without a Problem Memory Verdict. A
  recurring family must name its problem key, canonical prior task and decision
  (`reuse | reopen | create-linked | create-new`); reuse/reopen is preferred over
  a competing card.
- Architect-level detail is mandatory: concrete request/response shapes (fields +
  types), affected-platform impact, RU/BE/UK/PL/EN impact, real
  board ids for dependencies, and concrete validation commands/URLs. Placeholder
  or empty fields mean the task is not ready — send it back to
  `$metravel-system-architect` or ask one clarifying question.
- `Platform impact` must name
  `desktop web | mobile web | Android | iOS | shared | none` and the required
  evidence. Common/shared responsive UI requires desktop-web and mobile-web
  browser evidence. Add Android device evidence only for Android-specific
  observable behavior/configuration/runtime, and iPhone evidence only for
  iOS-specific scope at the appropriate simulator, physical-device, or
  TestFlight layer. Mobile parity remains a product invariant, not an automatic
  all-device Done gate. `Localization impact` must name affected
  locales or `none`; localization work includes namespaces/keys and `npm run test:i18n`.
- Do not move a task to `todo` for implementation until the contract has concrete, testable acceptance.
- `blocked_by` is valid only while a concrete hard dependency prevents implementation from
  starting or continuing. Missing access/QA/runtime/production evidence is not
  a final status: request the exact unblock action and resume acceptance. Keep
  `testing` only for active QA or a fully specified retest/temporal gate; failed
  checks route unfinished owned work to `todo`/`in_progress`, or a separate
  confirmed defect to a new/reused linked task after Problem Memory.
- Do not move a task to `done` unless the `Done gate` evidence exists. An active
  shared gate gives `validation delegated: active gate pid/name` coordination
  evidence only; request its result and resume instead of closing from
  delegation alone.
- For BE tasks that unblock FE, require deploy-target API evidence for the exact endpoints/fields/events.
- Backend Done gates contain only relevant evidence available to backend
  ownership: read-only source inspection and exact API/production/runtime probes.
  Android/iPhone/client evidence belongs to linked `area=front` tasks and must
  not block an `area=back` ticket.
- For `area=back`, use `todo` only while backend implementation, refinement,
  deploy/configuration, data, or other owner work remains. Use `testing` only
  while QA is active or completed work awaits an exact in-scope retest/time
  observation with parameter, threshold, current value, trigger/earliest
  recheck, and command/scenario.
  Use `done` when backend work is complete and all available relevant mandatory
  probes are green; irrelevant or unavailable out-of-scope evidence does not
  block acceptance.
- For backend/ops/server tasks, require a tracked-vs-untracked path
  classification only when the task touches a server checkout/deploy/ops path. The contract must state that this frontend workspace will not
  edit or run Git mutations in the backend checkout; canonical tracked changes
  belong to the backend owner. For tasks that actually mutate/deploy that
  checkout, the Done gate must include a production
  `git status --short` with no entries outside the exact frontend-deploy
  exceptions in `docs/RULES.md`, plus runtime validation after the normal deploy.
- For FE tasks depending on BE, require browser/API evidence against the same target; unit tests and mock fallback alone are not enough.
- If board status says BE is done but runtime contract probes fail after FE implementation is
  complete, run Problem Memory and create/reuse a separate BE/deploy task. Close
  accepted complete FE work instead of parking it in `testing`; return FE to
  `todo`/`in_progress` only if its own promised implementation is incomplete.
  Use `blocked_by` only when the missing contract prevents remaining FE
  implementation work from starting or continuing.
- Keep secrets out of contract text and logs.
- A recurring task's Done gate must cover why the prior control failed and name
  the new regression control; append the dated Recurrence Log from
  `docs/PROBLEM_MEMORY.md`.
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
