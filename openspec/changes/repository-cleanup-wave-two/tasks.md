## 1. Evidence and dependencies

- [x] 1.1 Claim #3309, verify repository ownership and isolate the implementation from unrelated Metro work.
- [x] 1.2 Audit dependency/native consumers, npm references, platform/Node base consumers and all seven draft-to-board mappings.

## 2. Repository removals

- [x] 2.1 Remove confirmed unused dependencies, move jszip to development and regenerate the lockfile without unrelated upgrades; remove native packages only if their explicit gates pass.
- [x] 2.2 Remove the four orphan stubs and update ADR/icon documentation.
- [x] 2.3 Remove obsolete build.sh and its root allowlist entry.
- [x] 2.4 Record the owner's explicit Speckit choice and apply only that choice, preserving Speckit while the choice is pending.
- [x] 2.5 Preserve draft requirements in canonical board records, document the mapping and remove completed/imported task files.
- [x] 2.6 Remove only proven dead platform bases and document retained test/Node/router consumers.
- [x] 2.7 Retire npm aliases with no consumers, preserving lifecycle and live tooling entry points.

## 3. Safe temporary cleanup

- [x] 3.1 Implement strict read-only inventory and explicit apply with age, closed cache allowlist, archive retention, protection, symlink confinement and independent Git worktree guards.
- [x] 3.2 Add fixture regression coverage for all cleanup requirements, including concurrent change revalidation and real Git removal without force.
- [x] 3.3 Register clean:temp and document retention, recovery and safe operation.

## 4. Source validation and review

- [x] 4.1 Run focused regressions and clean frozen install; compare native autolinking and CocoaPods if native packages are removed.
- [ ] 4.2 Run isolated lint, full Jest and web build plus documentation/prompt guards; repair in-scope failures.
- [ ] 4.3 Complete the final code-review gate after the passed independent review-and-fix on the complete task diff.
- [ ] 4.4 Integrate only task-owned hunks on canonical main and publish point-specific commits through the board workflow.

## 5. Testing and completion

- [ ] 5.1 Verify fixture apply, real primary .codex-temp dry-run and preserved symlink targets/working stores, with no real-root deletion.
- [ ] 5.2 Verify task commits reachable from origin/main; no application runtime/deploy matrix is required by this tooling-only contract.
- [ ] 5.3 Validate OpenSpec and close #3309 only when all eight sections and the explicit Speckit choice are resolved.
