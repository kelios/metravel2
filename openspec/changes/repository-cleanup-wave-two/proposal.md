## Why

Task #3309 identifies obsolete repository dependencies, files, commands and local build caches. Their continued presence obscures the active tooling contract, while unbounded `.codex-temp` caches consume disk space and the obsolete `build.sh` deletes the lockfile.

## What Changes

- Remove only confirmed unused dependencies and files; regenerate the existing lockfile without upgrading unrelated packages. Retain native packages unless autolinking and CocoaPods evidence proves safe removal.
- Retire unused npm aliases, orphan Metro stubs and the obsolete root build script. Preserve active commands, explicit platform/test consumers and all unrelated Metro work.
- Remove legacy Speckit under the owner’s explicit 13 November decision and migrate task drafts to existing/new board records before deleting local copies.
- Introduce `npm run clean:temp`, read-only by default, to inventory and optionally remove aged reconstructible caches and clean merged registered worktrees. Preserve symlinked dependencies, creative/operational stores, virtual environments and active data.
- Document retention and a file-to-decision audit trail. Each of the eight task sections has a separate commit boundary.

## Capabilities

### New Capabilities

- `safe-temp-cleanup`: bounded local cache inventory and explicit deletion with age, path, symlink and Git safety checks.

### Modified Capabilities

None. Application and API behavior remain unchanged.

## Impact

Owned repository: `kelios/metravel2`, branch `main`; implementation and full validation use an isolated local clone. Paths: dependency manifests, confirmed unused platform bases/stubs, legacy specification/task tooling, `scripts/clean-temp.js`, focused tests and related documentation. The canonical checkout contains another session's Metro/ADR changes; integration must preserve them.

Platform impact: shared dependency graph; native removal requires autolinking comparison and `pod install`. Other changes affect development tools only. Localization impact: none. User interface, API/data, SEO, accessibility and analytics contracts: none. Performance impact: smaller install/tooling footprint only. Security impact: conservative local filesystem deletion; no server writes or paid operations.

Non-goals: first cleanup wave, unrelated unreachable code/exports, version upgrades, `metro.config.js`, backend, real cache deletion before fixture validation, store builds/releases. Dependencies: the owner authorized Speckit removal on 13 November; draft-to-board mapping is complete. Fallback/mock policy: retain uncertain native/platform consumers with evidence; destructive cleanup tests use isolated filesystem fixtures, never production or real working stores.
