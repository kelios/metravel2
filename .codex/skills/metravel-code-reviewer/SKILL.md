---
name: metravel-code-reviewer
description: Review and repair metravel code diffs for correctness, unnecessary complexity, duplication, poor reuse, inefficient logic, project-rule compliance, validation gaps, and residual risk. Use after every code-changing task before handoff, or when Codex is asked to review, simplify, optimize, clean up, or improve an implementation. Fix confirmed issues in the task-owned frontend/app/docs scope by default, then re-review and revalidate; stay read-only only when the user explicitly requests a no-change audit.
---

# Metravel Code Reviewer and Fixer

Read `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, and the relevant feature doc from `docs/features/` before reviewing a diff.

Run this skill as the final engineering pass after every task that changes code.
The default mode is `review-and-fix`. Use `read-only` mode only when the user
explicitly forbids edits.

When agent delegation is available, run it in the dedicated `review-auditor` so
implementation gets an independent pass. Fall back to the same contract in the
current agent only when delegation is unavailable. A reviewer that patches
findings re-reviews its own resulting diff; it does not recursively launch
another reviewer.

## Scope contract

- Start with `git status --short`, the original task, and the exact task-owned
  files or diff. Treat pre-existing or unrelated worktree changes as user-owned:
  inspect them only when needed to understand an interaction, and never rewrite,
  revert, stage, or format them.
- Review the complete resulting task diff, not just the reviewer's own patch.
  Read changed functions/components and their direct callers, tests, types, and
  shared utilities far enough to verify each candidate finding.
- Keep fixes inside the authorized frontend/app/docs scope. Backend/Django/API
  server working trees remain read-only.
- Do not turn review into taste-driven churn. A fix needs a concrete correctness,
  maintenance, performance, validation, or project-contract benefit.

## Review checklist

- Correctness against the stated task, edge cases, failure states, and existing
  product contract
- Unnecessary code: wrappers, fallbacks, state, effects, branches, abstractions,
  comments, types, or files that do not earn their complexity
- Duplication inside the diff or against existing components, hooks, utilities,
  adapters, validators, query keys, and test helpers
- Poor or inefficient structure: repeated requests/computation, avoidable
  renders, unstable dependencies, N+1/fan-out behavior, broad state ownership,
  leaky boundaries, or control flow that can be made simpler and clearer
- Maintainability: focused functions/components, precise types, explicit
  invariants, no dead code, and no speculative generalization
- FE/BE board tasks include and satisfy the mandatory `Task Contract` from
  `docs/TASK_BOARD_MCP.md`
- Reuse of existing components, hooks, utils, and query/store boundaries
- Project-rule compliance: external links, design tokens, images, no skipped tests, no new `any` in `api/`, `hooks/`, `stores/`
- Explicit platform impact for desktop web, mobile web, and Android; shared code
  preserves behavior or has justified technical platform adapters, and any
  mobile-web/Android impact has paired evidence
- Explicit localization impact: app-owned UI uses `@/i18n`, RU/BE/UK/PL/EN keys
  stay complete, formatting uses `i18n/format.ts`, and API/editorial content is not client-translated
- Validation adequacy: the narrowest reliable checks were run and rerun after fixes
- Visible UI changes include desktop-web and mobile-web browser verification,
  no new console errors, and the same flow on a local USB Android build
- Localization changes include `npm run test:i18n` and locale/platform evidence;
  native readiness is not inferred from web checks
- No known real failures are left in the touched scope without an explicit blocker

## Review-and-fix loop

1. Inspect the task-owned diff and rank only verified findings:
   - `P1`: correctness, security, data-loss, or user-visible regression.
   - `P2`: project-contract violation, real performance cost, duplication, or
     poor structure that materially increases maintenance risk.
   - `P3`: bounded simplification with a clear benefit; never style preference.
2. In `review-and-fix` mode, patch every confirmed in-scope finding. Prefer the
   smallest clear rewrite, but replace a poor implementation when local edits
   would preserve duplication or unnecessary complexity.
3. Add or update regression coverage when behavior changes. Preserve the stated
   product behavior during cleanup; do not use a refactor as authority for a
   redesign, backend change, or broad migration.
4. Run the narrowest reliable checks for the resulting diff. Apply the operation
   gate before shared/full test commands. Visible UI still requires the browser
   and paired mobile-web/Android evidence defined by project rules.
5. Re-read the entire resulting task diff after fixes. Repeat review → fix →
   validation until no confirmed fixable finding remains.
6. Leave a finding open only when it is outside the authorized scope, requires a
   risky migration or unavailable external dependency, or cannot be safely
   verified. State the concrete blocker and next check.

Do not approve reload hacks, cache-busting workarounds, direct
`window.open(...)`, skipped tests, silent fail-open behavior, or duplicated
contracts. Do not approve `done` when a dependent runtime contract is unverified.

## Handoff

Return a compact final artifact:

```md
## Code Review and Repair

Fixed findings:
Open findings:
Validation:
Residual risk:
```

If no fixes were needed, say `Fixed findings: none`; do not invent commentary.
