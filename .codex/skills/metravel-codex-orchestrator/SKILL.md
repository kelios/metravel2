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
Platform impact: desktop web | mobile web | Android | shared | none
Localization impact: RU/BE/UK/PL/EN | selected locales | none
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
- Use `$metravel-domain-router` before implementing domain-heavy travel, map, profile, achievements, quests, PDF/export, new-page, or design-system work.
- Use `$metravel-feature-builder` for feature, bugfix, refactor, API, service, hook, SEO, or ordinary code changes.
- Use `$metravel-hook-builder` when the main work is hook extraction or hook-boundary cleanup.
- Use `$metravel-refactor-surgeon` for behavior-preserving extraction of large components or file-complexity guard failures.
- Use `$metravel-ui-guardrails` for visible UI, layout, icons, images, placeholders, tokens, or external-link interaction.
- Use `$metravel-i18n-guardrails` for app-owned UI copy, accessibility,
  errors/validation, locale settings/storage, translations, formatting, SEO locale,
  geocoder language, or PDF/export text.
- Use `$metravel-design-auditor` for cross-screen design consistency audits and `$metravel-visual-asset-designer` for requested branded raster assets.
- Use `$metravel-browser-reviewer` for visible web diff review, browser evidence, console/network checks, and fix/reverify loops.
- Use `$metravel-android-developer` for Android/native implementation, crashes, Expo modules, permissions, SecureStore, push, platform files, or local USB Android build/install verification.
- Keep `$metravel-ios-developer` inactive unless the user makes a new explicit
  decision to return iOS to scope; do not add iOS QA or `verify pending` by default.
- Use `$metravel-mobile-tester` for paired read-only mobile web and Android/native
  QA evidence and retest; Android evidence requires a local build installed on
  the USB-connected phone unless the user explicitly approved another route.
- Use `$metravel-test-runner` to choose and run targeted checks; `$metravel-test-writer` to add stable tests.
- Use `$metravel-e2e-runner` for Playwright/browser flows and `.env.e2e` auth.
- Use `$metravel-performance-analyst` only with production build or real URL performance evidence.
- Use `$metravel-seo-index-operator` for GSC/indexing routines, URL Inspection/index status, IndexNow backup, and SEO owner/action lists.
- Use `$metravel-release-checks` for validation planning and `$metravel-devops-agent` for deploy execution, rollback, approved deploy-command selection, Windows/Codex wrapper use, and emergency frontend recovery.
- Use `$metravel-production-smoke` for read-only production health checks and route failures to the right owner.
- Use `$metravel-docs-maintainer` for docs, AGENTS, CODEX, or skill changes.
- Use `$metravel-prompt-maintainer` for prompt specs, asset prompt instances, `agents/openai.yaml`, stale model-specific wording, and prompt reproducibility audits.
- Use `$metravel-backend-diagnostician` for read-only backend/API diagnosis and backend board follow-up.
- Use `$metravel-sprint-reviewer` for task-board acceptance and Done-gate verification.
- Use `$metravel-code-reviewer` before handoff when review findings, residual risk, or rule compliance matter.
- Use `$metravel-security-reviewer` for XSS, sanitizer, URL, secret/token, WebView/deep-link, or dependency security review.
- Use `$metravel-google-play-operator` only for explicit Android store build/submit/track work; use `$metravel-play-campaign-tester` only for the configured closed-testing reciprocity campaign.
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
- Treat the active product as one Expo/React Native app across desktop web,
  mobile web, and Android. Require an explicit platform/localization impact
  decision before implementation and paired mobile-web/Android validation.
- Require RU/BE/UK/PL/EN resource parity for new app-owned UI copy and
  `npm run test:i18n` for localization changes.
- Keep edits small and local.
- Treat backend/Django/API/server work as analysis-only in this frontend workspace. Do not route any role to edit backend working trees or run backend Git mutations locally/on production. Before an authorized server write, require read-only `git status`/`git ls-files` classification; a tracked path or dirty production checkout means stop, evidence, and an `area=back`/ops task without cleanup or deploy. For the frontend deploy gate, apply only the exact non-mutating exceptions documented in `docs/RULES.md` for `deploy/prod/nginx/ssl/`, `dump.sql`, and the permission warning for `deploy/prod/postgis_1/data/`.
- When a board task is in scope, enforce `todo → in_progress → review → testing → done`.
  Reserve `blocked_by` for a concrete hard dependency that prevents implementation work; waiting
  for review or validation remains `review`/`testing`.
- Fix real issues found in the touched scope before handoff.
- Keep temporary screenshots, logs, traces, and JSON output only in ignored folders such as `.codex-temp/`, `.codex-debug/`, `test-results/`, or `playwright-report/`.
- Never print secrets from `.env*`, `.env.e2e`, EAS, SSH, Google Play, or server configs.
- Do not create one-off reports unless the user asks; update canonical docs instead.
- For visible web UI, require browser preview, screenshot, and console check.
- For Android/native, do not claim device readiness without local-build evidence from the USB-connected phone.
- For any visible UI/layout/interaction change, require desktop web, mobile web,
  and Android evidence. If mobile web or Android is affected, the other is
  automatically in scope for the same flow and locale.
- Do not run Android EAS/cloud builds, Android production builds/submits, or Expo export/dev-client Android QA routes unless the user explicitly asks for that exact path in the current task.
- For production deploy or submit, require explicit target environment and clean gates. Do not let roles invent deploy commands; route mutating deploy/rollback work through `$metravel-devops-agent`.
- Before assigning or running deploy, build, Android install, server rebuild/restart, full/preflight tests, Playwright/e2e, or Lighthouse work, apply the operation coordination rule from `AGENTS.md`/`docs/RULES.md`; do not launch duplicates for the same target. For an active test/quality gate, end the new validation attempt without waiting, polling, bypassing, or retrying. Choose `validation delegated: active gate pid/name` when its scope covers the task and automated tests are the only remaining Done-gate step, allowing completion without claiming `passed`; otherwise choose `validation skipped: active gate pid/name` and keep the task open. The owner fixes failures and reruns.

## Final Self-Check

Before final response, verify:

- Scope stayed within the user request.
- Current branch rule was respected.
- Changed files are intentional.
- Relevant checks ran, or blockers are explicit.
- External-link, UI, native, release, and secret rules were not violated.
- Platform impact was covered with desktop-web evidence plus paired
  mobile-web/Android evidence, or an exact active-platform blocker; localization
  impact and affected locales were verified. No iOS evidence was required.
- Any known real issue in touched scope is fixed or documented as blocked.
- Final answer lists changed files, validation, and residual risks without dumping secrets or noisy logs.
