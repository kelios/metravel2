---
name: metravel-agent-workflow
description: Orchestrate a role-based metravel AI workflow across analysis, architecture, design, web, Android and iOS development, testing, review, store operators, and DevOps. Use when Codex needs to split a task into agents, coordinate implementation and validation, or run a controlled bug/release loop without losing project rules.
---

# Metravel Agent Workflow

Use this skill to coordinate multiple role prompts or subagents for metravel
work. Keep the workflow controlled: each role has a narrow output contract, code
changes happen in implementation and in the mandatory review-and-fix stage, and
web/server deploys happen only through the DevOps stage. Store mutations happen
only through the matching release operator after an explicit target gate.

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
7. Designer and localization: use `$metravel-ui-guardrails` for visible UI states
   and web/mobile behavior; add `$metravel-i18n-guardrails` for UI copy, locale
   state/formatting, accessibility, SEO locale, and RU/BE/UK/PL/EN coverage; use
   `$metravel-design-auditor` for cross-screen evidence and `$metravel-visual-asset-designer` for requested raster assets.
8. Native Developer: use `$metravel-android-developer` for Android and
   `$metravel-ios-developer` for iPhone implementation, crashes, platform files,
   Expo native modules, permissions, storage, links, notifications, maps, or media.
9. Refactor Surgeon: use `$metravel-refactor-surgeon` for behavior-preserving large component splits.
10. Programmer: use `$metravel-feature-builder` to implement the smallest sufficient diff.
11. Backend Diagnostician: use `$metravel-backend-diagnostician` for read-only API/backend blockers and board follow-up.
12. Ticket Board: use `$metravel-ticket-board` for MCP board task/sprint list/create/update/sync; use `$metravel-task-contract` for FE/BE contracts.
13. Browser Reviewer: use `$metravel-browser-reviewer` for visible web diff review, fixes, and re-verification.
14. Mobile Tester: use `$metravel-mobile-tester` for target-specific mobile-web
    and/or Android QA evidence and retest.
15. QA Agent: use `$metravel-qa-agent` to test broader flows and create structured bug reports.
16. Reviewer/Fixer: always use `$metravel-code-reviewer` after code changes to
    review the complete task diff, fix confirmed in-scope findings, and repeat
    validation. Prefer a dedicated `review-auditor` agent for independence; add
    `$metravel-system-architect` for high-risk design review or
    `$metravel-security-reviewer` for security-sensitive scope.
17. Sprint Reviewer: use `$metravel-sprint-reviewer` to accept task-board tickets only with Done-gate evidence.
18. Production Smoke: use `$metravel-production-smoke` for read-only production health checks.
19. Store Operator: use `$metravel-google-play-operator` only for an explicit Google Play build, submit, promotion, or status request; use `$metravel-play-campaign-tester` only for the configured reciprocity campaign.
20. iOS Roles: use `$metravel-ios-architect` for design, `$metravel-ios-reviewer`
    for independent repair review, `$metravel-ios-tester` for simulator/device/TestFlight
    evidence, and `$metravel-ios-release-operator` for separately authorized store stages.
21. DevOps Agent: use `$metravel-devops-agent` only when the user explicitly asks to deploy, build, release, or verify a web/server deployment.

Default bug loop:

1. QA Agent explores the app and writes bug reports only.
2. Mobile Tester handles mobile-web browser reproduction for responsive-web
   bugs, and USB-device evidence for Android-specific bugs; compare both only
   for an explicit parity/cross-platform investigation.
3. Android Developer fixes confirmed platform-native bugs; Programmer fixes shared feature bugs.
4. QA Agent or Mobile Tester re-tests the fixed scenario.
5. Reviewer/Fixer checks the complete diff, fixes confirmed in-scope findings,
   re-reviews the result, and repeats relevant validation.
6. DevOps Agent handles only an explicitly requested web/server target. Android
   release work goes to `$metravel-google-play-operator`; iPhone signed/store
   work goes to `$metravel-ios-release-operator`. Android EAS remains prohibited,
   and every allowed store stage requires its exact current authorization.

## Control Rules

- Do not let exploratory QA or analyst roles edit code.
- Require `$metravel-code-reviewer` after every code-changing implementation.
  Prefer a dedicated `review-auditor` agent. It may edit only task-owned
  frontend/app/docs files to fix confirmed findings, must preserve unrelated worktree
  changes, and re-reviews its fixes without recursively spawning a reviewer.
