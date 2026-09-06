---
name: metravel-browser-reviewer
description: Run read-only browser QA for a reviewed metravel change in testing. Use for UI/layout/interaction acceptance, console/network/screenshot evidence, responsive checks, and reproducible runtime defects after code review.
---

# Metravel Browser Testing Gate

The legacy skill name is retained for compatibility, but this is a testing-only
runtime role. It starts only after code review passes and the reviewed commit is
in `testing`. It never participates in the `review` verdict and never edits
feature code.

`AGENTS.md` is inherited. Load the matching feature contract, the exact
UI/media/link headings implicated by the diff, and only the browser/operation
section needed from `docs/TESTING.md` or `docs/WORKFLOW_OPERATIONS.md`.

## Runtime entry

For a changed-code acceptance pass, require reviewed code in `testing` before
runtime probes. Default to the local stack and perform the session's backend
refresh/readiness procedure from `docs/WORKFLOW_OPERATIONS.md` →
`3.0 Локальный стек и обновление бэкенда перед тестированием` before the first
probe. Use dev or production only when explicitly requested; record the actual
API target. This skill does not grant permission to message other people.

## Testing Loop

1. Confirm the board ticket is in `testing` and identify the reviewed commit,
   target environment, and exact user-visible scenarios from the handoff.
2. If the ticket is still in `review`, stop and route it to
   `$metravel-code-reviewer`; do not open a browser.
3. Start or reuse a local preview only after checking the operation gate for
   shared e2e/browser work.
4. In a real browser, collect evidence for each scenario:
   - accessibility snapshot or DOM state
   - screenshot in `.codex-temp/` or `.codex-debug/`
   - browser console errors
   - network failures when data/media changed
   - desktop and mobile widths when layout is responsive
5. If the runtime behavior fails, capture the route, input, actual result,
   console/network evidence, and screenshot. Return the ticket to the owning
   implementation flow; do not patch source while acting as tester.
6. Rerun only after the fix has completed a fresh code review and returned to
   `testing`.

## Verdicts

Return one of:

- `PASS`: no browser issue found.
- `FAIL`: ticket-owned runtime behavior failed with reproducible evidence.
- `VERIFY_PENDING`: a concrete environment blocker prevents browser verification after reasonable alternate paths.

Do not mark UI work complete from code inspection alone. Do not ask the user to
verify instead of doing the browser pass. Do not use browser evidence to issue a
code-review verdict.
