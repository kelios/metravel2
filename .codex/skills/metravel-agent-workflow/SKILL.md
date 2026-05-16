---
name: metravel-agent-workflow
description: Orchestrate a role-based metravel AI workflow across business analyst, system architect, designer, programmer, QA, and reviewer agents. Use when Codex needs to split a metravel task into agent roles, run a bug-finding/fixing loop, or coordinate feature discovery, implementation, validation, and review without losing project rules.
---

# Metravel Agent Workflow

Use this skill to coordinate multiple role prompts or subagents for metravel work. Keep the workflow controlled: each role has a narrow output contract, and code changes happen only in the implementation stage.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- Extra feature docs only when the task touches that area.

## Role Order

Default feature flow:

1. Business Analyst: produce a concise feature brief and acceptance criteria.
2. System Architect: map the brief to existing code, constraints, risk, and validation.
3. Designer: use `$metravel-ui-guardrails` for visible UI states and web/mobile behavior.
4. Programmer: use `$metravel-feature-builder` to implement the smallest sufficient diff.
5. QA Agent: use `$metravel-qa-agent` to test and create structured bug reports.
6. Reviewer: use `$metravel-system-architect` in review mode to check the diff, tests, and rule compliance.

Default bug loop:

1. QA Agent explores the app and writes bug reports only.
2. Programmer fixes one confirmed bug report at a time.
3. QA Agent re-tests the fixed scenario.
4. Reviewer checks the diff and validation.

## Control Rules

- Do not let exploratory QA or analyst roles edit code.
- Do not let implementation start from vague requirements; require acceptance criteria or a bug report first.
- Keep unrelated user changes separate; never revert files outside the task.
- Preserve project rules for external links, design tokens, e2e secrets, server paths, and scope-based validation.
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

The orchestrator final answer should include the changed files, validation run, and remaining blockers or risks.
