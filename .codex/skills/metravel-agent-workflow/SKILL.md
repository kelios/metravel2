---
name: metravel-agent-workflow
description: Orchestrate a role-based metravel AI workflow across project analyst, business analyst, system architect, designer, Android/iOS developers, programmer, mobile tester, security/design reviewers, QA, reviewer, Google Play operator, and DevOps agents. Use when Codex needs to split a metravel task into agent roles, run a bug-finding/fixing/deploy loop, or coordinate project analysis, discovery, implementation, mobile validation, review, and release without losing project rules.
---

# Metravel Agent Workflow

Use this skill to coordinate multiple role prompts or subagents for metravel work. Keep the workflow controlled: each role has a narrow output contract, code changes happen only in the implementation stage, and deploys happen only through the DevOps stage after explicit environment gating.

Do not use this skill for docs-only changes, simple automated checks, one isolated bugfix/refactor, one board-contract update, or read-only analysis that does not need handoff to implementation/QA/review. Use the single matching specialist skill instead.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- Extra feature docs only when the task touches that area.

## Role Order

Default feature flow:

1. Codex Orchestrator: use `$metravel-codex-orchestrator` for task triage, skill selection, role prompt pattern, validation plan, and handoff rules when scope is broad or multi-step.
2. Project Analyst: use `$metravel-project-analyst` for broad or unclear scope to map structure, validation, risks, and next agents.
3. Business Analyst: produce a concise feature brief and acceptance criteria.
4. System Architect: map the brief to existing code, constraints, risk, and validation.
5. Domain Router: use `$metravel-domain-router` for travel/map/profile/achievements/quests/PDF/new-page owner maps.
6. Domain Expert: use `$metravel-travel-expert`, `$metravel-map-expert`, `$metravel-profile-expert`, `$metravel-achievements-expert`, or `$metravel-quest-expert` for domain-specific constraints; use `$metravel-quest-writer` for new authored quest content, `$metravel-quest-editor` for existing content, and `$metravel-quest-geo-verifier` for coordinates.
7. Designer: use `$metravel-ui-guardrails` for visible UI states and web/mobile behavior; use `$metravel-design-auditor` for cross-screen evidence and `$metravel-visual-asset-designer` for requested raster assets.
8. Native Developer: use `$metravel-android-developer` or `$metravel-ios-developer` for platform implementation, crashes, platform files, or Expo native modules.
9. Refactor Surgeon: use `$metravel-refactor-surgeon` for behavior-preserving large component splits.
10. Programmer: use `$metravel-feature-builder` to implement the smallest sufficient diff.
11. Backend Diagnostician: use `$metravel-backend-diagnostician` for read-only API/backend blockers and board follow-up.
12. Ticket Board: use `$metravel-ticket-board` for MCP board task/sprint list/create/update/sync; use `$metravel-task-contract` for FE/BE contracts.
13. Browser Reviewer: use `$metravel-browser-reviewer` for visible web diff review, fixes, and re-verification.
14. Mobile Tester: use `$metravel-mobile-tester` for mobile web, Android, or iOS/native QA evidence and retest.
15. QA Agent: use `$metravel-qa-agent` to test broader flows and create structured bug reports.
16. Sprint Reviewer: use `$metravel-sprint-reviewer` to accept task-board tickets only with Done-gate evidence.
17. Production Smoke: use `$metravel-production-smoke` for read-only production health checks.
18. Reviewer: use `$metravel-system-architect` in review mode, `$metravel-code-reviewer` for focused diffs, or `$metravel-security-reviewer` for security-sensitive scope.
19. Store Operator: use `$metravel-google-play-operator` only for an explicit Google Play build, submit, promotion, or status request; use `$metravel-play-campaign-tester` only for the configured reciprocity campaign.
20. DevOps Agent: use `$metravel-devops-agent` only when the user explicitly asks to deploy, build, release, or verify a deployment.

Default bug loop:

