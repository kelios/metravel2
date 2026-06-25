---
name: metravel-browser-reviewer
description: Review and fix metravel changes that are visible in a real browser. Use when Codex must verify UI/layout/interaction changes, inspect console/network/screenshot evidence, review a diff beyond code reading, fix discovered browser regressions, and rerun browser validation before handoff.
---

# Metravel Browser Reviewer

Use this skill for a review-and-fix loop on observable web behavior. It complements `$metravel-code-reviewer` and `$metravel-ui-guardrails`.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/TESTING.md`
- relevant `docs/features/*.md` when the flow has a feature doc.

## Review Loop

1. Inspect `git status --short` and the relevant diff. Keep unrelated user changes separate.
2. Identify the exact user-visible scenarios changed by the diff.
3. Start or reuse a local preview only after checking the operation gate for shared e2e/browser work.
4. In a real browser, collect evidence for each scenario:
   - accessibility snapshot or DOM state
   - screenshot in `.codex-temp/` or `.codex-debug/`
   - browser console errors
   - network failures when data/media changed
   - desktop and mobile widths when layout is responsive
5. Fix real issues in the touched scope: overlap, broken interaction, invalid icon, missing placeholder geometry, console/runtime error, direct external-link violation, broken data state.
6. Rerun the browser scenario and targeted checks after fixes.

## Verdicts

Return one of:

- `PASS`: no browser issue found.
- `FIXED`: issue found, fixed, and reverified.
- `FAIL`: issue remains and is in scope but cannot be fixed safely.
- `VERIFY_PENDING`: a concrete environment blocker prevents browser verification after reasonable alternate paths.

Do not mark UI work complete from code inspection alone. Do not ask the user to verify instead of doing the browser pass.