- Use Codex Orchestrator only to choose and sequence work; route implementation to the relevant specialist skill.
- Use Project Analyst only for read-only discovery unless the user explicitly asks to update docs or code after the analysis.
- Use Backend Diagnostician only for read-only backend/API diagnosis and board evidence; do not let it edit backend or frontend code.
- In this frontend workspace, no role edits backend/Django/API/server working trees; backend fixes are routed to `area=back` board tasks with evidence.
- Keep Mobile Tester read-only unless the user explicitly asks to update tests.
- Do not let Android Developer change mobile release/build configs without explicit user approval.
- Do not let Android Developer or Mobile Tester run Android EAS/cloud builds, Android production builds/submits, or dev-client/export Android QA routes without explicit user approval; Android QA defaults to local build/install on the USB-connected phone.
- Keep iOS roles separated: architect/tester are read-only, developer does not
  publish, reviewer runs review-and-fix, and release operator requires separate
  explicit gates for signed build, upload, App Review submit, and storefront release.
- Do not let Google Play Operator build, submit, promote, or mutate a track beyond the exact target the user authorized in the current task.
- Do not let Refactor Surgeon change business logic or visual design; it only extracts structure.
- Do not let Sprint Reviewer move tickets to `done` without runtime evidence for the Task Contract Done gate.
- Keep board ownership explicit: implementation moves `todo → in_progress → review`; reviewer
  approval moves `review → testing`; QA/release evidence supports `testing → done` through
  `$metravel-sprint-reviewer`.
- Do not use `blocked_by` as a review or testing state. It is reserved for a concrete hard
  dependency that prevents implementation from starting or continuing. `testing`
  is active QA or an exact retest/temporal gate, never parking for missing
  validation. A pass closes the current ticket; unfinished ticket-owned work
  returns to `todo`/`in_progress`; a separate confirmed defect gets a new/reused
  linked task after Problem Memory. Missing access/device pauses the role chain
  for a concrete unblock request and then resumes it.
- Do not let Production Smoke deploy, rollback, or mutate production; it only probes read-only health.
- Do not let implementation start from vague requirements; require acceptance criteria or a bug report first.
- Do not deploy production from vague wording; require an explicit `prod` deploy request and a clean environment gate.
- Before assigning deploy, build, Android install, iOS simulator/archive/EAS,
  store upload/submit, server rebuild/restart, full/preflight tests,
  Playwright/e2e, or Lighthouse work, check the operation coordination rule from
  `AGENTS.md`/`docs/RULES.md`; if the same target is already running, do not
  start a second agent command.
- Keep unrelated user changes separate; never revert files outside the task.
- Preserve project rules for external links, design tokens, e2e secrets, server paths, and scope-based validation.
- Require every role handoff to state platform impact and localization impact.
  Common/shared responsive UI covers desktop web and mobile web. Android QA is
  required only for Android-specific observable behavior/configuration/runtime;
  iPhone QA only for iOS-specific scope at the required
  simulator/physical/TestFlight layer. Mobile parity stays invariant without an
  automatic all-device gate; cover RU/BE/UK/PL/EN where affected.
- For visible web UI changes, require browser verification, screenshot, and console check before final handoff.
- If an audit-only role finds a real issue, route it to implementation. The
  mandatory Code Reviewer/Fixer repairs its own confirmed in-scope findings
  directly, then re-reviews and revalidates before handoff.

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
- iOS Architect: `iOS Technical Design`
- iOS Developer: `iOS Implementation Summary`
- iOS Reviewer: `iOS Review and Repair`
- iOS Tester: `iOS QA Pass` or `Bug Report`
- iOS Release Operator: `iOS Release Report`
- Refactor Surgeon: `Refactor Summary`
- Programmer: `Implementation Summary`
- Backend Diagnostician: `Backend Diagnosis`
- Ticket Board: `Board Update`
- Browser Reviewer: `Browser Review Verdict`
- Mobile Tester: `Mobile QA Pass` or `Bug Report`
- QA Agent: `Bug Report` or `QA Pass`
- Sprint Reviewer: `Sprint Review`
- Production Smoke: `Production Smoke`
- Reviewer/Fixer: `Code Review and Repair`
- Security Reviewer: `Security Findings`
- Design Auditor: `Design Audit`
- Google Play Operator: `Google Play Release Report`
- Play Campaign Tester: `Closed Testing Daily Pass`
- DevOps Agent: `Deploy Report`

The orchestrator final answer should include the changed files, validation run, and remaining blockers or risks.
