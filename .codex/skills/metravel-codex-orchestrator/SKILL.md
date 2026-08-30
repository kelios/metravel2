---
name: metravel-codex-orchestrator
description: "Route broad or high-risk metravel work to the smallest set of skills, context, agents, and validation. Use for unclear multi-domain, cross-platform, production, release, or external-dependency tasks."
---

# Metravel Codex Orchestrator

Use only when one specialist skill is insufficient. `AGENTS.md` is inherited;
do not reread it. Use `docs/CODEX.md` as the compact router, then load only the
exact canonical headings and feature docs required by the chosen route.

## Triage

Return a compact internal route:

```text
Outcome and task-owned paths:
Primary skill:
Conditional skills/agents:
Platform/localization impact:
Authority and risk gates:
Context to load:
Validation/evidence:
Can proceed:
```

- Start with one primary skill.
- Add a skill only for a distinct responsibility: UI/i18n, test/browser/device,
  security, board, backend diagnosis, or deploy/release.
- Use a domain expert directly for travel/map/profile/achievements/quests.
- Use OpenSpec only for new features, contract changes, or genuinely complex/
  recurring work; implementation requires a separate apply request.
- Use multi-agent only when work is independently parallelizable or requires an
  independent QA/review boundary. Do not build a full role chain by default.

## Context discipline

- Never ask every role to read full `RULES.md`, `README.md`, and `CODEX.md`.
- Pass source scope, exact paths, raw diff/log/evidence, and only task-specific
  constraints. Workspace instructions are inherited.
- For a canonical rule, link an exact heading; load the full document only when
  the entire document is genuinely in scope.
- Keep researcher/QA/reviewer prompts neutral; do not pre-seed a desired verdict.

Compact role prompt:

```text
Use $<skill> for <scope>.
Owned paths/evidence: <files, diff, logs>.
Platform/localization impact: <values>.
Task-specific constraints: <only the delta>.
Output/validation: <artifact and checks>.
```

## Hard gates

- Frontend/app/docs only; backend working trees remain read-only.
- Preserve unrelated changes and protected-path rules.
- Production/store mutations require the exact current authorization and target.
- Apply the operation gate before build/deploy/full tests/e2e/Lighthouse/device
  install; runtime QA starts only after review in `testing` and never duplicates
  a live target process.
- Visible common UI: desktop + mobile-web browser evidence in `testing`. Native
  evidence only there for the corresponding platform-specific observable scope.
- Board mutation: Problem Memory → Task Contract → Ticket Board.
- After code changes, send the complete task diff and code-level validation to an
  independent `$metravel-code-reviewer`; reviewer fixes/rechecks code only, then
  hands observable QA to `testing`.

## Handoff

Report the chosen route, changed files, checks/evidence, deliberately excluded
scope, blockers, and residual risk. Do not dump repeated policy text or role
transcripts.
