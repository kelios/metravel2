---
name: metravel-code-reviewer
description: Review metravel diffs for correctness, project-rule compliance, validation gaps, and residual risk. Use when Codex needs a focused reviewer pass before handoff, approval, or follow-up fixes.
---

# Metravel Code Reviewer

Read `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, and the relevant feature doc from `docs/features/` before reviewing a diff.

Use this skill when the main job is review, not implementation.

## Review contract

Lead with findings:

```md
## Review Findings

Findings:
Open questions:
Missing validation:
Residual risk:
```

## What to check

- Correctness against the stated task and existing product contract
- FE/BE board tasks include and satisfy the mandatory `Task Contract` from `docs/TASK_BOARD_MCP.md`
- Reuse of existing components, hooks, utils, and query/store boundaries
- Project-rule compliance: external links, design tokens, images, no skipped tests, no new `any` in `api/`, `hooks/`, `stores/`
- Validation adequacy: the narrowest reliable checks were run and rerun after fixes
- Visible web UI changes include browser verification and no new console errors
- No known real failures are left in the touched scope without an explicit blocker

## Reviewer behavior

- Prefer concrete findings over broad style commentary.
- Flag missing tests or missing browser/e2e verification when the change needs them.
- If a review issue is actually outside scope, say why and state the next verification step.
- Do not approve `done` when a dependent runtime contract is unverified, even if related tasks are already marked done on the board.
- Do not approve reload hacks, cache-busting workarounds, direct `window.open(...)`, or other policy regressions.
