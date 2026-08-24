---
name: metravel-agent-workflow
description: "Coordinate a small role-based metravel workflow when analysis, implementation, platform work, QA, review, or release must be separated. Use only for genuinely multi-role tasks or controlled bug/release loops."
---

# Metravel Agent Workflow

Do not use for docs-only work, one isolated bugfix/refactor, a single check or
board update, or read-only analysis without a downstream handoff. `AGENTS.md` is
inherited; use `docs/CODEX.md` for routing and load only task-specific references.

## Build the smallest chain

Choose only stages that produce an artifact consumed by the next stage:

1. Discovery: project/business analyst only for unclear requirements or broad
   repository scope.
2. Design: system architect/domain expert/UI/i18n only for affected contracts.
3. Implementation: one owning domain/feature/native skill.
4. Validation: browser/mobile/QA skill only for the observable target.
5. Review: `$metravel-code-reviewer` after code changes, preferably independent.
6. Operations: board, deploy, production smoke, or store operator only when that
   external stage is explicitly in scope.

Never launch the full chain by default. Domain skills own travel/map/profile/
achievements/quests; Android and iOS roles own only their platform-specific
surface. Backend diagnosis is read-only.

## Role contract

Each role receives:

```text
Role/skill and one bounded objective:
Owned paths or raw evidence:
Platform/localization impact:
Task-specific constraints and authority:
Expected artifact:
Validation or handoff consumer:
```

Do not paste global project rules into role prompts. Analysts/QA/audit roles are
read-only unless their selected skill explicitly owns fixes. Keep unrelated
worktree changes outside every role's ownership.

## Control gates

- No frontend role edits backend/Django/server working trees.
- Production/store mutations require exact target authorization; each iOS stage
  is separate and Android EAS remains prohibited.
- Apply operation coordination before build/deploy/full tests/e2e/Lighthouse/
  device install. Do not duplicate an active target or treat `SKIPPED` as pass.
- Board work uses Problem Memory → Task Contract → Ticket Board. `blocked_by` is
  only a hard implementation dependency; `testing` is active QA or an exact
  recheck, never parking.
- Visible common UI requires desktop and mobile-web evidence. Android/iPhone
  evidence is added only for corresponding platform-specific behavior/runtime.
- Reviewer gets the original task, complete task diff, task-owned paths, and raw
  validation. It fixes confirmed in-scope findings, re-reviews, and revalidates.

## Bug loop

Use only the needed roles: reproduce with evidence → owning implementer fixes →
same observable layer retests → independent reviewer repairs/revalidates. Add
deploy/release only after a separate explicit request.

## Handoff

Return one compact artifact per role. The final coordinator reports artifacts
consumed, changed files, checks, unresolved blockers, and residual risk; omit
role transcripts and repeated policy text.
