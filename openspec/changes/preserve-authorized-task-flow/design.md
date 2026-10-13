## Context

See proposal.md. Source evidence: legacy openspec-propose planning boundary discarded direct implementation authority; docs/RULES required a second apply request. githooks/pre-commit invokes unscoped check:fast, whose collectWorkingTreeChangedFiles in scripts/run-local-selective-checks.js includes all staged, unstaged and untracked files. The actual theme commit passed 17 app suites/436 tests and guards but failed on two foreign i18n memo ESLint warnings.

## Goals / Non-Goals

Goals: retain owner authority and validate the current commit independently of unrelated unfinished files. Non-goals: weakening checks, modifying foreign i18n, changing pre-push/CI or validating isolated staged blob content.

## Decisions

1. Canonical authority lives in docs/RULES Development workflow. Explicit implement/build/fix wins, including an accompanying propose invocation; planning-only stops only without an implementation instruction. Align AGENTS, SDD docs, config and the two skill copies; preserve external gates and vendor compatibility metadata. Alternative: discarding every initial request repeats the observed unwanted confirmation.
2. Reuse existing check:fast --changed-files-file. The pre-commit hook obtains the index path list with NUL-delimited Git output, including both rename paths and deletions, writes a unique newline manifest under ignored .codex-temp/ops, then invokes the same standard runner. Retain every applicable/global guard and quality lock. Normal manually run check:fast remains working-tree scope. Alternative: patching foreign unfinished files couples sessions and does not fix the mechanism; skipping the hook removes necessary validation.
3. Fail closed on Git errors, runner errors and filenames that the existing newline/trim manifest protocol cannot represent (CR/LF or leading/trailing whitespace). Accept spaces inside paths and Unicode. Clean the temporary manifest on success, failure and termination. Do not add a new generic runner or protocol unless required by test evidence.

Ownership: workflow_rules owns authority docs/skills; commit_scope_fix owns githooks/pre-commit and focused tests plus canonical staged-scope note; root owns artifacts and integration. Other sessions retain all their files/index entries. No app/API/auth/SEO/a11y/analytics changes from this workflow change; no backend edits or paid/store operations.

## Risks / Trade-offs

- [Wrong filename decoding silently changes scope] → NUL input, explicit unrepresentable-name failure and Git fixture tests.
- [Failure or cleanup accidentally permits commit] → preserve checker exit code and failure fixtures.
- [Partial staging of a shared file] → unchanged limitation: existing validators read working-tree contents of selected paths; review still requires exact task diff and explicit paths.
- [Vendor update restores old planning body] → existing documented narrow shim procedure and audit:prompts; no global generated-body rewrites.

## Migration Plan

No installation/data migration. Update tracked hook/authority sources on main; the already configured core.hooksPath sees the new hook. Rollback only task-owned hook changes; retain the owner's requested authority rule. Do not reset foreign work or staging.

## Validation matrix

| Surface | Evidence |
| --- | --- |
| macOS/local Git hook | Real Git fixture: staged file plus foreign unstaged/untracked edits; only staged names reach standard check runner |
| Path protocol | Spaces/Unicode, rename source+destination and deletion; CR/LF/trim-changing names reject |
| Failure/cleanup | Git read failure and runner nonzero prevent commit; manifest removed; successful run removes manifest |
| Instructions | Both skill validators/frontmatter and audit:prompts; review planning-only, implement-only and propose+implement wording |
| Application platforms/locales | none for this change; native-theme acceptance remains separate |

Independent review-and-fix and read-only code-review-gate precede commit. No new browser/device gate for tooling-only changes; successful real task commit provides integration evidence. Strict OpenSpec validation required; unrelated artifacts are not repaired opportunistically.
