## Why

The canonical deployment removes its worktree after both green and red bundle guards, losing exact measurements (#2847, related #2738). Engineers need the actual measured bytes, provenance and verdict after cleanup without another export.

## What Changes

- Add a versioned diagnostic report from the existing guard arithmetic while preserving legacy JSON fields and all budget decisions.
- Atomically retain bounded reports in the main checkout's ignored deploy directory before cleanup.
- Add a strict comparison CLI for exact bytes/counts, verdicts, breaches and configuration/toolchain changes.
- Cover successful, failing and incomplete guards, atomicity, retention and cleanup using isolated fixtures.

Non-goals: fixing #2738 budgets, changing caps/tolerance/markers/allowlists, product behavior, backend or store operations. No additional build/deploy solely for this evidence.

## Capabilities

### New Capabilities

- `bundle-budget-evidence`: durable exact bundle measurements and their comparison.

### Modified Capabilities

None.

## Impact

Task-owned scripts, release-contract tests and this change only. No dependencies beyond Node built-ins. #2738 supplies the next already-required canonical export for artifact verification; fixture evidence does not replace it.

Platform impact: web build tooling only; no UI/native changes or viewport-specific assertions. Localization impact: none. Product API, SEO, accessibility and analytics are unchanged. Security: reports contain selected build identity/tool versions and measurements, never environment variables, payloads or full dist. Performance: no second measurement pass over the build; no claimed bundle reduction. Rollback is a task-only revert.
