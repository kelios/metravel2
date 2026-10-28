---
name: metravel-agent-workflow
description: "Coordinate necessary independent metravel roles with bounded handoffs and one user outcome. Use for genuinely multi-role implementation, review, QA or release work."
---

# Metravel Agent Workflow

Do not use for an isolated check, board update, docs edit or read-only question
without a real handoff. `AGENTS.md` is inherited. Scope and checkpoints follow
`docs/RULES.md` → «Outcome-bound scope and effort».

## Smallest useful chain

Start with one owning specialist. Add a role only when its decision or artifact
is needed by another stage: unresolved requirements, a design/boundary decision,
separate platform work, independent review, or target-specific QA/operations.
Do not launch BA → designer → architect → developer → QA by default.

After code changes preserve the required independent review-and-fix/gate.
Review is code-only; runtime QA starts after reviewed publication enters testing.
Existing authority covers the normal frontend release pipeline; independent
store-stage permissions remain unchanged.

## Role brief

```text
Original user outcome and acceptance criterion:
One bounded objective and owned paths:
Raw evidence/artifact paths and smallest next probe:
Platform/localization impact; task-specific authority:
Expected artifact and its consumer:
```

Prefer an independent, compact context over a full-history fork. Do not copy
inherited rules, give a desired verdict, or ask multiple roles to reread the same
sources. Return one concise artifact; acknowledgements do not need a new turn.

## Coordinate without changing the goal

- Separate supporting checks and release blockers from product acceptance.
  Board status/test counts never prove a different reported metric.
- Use the canonical hypothesis/effort checkpoint before adding another branch.
  Estimate each fix's contribution, including a bounded combination when needed;
  an insufficient benefit for that stated contribution ends the experiment.
- One owner per task/operation; respect active locks. `SKIPPED` is not pass.
  Request a precise result/handoff once; do not poll or retry the same blocked
  command. Reuse compatible evidence under `docs/TESTING.md` → «Risk-based
  validation and evidence reuse».
- Backend/source and production mutations stay within inherited exact authority.
  Do not use coordination to take over unrelated work or loosen a guard.
- A failed experiment produces preserved evidence and a revised decision, not an
  automatic new review/deploy cycle on another speculative candidate.

The coordinator reports the user's achieved result, commands/evidence, changed
paths and concrete unresolved work. Do not report the role transcript.