1. QA Agent explores the app and writes bug reports only.
2. Mobile Tester handles mobile-specific reproduction, device/emulator evidence, and retest when the bug is mobile web, Android, or iOS/native.
3. Android or iOS Developer fixes confirmed platform-native bugs; Programmer fixes shared feature bugs.
4. QA Agent or Mobile Tester re-tests the fixed scenario.
5. Reviewer checks the diff and validation.
6. DevOps Agent deploys/builds/releases only if the fix is approved and the user explicitly requested a target environment or mobile build. Android production/EAS builds require an explicit Android build/submit request in the current task.

## Control Rules

- Do not let exploratory QA or analyst roles edit code.
- Use Codex Orchestrator only to choose and sequence work; route implementation to the relevant specialist skill.
- Use Project Analyst only for read-only discovery unless the user explicitly asks to update docs or code after the analysis.
- Use Backend Diagnostician only for read-only backend/API diagnosis and board evidence; do not let it edit backend or frontend code.
- In this frontend workspace, no role edits backend/Django/API/server working trees; backend fixes are routed to `area=back` board tasks with evidence.
- Keep Mobile Tester read-only unless the user explicitly asks to update tests.
- Do not let Android Developer change mobile release/build configs without explicit user approval.
- Apply the same configuration and EAS authority gates to iOS work; web/Android evidence alone is not iOS device verification.
- Do not let Android Developer or Mobile Tester run Android EAS/cloud builds, Android production builds/submits, or dev-client/export Android QA routes without explicit user approval; Android QA defaults to local build/install on the USB-connected phone.
- Do not let iOS Developer or Mobile Tester run iOS EAS/cloud builds or submits without an explicit request for that exact action.
- Do not let Google Play Operator build, submit, promote, or mutate a track beyond the exact target the user authorized in the current task.
- Do not let Refactor Surgeon change business logic or visual design; it only extracts structure.
- Do not let Sprint Reviewer move tickets to `done` without runtime evidence for the Task Contract Done gate.
- Do not let Production Smoke deploy, rollback, or mutate production; it only probes read-only health.
- Do not let implementation start from vague requirements; require acceptance criteria or a bug report first.
- Do not deploy production from vague wording; require an explicit `prod` deploy request and a clean environment gate.
- Before assigning deploy, build, Android install, server rebuild/restart, full/preflight tests, Playwright/e2e, or Lighthouse work, check the operation coordination rule from `AGENTS.md`/`docs/RULES.md`; if the same target is already running, do not start a second agent command.
- Keep unrelated user changes separate; never revert files outside the task.
- Preserve project rules for external links, design tokens, e2e secrets, server paths, and scope-based validation.
- For visible web UI changes, require browser verification, screenshot, and console check before final handoff.
- If a role finds a real issue in the touched scope, route it to implementation before handoff unless it is explicitly blocked.

## Handoff Format

Each role should return one compact artifact:

- Business Analyst: `Feature Brief`
- Codex Orchestrator: `Codex Route`
- Project Analyst: `Project Analysis`
- System Architect: `Technical Design`
- Domain Router: `Domain Route`
- Domain Expert: `<Domain> Expert Handoff`
- Quest Editor: `Quest Content Handoff`
- Quest Geo Verifier: `Quest Geo Report`
- Designer: `UI Contract`
- Android Developer: `Android Implementation Summary`
- iOS Developer: `iOS Implementation Summary`
- Refactor Surgeon: `Refactor Summary`
- Programmer: `Implementation Summary`
- Backend Diagnostician: `Backend Diagnosis`
- Ticket Board: `Board Update`
- Browser Reviewer: `Browser Review Verdict`
- Mobile Tester: `Mobile QA Pass` or `Bug Report`
- QA Agent: `Bug Report` or `QA Pass`
- Sprint Reviewer: `Sprint Review`
- Production Smoke: `Production Smoke`
- Reviewer: `Review Findings`
- Security Reviewer: `Security Findings`
- Design Auditor: `Design Audit`
- Google Play Operator: `Google Play Release Report`
- Play Campaign Tester: `Closed Testing Daily Pass`
- DevOps Agent: `Deploy Report`

The orchestrator final answer should include the changed files, validation run, and remaining blockers or risks.
