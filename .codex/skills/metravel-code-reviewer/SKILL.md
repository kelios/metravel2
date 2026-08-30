---
name: metravel-code-reviewer
description: "Review and repair a complete metravel task diff for correctness, duplication, unnecessary complexity, poor reuse, performance, contract violations, and validation gaps. Use after code changes or for an explicit review/fix request."
---

# Metravel Code Reviewer and Fixer

Default mode is review-and-fix; read-only only when explicitly requested.
`AGENTS.md` is inherited. Load the relevant feature doc and only the canonical
`docs/RULES.md` headings implicated by the diff; do not reread all project docs.

Prefer an independent `review-auditor` agent. A reviewer that patches findings
re-reviews its own result and does not spawn another reviewer.

## Inputs

- Original task and acceptance boundary.
- `git status --short` and the complete task-owned diff.
- Task-owned paths plus known unrelated/user changes.
- Validation already run and raw failures/evidence.
- Platform/localization impact.

Read changed functions/components in context with direct callers, tests, types,
and shared utilities. Backend working trees remain read-only.

## Findings bar

Report and fix only evidence-backed issues:

- `P1`: correctness, security, data loss, or user-visible regression.
- `P2`: violated project contract, real performance cost, material duplication,
  or poor ownership/boundary.
- `P3`: bounded simplification with concrete maintenance benefit, never taste.

Check:

- behavior, edge/failure states, and stated acceptance;
- unnecessary wrappers/state/effects/branches/abstractions/comments;
- duplication versus existing components/hooks/utils/adapters/tests;
- repeated requests/computation, unstable dependencies, avoidable renders or
  fan-out;
- precise types, no dead code, no speculative generalization;
- external-link, UI/media, security, i18n, platform, board, and release contracts
  only when touched;
- adequacy of the proposed testing handoff for observable behavior, without
  running browser, API runtime, simulator, physical-device, or TestFlight QA in
  the review stage.

## Review-and-fix loop

1. Rank verified findings and cite `path:line` plus the failing condition.
2. Patch every confirmed in-scope finding with the smallest clear change.
3. Add/update regression coverage when behavior changes.
4. Run only source-level checks after fixes: relevant static guards, lint,
   type checks, and focused unit tests. Do not open a browser or device; those
   checks start only after the reviewed commit enters `testing`.
5. Re-read the complete resulting task diff and repeat until no fixable finding
   remains.

Preserve unrelated changes. Do not use review to authorize backend mutations,
protected-path changes, redesign, broad migration, allowlist expansion, skipped
tests, reload/cache-bust hacks, or silent fail-open behavior.

## Handoff

```md
## Code Review and Repair
Fixed findings:
Open findings/blockers:
Validation:
Residual risk:
```

Include the exact browser/device/runtime scenario for the `testing` handoff.
If no fix was needed, say so without inventing findings.
