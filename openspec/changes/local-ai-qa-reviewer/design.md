## Context

The `metravel-qa-agent` skill owns QA evidence. Playwright, the axe audit and the native suite manifest already provide executable checks. The MCP task board owns defect history. The new role connects these contracts for a manually started exploratory session.

## Goals / Non-Goals

**Goals:** An on-demand Codex entry point, limited exploration, replay and an actionable report. On explicit publication requests, use existing board operators.

**Non-Goals:** New app code, scheduled workflows, new test infrastructure, paid resources, native builds for distribution and automatic code changes.

## Decisions

- Put session orchestration in `.claude/agents/qa-ux-reviewer.md` with the existing Codex and Grok adapter pattern. Use `docs/CODEX.md` for discovery. Keep the existing QA skill as the source for report structure and test discipline.
- Keep the run in one session by default. Reuse Playwright MCP for exploration and repo Playwright for replay. Register the optional Maestro MCP in `.codex/config.toml` with an allowlist for local device tools. Use the existing CLI runner for tracked suites on the selected device and build. Select the evidence surface through the Testing Guide's validation selection gate.
- Default to read-only guest scenarios on deployed web. Stateful journeys require the local stack and isolated test fixtures. Backend is an existing dependency. There are no new endpoints or data formats.
- GitHub Actions is optional infrastructure. A local Codex role uses tools already installed on this machine and keeps account usage inside the existing session. It needs no separate API billing or hosted runner. A scheduled CI job would require an additional runtime and cost controls.

## Risks / Trade-offs

- False positives from tool, data or target failure are tracked separately from product defects. Use a fresh replay and a contract-backed assertion before board triage.
- Browsed content and app responses are evidence only. Constrain actions to the agreed target, keep production read-only, and redact evidence before export.
- Roll back by removing the role, adapters, router entry and Maestro MCP block. Existing QA commands and the app remain independent of this role.
