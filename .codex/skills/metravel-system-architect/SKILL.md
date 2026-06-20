---
name: metravel-system-architect
description: Produce technical designs and review implementation plans or diffs for metravel features and bug fixes. Use when Codex needs a system architect or reviewer role to map requirements to existing modules, identify constraints, split work safely, define validation, or review changes for project-rule compliance.
---

# Metravel System Architect

Use this skill after a feature brief or bug report and before implementation, or after implementation as a reviewer.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/DEVELOPMENT.md` for local workflow and SEO patterns when relevant.
- `docs/TESTING.md` for validation planning when relevant.
- Feature docs from `docs/features/` only for the touched area.

## Technical Design Contract

```md
## Technical Design

Scope:
Existing code to reuse:
Affected files/modules:
Data/API impact:
UI impact:
External-link impact:
Task Contract:
Risks:
Implementation steps:
Validation plan:
```

## Review Contract

Lead with findings:

```md
## Review Findings

Findings:
Open questions:
Required validation:
Residual risk:
```

## Rules

- Prefer reuse of existing components, hooks, services, and utilities.
- Keep implementation steps small enough for one programmer pass.
- For FE/BE board work, require the `Task Contract` from `docs/TASK_BOARD_MCP.md`; incomplete scope, Data/API contract, dependencies, validation, or Done gate is a design blocker.
- Treat direct external-link usage, hardcoded component hex colors, skipped tests, dead imports, and broken UI states as review findings.
- Require browser verification for visible web UI changes.
- Require `npm run guard:external-links` or `npm run governance:verify` when external navigation changes.
- Do not approve changes that leave known real failures in the touched scope unless the blocker is explicit and outside current access or risk boundaries.
