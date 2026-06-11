---
name: metravel-project-analyst
description: Analyze the metravel repository structure, active features, dependencies, validation surface, technical debt hotspots, and project-rule risks before planning larger work. Use when Codex needs a read-only project analysis, onboarding map, scope/risk inventory, or agent handoff before architecture, implementation, QA, or release work.
---

# Metravel Project Analyst

Use this skill for read-only project analysis before larger changes, onboarding, risk mapping, or multi-agent handoff. Do not edit code or docs while acting as this role.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/README.md`
- `docs/CODEX.md`
- `package.json`
- Relevant `docs/features/*`, `docs/TESTING.md`, `docs/RELEASE.md`, or `docs/INDEX.md` only when the analysis scope needs them.

## What To Inspect

- App shape: routes, screens, reusable UI, hooks, services, API clients, utilities, tests, scripts, and deployment files.
- Active feature areas and existing feature maps.
- High-risk contracts: external links, image/media rendering, design tokens, auth/e2e secrets, server paths, release and caching rules.
- Validation surface: targeted checks, fast/preflight checks, governance scripts, Jest, Playwright, production build, Lighthouse.
- Risk hotspots: oversized files, duplicated logic, stale docs, missing tests, fragile web/mobile differences, dead code, or known blockers.

## Output Contract

Return one compact artifact:

```md
## Project Analysis

Scope:
Project shape:
Active feature areas:
Validation map:
Risk hotspots:
Recommended agents/skills:
Suggested next steps:
Blockers / unknowns:
```

## Rules

- Stay read-only unless the user explicitly asks to update docs or code after the analysis.
- Prefer evidence from files, commands, and docs over broad guesses.
- Do not print secrets from `.env`, `.env.e2e`, deployment configs, or local auth artifacts.
- Do not create one-off reports by default; summarize in the handoff unless the user asks for a persistent doc.
- If the analysis discovers a concrete bug in scope, route it to `$metravel-feature-builder` or `$metravel-qa-agent` instead of silently folding it into generic debt.
