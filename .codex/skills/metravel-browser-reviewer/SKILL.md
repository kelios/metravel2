---
name: metravel-browser-reviewer
description: Run read-only browser QA for a reviewed metravel change in testing. Use for UI/layout/interaction acceptance, console/network/screenshot evidence, responsive checks, and reproducible runtime defects after code review.
---

# Metravel Browser Testing Gate

The legacy skill name is retained for compatibility, but this is a testing-only
runtime role. It starts only after code review passes and the reviewed commit is
in `testing`. It never participates in the `review` verdict and never edits
feature code.

`AGENTS.md` is inherited. Apply `docs/TESTING.md` → `Validation selection gate`
before browser readiness or dispatching another platform. Qualify inherited
checks against the whole still-unaccepted task change and compatible evidence,
then load only the matching feature and browser/operation headings.

## Runtime entry

For a changed-code acceptance pass, require reviewed code in `testing` before
runtime probes. Use the gate-qualified target and inherited acceptance pipeline;
record the actual API target. Refresh the local backend only for a local runtime
probe, using WORKFLOW_OPERATIONS §3.0. Dev remains an explicit owner choice.
This skill does not grant permission to message other people.

## Testing Loop

1. Confirm the board ticket is in `testing` and identify the reviewed commit,
   target environment, and exact user-visible scenarios from the handoff.
   Confirm the selection record before preview preparation; refine an excessive
   old matrix with the reason, preserving current explicit user QA/release scope.
2. If the ticket is still in `review`, stop and route it to
   `$metravel-code-reviewer`; do not open a browser.
3. Start or reuse a local preview only after checking the operation gate for
   shared e2e/browser work.
4. In a real browser, collect evidence for each scenario:
   - accessibility snapshot or DOM state
   - screenshot in `.codex-temp/` or `.codex-debug/`
   - browser console errors
   - network failures when data/media changed
   - mobile web first, then desktop only when responsive/visual behavior changed
5. If the runtime behavior fails, capture the route, input, actual result,
   console/network evidence, and screenshot. Return the ticket to the owning
   implementation flow; do not patch source while acting as tester.
6. Product fixes require fresh code review and a return to `testing` before the
   affected retest. An environment-only retry needs a confirmed changed
   precondition and the bounded retry policy, not another platform or a full sweep.

## Verdicts

Return one of:

- `PASS`: no browser issue found.
- `FAIL`: ticket-owned runtime behavior failed with reproducible evidence.
- `VERIFY_PENDING`: a concrete environment blocker prevents browser verification after reasonable alternate paths.

Do not mark UI work complete from code inspection alone. Do not ask the user to
verify instead of doing the browser pass. Do not use browser evidence to issue a
code-review verdict.
