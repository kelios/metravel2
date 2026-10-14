## 1. Authority and planning

- [x] 1.1 Record explicit owner implementation authority and the observed repeat-confirmation/foreign-precommit failures.
- [x] 1.2 Review the staged-scope design and rejected bypass/foreign-edit alternatives; preserve all operation gates.
- [x] 1.3 Align canonical instructions, config and both propose skills; validate prompt audit and unchanged frontmatter.

## 2. Commit scope

- [x] 2.1 Route pre-commit through existing check:fast scoped to NUL-enumerated index paths, including deletion and rename paths.
- [x] 2.2 Fail closed for enumeration/check errors and unrepresentable names; clean temporary manifest on success/failure/termination.
- [x] 2.3 Run real-Git hook fixtures covering parallel unfinished files, Unicode/internal spaces, rename/deletion, failure propagation and cleanup; verify global/applicable guard implementation is unchanged.

## 3. Review and integration

- [x] 3.1 Independently review-and-fix the complete updated workflow diff, run its narrow tests/static checks and refresh code-review-gate.
- [x] 3.2 Verify strict specification validation and audit:prompts; commit/push only reviewed task-owned paths through the normal hook using the existing owner pipeline authorization.
- [x] 3.3 Record successful actual commit integration and outstanding acceptance accurately. This tooling change adds no browser/device gate; native theme runtime remains in its separate change.

Integration evidence: reviewed commit `0e2520762cf3852fb33225703387f7004ee6a27c`
passed the normal staged-scope pre-commit and code-level pre-push checks and was
pushed to `main`. All 44 explicitly staged task paths were included; unrelated
working-tree changes were excluded. The nine real-Git hook fixtures, both strict
change validations and `audit:prompts` passed. Logs are retained in ignored
`.codex-temp/native-seasonal-themes/{commit,push,precommit-tests}.log`. Native
runtime acceptance remains recorded separately in `add-native-seasonal-themes`.
