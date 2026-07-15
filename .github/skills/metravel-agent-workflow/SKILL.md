---
name: metravel-agent-workflow
description: Orchestrate a role-based metravel AI workflow across business analyst, system architect, designer, programmer, QA, reviewer, and DevOps agents. Use when Codex needs to split a metravel task into agent roles, run a bug-finding/fixing/deploy loop, or coordinate feature discovery, implementation, validation, review, and deploy without losing project rules.
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

1. Business Analyst: produce a concise feature brief and acceptance criteria.
2. System Architect: map the brief to existing code, constraints, web/Android/iOS
   and RU/BE/UK/PL/EN impact, risk, and validation.
3. Designer: use `$metravel-ui-guardrails` for visible UI states and web/mobile
   behavior; add `$metravel-i18n-guardrails` for localization impact.
4. Programmer: use `$metravel-feature-builder` to implement the smallest sufficient diff.
5. QA Agent: use `$metravel-qa-agent` to test and create structured bug reports.
6. Reviewer: use `$metravel-system-architect` in review mode to check the diff, tests, and rule compliance.
7. DevOps Agent: use `$metravel-devops-agent` only when the user explicitly asks to deploy or verify a deployment.

Default bug loop:

1. QA Agent explores the app and writes bug reports only.
2. Programmer fixes one confirmed bug report at a time.
3. QA Agent re-tests the fixed scenario.
4. Reviewer checks the diff and validation.
5. DevOps Agent deploys only if the bug fix is approved and the user explicitly requested a target environment.

## Control Rules

- Do not let exploratory QA or analyst roles edit code.
- Do not let implementation start from vague requirements; require acceptance criteria or a bug report first.
- Do not deploy production from vague wording; require an explicit `prod` deploy request and a clean environment gate.
- Keep unrelated user changes separate; never revert files outside the task.
- Preserve project rules for external links, design tokens, e2e secrets, server paths, and scope-based validation.
- Require every handoff to state platform and localization impact; unavailable
  native evidence remains `verify pending`, not an inferred pass.
- For visible web UI changes, require browser verification, screenshot, and console check before final handoff.
- If a role finds a real issue in the touched scope, route it to implementation before handoff unless it is explicitly blocked.

## Handoff Format

Each role should return one compact artifact:

- Business Analyst: `Feature Brief`
- System Architect: `Technical Design`
- Designer: `UI Contract`
- Programmer: `Implementation Summary`
- QA Agent: `Bug Report` or `QA Pass`
- Reviewer: `Review Findings`
- DevOps Agent: `Deploy Report`

The orchestrator final answer should include the changed files, validation run, and remaining blockers or risks.
