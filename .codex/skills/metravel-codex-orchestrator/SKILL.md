---
name: metravel-codex-orchestrator
description: "Apply the metravel Codex operating system before and during work: task triage, minimal skill selection, role prompt selection, docs/rules checklist, validation planning, handoff format, and final self-check. Use when Codex needs to organize its own work, choose agents/skills, translate a user request into a safe workflow, or keep complex metravel tasks aligned with AGENTS.md and docs/CODEX.md."
---

# Metravel Codex Orchestrator

Use this skill as the top-level Codex work controller for metravel tasks. It does not replace role skills; it chooses and sequences them.

Read first:

- `AGENTS.md`
- `docs/CODEX.md`
- `docs/RULES.md`
- `docs/README.md`
- Extra docs only when the triage table in `docs/CODEX.md` says they matter.

## Start Prompt

At task start, silently or briefly answer:

```text
Task type:
User-facing scope:
Required skills:
Docs to read:
Branch/status:
Risk zones:
Validation plan:
Operation gate:
Needs browser/mobile/native check:
External links affected:
Can proceed without clarification:
```

If the branch is not `main`, stop before editing and ask how to proceed.

## Skill Selection Rules

- Always choose the smallest useful skill set.
- Keep docs-only changes, simple automation, narrow checks, and isolated bugfixes in one specialist skill unless the scope is unclear or high-risk enough to need orchestration.
- Use `$metravel-project-analyst` for broad or unclear repository analysis.
- Use `$metravel-business-analyst` before implementation when the request is a product idea or requirements are vague.
- Use `$metravel-system-architect` when design, module boundaries, risk mapping, or high-risk review is needed.
- Use `$metravel-feature-builder` for feature, bugfix, refactor, API, service, hook, SEO, or ordinary code changes.
- Use `$metravel-hook-builder` when the main work is hook extraction or hook-boundary cleanup.
- Use `$metravel-ui-guardrails` for visible UI, layout, icons, images, placeholders, tokens, or external-link interaction.
- Use `$metravel-android-developer` for Android/native implementation, crashes, Expo modules, permissions, SecureStore, push, or platform files.
- Use `$metravel-mobile-tester` for read-only mobile web or Android/native QA evidence and retest.
- Use `$metravel-test-runner` to choose and run targeted checks; `$metravel-test-writer` to add stable tests.
- Use `$metravel-e2e-runner` for Playwright/browser flows and `.env.e2e` auth.
- Use `$metravel-performance-analyst` only with production build or real URL performance evidence.
- Use `$metravel-release-checks` and `$metravel-devops-agent` for release/deploy/build operations and explicit environment gates.
- Use `$metravel-docs-maintainer` for docs, AGENTS, CODEX, or skill changes.
- Use `$metravel-code-reviewer` before handoff when review findings, residual risk, or rule compliance matter.
- Use `$metravel-quality-fixer` when the task is explicitly to run/fix the full quality gate.

## Role Prompt Pattern

When handing work to a role skill, keep the prompt compact:

```text
Use $<skill-name> for <scope>.
Context: <relevant files/docs already known>.
Constraints: follow AGENTS.md, docs/RULES.md, docs/CODEX.md; keep unrelated changes separate; do not print secrets.
Output: <role artifact name>.
Validation: <expected checks/evidence>.
```

Do not leak desired conclusions into QA/reviewer prompts; pass raw scope, diff, logs, or evidence.

## Work Rules

- Prefer existing components, hooks, services, utilities, and tests before adding abstractions.
- Keep edits small and local.
- Fix real issues found in the touched scope before handoff.
- Keep temporary screenshots, logs, traces, and JSON output only in ignored folders such as `.codex-temp/`, `.codex-debug/`, `test-results/`, or `playwright-report/`.
- Never print secrets from `.env*`, `.env.e2e`, EAS, SSH, Google Play, or server configs.
- Do not create one-off reports unless the user asks; update canonical docs instead.
- For visible web UI, require browser preview, screenshot, and console check.
- For Android/native, do not claim device readiness without emulator/device evidence.
- For production deploy or submit, require explicit target environment and clean gates.
- Before assigning or running deploy, build, server rebuild/restart, full/preflight tests, Playwright/e2e, or Lighthouse work, apply the operation coordination rule from `AGENTS.md`/`docs/RULES.md`; do not launch duplicates for the same target.

## Final Self-Check

Before final response, verify:

- Scope stayed within the user request.
- Current branch rule was respected.
- Changed files are intentional.
- Relevant checks ran, or blockers are explicit.
- External-link, UI, native, release, and secret rules were not violated.
- Any known real issue in touched scope is fixed or documented as blocked.
- Final answer lists changed files, validation, and residual risks without dumping secrets or noisy logs.
