---
name: metravel-codex-orchestrator
description: "Route broad or high-risk metravel work to the smallest necessary skills, agents and evidence while preserving the user's outcome."
---

# Metravel Codex Orchestrator

Use only when one specialist cannot handle the task reliably. `AGENTS.md` is
inherited. Follow `docs/RULES.md` → «Outcome-bound scope and effort»; use only
matching headings in `docs/CODEX.md` and the owning feature contract.

## Triage

Keep one compact decision record:

```text
User outcome, acceptance source and initial evidence:
Owned repository/paths; platform/localization impact:
Primary skill; distinct decision each extra role will produce:
Smallest causal probe and expected useful result:
Authority, operation gates and separate release blockers:
```

Start with the domain specialist. Add UI/design, architecture, platform, board or
operations only for an actual responsibility; a production target does not
require a full role chain. Independent code review remains mandatory.
Before validation dispatch or target prerequisites, use `docs/TESTING.md` →
«Validation selection gate» to select the necessary targets and evidence reuse.
OpenSpec follows `docs/RULES.md` → «Development workflow»: a direct fix request
already authorizes necessary proposal → apply; planning-only stays planning.

## Control the work

- Keep the original acceptance criterion visible in every handoff. Do not replace
  it with test counts, a smaller diff or a convenient proxy metric.
- Before code, connect the proposed change to the observed mechanism. Before a
  costly experiment, estimate its causal contribution, individually or as part
  of a bounded combination; discard insufficient experiments.
- At the canonical checkpoint, reassess the next probe instead of spawning more
  researchers or silently adopting a neighboring task. A release blocker has
  its own owner/evidence and does not redefine product success.
- For an independent subtask, send the original request plus a compact brief and
  artifact paths; avoid a full-history fork. Reuse a role only for new necessary
  work, not status acknowledgements or duplicate source reading.
- Filter large connector/log results before output. Use a saved ignored artifact
  and compact thread snapshots rather than repeated full-board/history reads.

## Authority and handoff

Inherited repository ownership, frontend/backend boundaries, operation locks,
review/testing separation and exact store-stage gates remain binding. Honor
existing authorization; do not introduce a second approval for an already
allowed frontend pipeline step or weaken a required guard to unblock it.

Review receives the complete task diff and raw code-level evidence; runtime QA
starts in testing and proves the original observable contract on its target.
Report achieved outcome, supporting checks, excluded scope and exact remaining
blocker. If the requested result is unproved, state it explicitly.
