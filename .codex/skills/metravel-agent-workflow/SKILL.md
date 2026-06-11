---
name: metravel-agent-workflow
description: Orchestrate a role-based metravel AI workflow across project analyst, business analyst, system architect, designer, Android developer, programmer, mobile tester, QA, reviewer, and DevOps agents. Use when Codex needs to split a metravel task into agent roles, run a bug-finding/fixing/deploy loop, or coordinate project analysis, discovery, implementation, mobile validation, review, and deploy without losing project rules.
---

# Metravel Agent Workflow

Use this skill to coordinate multiple role prompts or subagents for metravel work. Keep the workflow controlled: each role has a narrow output contract, code changes happen only in the implementation stage, and deploys happen only through the DevOps stage after explicit environment gating.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- Extra feature docs only when the task touches that area.

## Role Order

Default feature flow:

1. Project Analyst: use `$metravel-project-analyst` for broad or unclear scope to map structure, validation, risks, and next agents.
2. Business Analyst: produce a concise feature brief and acceptance criteria.
3. System Architect: map the brief to existing code, constraints, risk, and validation.
4. Designer: use `$metravel-ui-guardrails` for visible UI states and web/mobile behavior.
5. Android Developer: use `$metravel-android-developer` for Android/native implementation, crashes, platform files, or Expo native modules.
6. Programmer: use `$metravel-feature-builder` to implement the smallest sufficient diff.
7. Mobile Tester: use `$metravel-mobile-tester` for mobile web or Android/native QA evidence and retest.
8. QA Agent: use `$metravel-qa-agent` to test broader flows and create structured bug reports.
9. Reviewer: use `$metravel-system-architect` in review mode to check the diff, tests, and rule compliance.
10. DevOps Agent: use `$metravel-devops-agent` only when the user explicitly asks to deploy, build, release, or verify a deployment.

Default bug loop:

1. QA Agent explores the app and writes bug reports only.
2. Mobile Tester handles mobile-specific reproduction, device/emulator evidence, and retest when the bug is mobile web or Android/native.
3. Android Developer fixes confirmed Android/native bugs; Programmer fixes non-native feature bugs.
4. QA Agent or Mobile Tester re-tests the fixed scenario.
5. Reviewer checks the diff and validation.
6. DevOps Agent deploys/builds/releases only if the fix is approved and the user explicitly requested a target environment or mobile build.

## Control Rules

- Do not let exploratory QA or analyst roles edit code.
- Use Project Analyst only for read-only discovery unless the user explicitly asks to update docs or code after the analysis.
- Keep Mobile Tester read-only unless the user explicitly asks to update tests.
- Do not let Android Developer change mobile release/build configs without explicit user approval.
- Do not let implementation start from vague requirements; require acceptance criteria or a bug report first.
- Do not deploy production from vague wording; require an explicit `prod` deploy request and a clean environment gate.
- Keep unrelated user changes separate; never revert files outside the task.
- Preserve project rules for external links, design tokens, e2e secrets, server paths, and scope-based validation.
- For visible web UI changes, require browser verification, screenshot, and console check before final handoff.
- If a role finds a real issue in the touched scope, route it to implementation before handoff unless it is explicitly blocked.

## Handoff Format

Each role should return one compact artifact:

- Business Analyst: `Feature Brief`
- Project Analyst: `Project Analysis`
- System Architect: `Technical Design`
- Designer: `UI Contract`
- Android Developer: `Android Implementation Summary`
- Programmer: `Implementation Summary`
- Mobile Tester: `Mobile QA Pass` or `Bug Report`
- QA Agent: `Bug Report` or `QA Pass`
- Reviewer: `Review Findings`
- DevOps Agent: `Deploy Report`

The orchestrator final answer should include the changed files, validation run, and remaining blockers or risks.
