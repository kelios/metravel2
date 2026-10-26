## Context

See proposal.md. Existing `build-lock.resolveLockRoot` uses git-common-dir for
linked worktrees, but a shared clone has its own .git. `build-web-prod.js:92`
and `e2e-webserver.js:110` rewrite .env. `verifiedFontBundle` already validates
font manifest/checksums; reuse it rather than invent another font contract.

## Goals / Non-Goals

Goals: prepare only known local prerequisites, with no content output or source
mutation. Non-goals: native builds, Pods/node_modules sharing, external repos,
secret generation and changes to release/main/clean guards.

## Decisions

- Parse NUL-separated git worktree metadata when supported; on older Git use
  porcelain records, rejecting quoted/escaped ambiguous paths. Verify canonical frontend origin
  kelios/metravel2. Shared clones require a local-origin chain with matching
  object alternates and source-reachable HEAD; no arbitrary source argument.
- Copy env files independently. Reject symlinks in source/destination ancestors,
  tracked destinations and non-ignored paths before any copy. Plan all writes
  before execution; unknown failures use fixed sanitized messages.
- Default allowlist: .env, .env.prod, .env.e2e and verified font bundle records.
  Explicit `--android-secrets` adds only the five consumed portable Android
  secret filenames; default does not distribute signing/upload credentials.
- Existing targets remain unchanged; --force replaces only allowed regular
  files. No symlink or generated directory removal. Private file modes for env
  and secret copies. Main invocation is an explicit no-op.
- Native steps are guidance: independent dependencies, android:prebuild;
  iOS UTF-8 pod install in the target. Operation and store gates still apply.
- Diagnostics live in the existing build-web-prod, e2e-env-files and font
  validator boundaries; reuse those across all consumers.

Scope: scripts/worktree-bootstrap.js, npm entry, three consumer diagnostics,
focused tests, docs/WORKFLOW_OPERATIONS.md and docs/PROBLEM_MEMORY.md.
Data/API, UI, SEO, a11y, analytics, app performance and localization: none.
Backend remains read-only. No native source/plugin changes.

## Risks / Trade-offs

- Secret path escape → reject symlinks at every relevant component and tracked
  paths; fixed allowlist and fixture tests. Local trusted checkout, not a hostile
  concurrent filesystem sandbox; atomic copy prevents accidental overwrite races.
- Stale copied env → clear status plus explicit --force; no automatic refresh.
- Different font revision → existing pinned validator refuses mismatch.
- Missing node_modules/Pods → guidance, not heavy or destructive hidden operations.

## Validation and Recovery

Focused Node/Jest tests: relationship rejection, symlinks, ignored/tracked paths,
non-overwrite/force, allowlist, secret-output sentinel and consumer diagnostics.
After independent review: fresh linked worktree and shared-clone bootstrap,
bookRendererWorker, production web build and smoke e2e using operation locks.
Product/native code unchanged: no duplicate viewport or simulator matrix.
Rollback: revert task paths; generated copied prerequisites can be removed
individually in the disposable owned test checkout, leaving source untouched.
