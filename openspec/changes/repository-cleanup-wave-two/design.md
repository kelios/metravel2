## Context

See proposal.md for the cleanup inventory and boundaries. The primary checkout has live work owned by #3387, including ADR0003. Use an isolated shared clone with independent dependencies and preserve unrelated edits during the final transfer. The card's original inventory is evidence to recheck, not proof that a file is dead today.

## Goals / Non-Goals

Prove removability at source, module-resolution, package-manager and test boundaries. Keep each of the card's eight sections independently reviewable and separately committed. No application behavior changes, version upgrades, Metro resolver edits or broad dead-code audit. The owner explicitly chose removal on 13 November 2026. Remove the complete legacy Speckit cluster and correct live Copilot routing to OpenSpec; preserve the unimplemented draft through Git history.

## Decisions

1. Search tracked imports, config, test source readers, Node resolver seams, platform variants, docs and tooling before removal. A test-only/Node base file remains with a concrete reason. Reject deleting every shadowed base solely from its filename: Metro and Node do not share resolution semantics.
2. Remove confirmed unused direct packages and move e2e-only `jszip` to dev dependencies. Compare native autolinking and run CocoaPods before removing the two native packages; retain them with a reason if that gate is unavailable. Regenerate `yarn.lock` in isolation and reject unrelated upgrades.
3. Audit npm command references beyond the original directories, including tests and adapters. Preserve lifecycle commands and documented entry points; remove zero-consumer aliases only. Do not remove commands dynamically consumed by another retained command or guard.
4. Resolve drafts against the full board, preserving each draft's requirements in its canonical record or a new history-checked record before deletion. Keep a tracked audit table of every file decision.
5. Reuse strict CLI parsing/error handling and Git process helpers. Implement cleanup as an inventory/classifier and a separately revalidating executor. Default target is the script checkout's `.codex-temp`; do not add arbitrary-root CLI deletion. Fixture tests use an exported injected root/clock. Use lstat traversal, do not follow links, protect required path segments at any depth, and do not remove an ancestor containing protected data or a symlinked `node_modules`. Ordinary `.bin` links inside a real cache may be unlinked safely.
6. Age is the latest mtime/ctime within the containing top-level entry. Cache names are a closed allowlist; deployment archives have their independent fourteen-day threshold. Whole worktree removal additionally requires registered metadata, clean status, ancestry to `origin/main`, non-current/unlocked state and ordinary `git worktree remove` without force. Other clones are never removed wholesale. Recheck identity and the complete eligibility condition before each apply.

## Risks / Trade-offs

- False dead-code finding → verify explicit extensions, text-reader tests, Node worker graph and platform resolution; retain uncertain files with evidence.
- Parallel integration → coordinate ADR ownership; reconcile against current main, use explicit paths and never include the Metro session's diff.
- Filesystem race → lstat confinement and identity checks, revalidation immediately before removal, fail closed. Recent copying changes ctime and conservatively postpones cleanup.
- Large scans → inspect metadata only and never read file contents for retention; no automatic real-root apply in this task. Fixture apply proves destructive behavior.
- Missing native evidence → retain native packages; this task does not authorize store builds.

## Migration Plan

Prepare and validate the complete scoped diff in the clone, run independent review-and-fix then code-review gate, integrate on canonical main preserving unrelated edits, and publish eight point-specific commits as applicable. Use existing board authorization for commit/push. This tooling-only card explicitly requires no production/dev deploy. Rollback is reverting the task's corresponding commits; caches remain reconstructible. Do not apply cleanup to real temporary stores during implementation.

## Validation

Nearest assertions: fixture tests for dry-run/apply, age, protected nested stores, symlinks, concurrent changes and clean/dirty/unmerged worktrees; focused map snapshot and dependency/config tests for removals. Then isolated `yarn install --frozen-lockfile`, `npm run lint`, `npm run test:run`, `npm run build:web`, prompt/doc audits and OpenSpec strict validation. Native gates only if those packages are actually removed. Final acceptance runs real `.codex-temp` dry-run and fixture apply. No UI, locale, device or browser matrix: rendering and native implementation are unchanged.

Data/API, SEO, accessibility, analytics: none. Security: local filesystem containment above, no secrets printed, no server writes. Performance: dependency/build cache footprint; application performance is not being changed or claimed.
