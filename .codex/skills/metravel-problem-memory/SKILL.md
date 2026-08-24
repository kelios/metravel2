---
name: metravel-problem-memory
description: "Audit the metravel problem registry and full board before create/reopen/split/acceptance. Use for duplicates or recurring failures; returns reuse, reopen, create-linked, or create-new without mutating tickets."
---

# Metravel Problem Memory

Prevent repeated symptom fixes and duplicate board cards. Treat
`docs/PROBLEM_MEMORY.md` as the durable problem-family registry and the MCP task
board as the operational task/evidence history.

`AGENTS.md` is inherited. Read `docs/PROBLEM_MEMORY.md` and only the duplicate,
recurrence, or evidence sections needed from `docs/TASK_BOARD_MCP.md`; add
`$metravel-ticket-board` and `$metravel-task-contract` only for a subsequent
board mutation.

## Pre-create workflow

0. Prove the defect exists before touching history. A card filed against a
   measurement artifact costs more than a missed bug: it misroutes work and then
   lives in the registry as fact.
   - Output of your own script, parser, scan, or diff is a hypothesis. Confirm it
     a second, independent way: an existing project tool, a manual probe, a DB
     read, the browser.
   - Build the probe from the artifact as it appears in production — copy the URL,
     key, or line verbatim. A probe assembled from a value your own code derived
     confirms your parsing, not the defect (2026-08-04, #1253: a regex truncated
     `<hash>.JPG.webp` to `<hash>.JPG`, that form returned an honest `404`, and a
     P1 card was filed for 404 non-existent breakages).
   - Run a control on a position known to be healthy. A method that flags working
     things as broken is the thing that is broken.
   - Explain any disagreement with a standard project check (`sweep`, guards,
     `npm run seo:404`, post-deploy checks) before filing. An unexplained
     discrepancy means there is no finding yet.
   - Separate a real defect from a race or a cache: check `updated_at` of the
     affected rows, when you measured, and when static was last deployed.
   - Confirm scale separately from the fact. "Broken" and "broken in N places"
     are two claims; only the second-source number goes into the card.

   `not-a-defect` is a valid verdict. Return it instead of `create-*` and do not
   file a card "just in case".

1. Describe the candidate with six facts: symptom, invariant violated, affected
   surface, owning layer, endpoint/files, and target environment.
2. Search `docs/PROBLEM_MEMORY.md` by problem key, aliases, endpoint, file, and
   prior board ids.
3. Search the task board across every status, including `done` and `wont_do`.
   Fetch full descriptions for plausible matches; title-only matching is not
   sufficient. Do not trust `search` or `limit` unless the response proves they
   were applied; the current API may require a full-list plus detail reads.
4. Compare root cause and invariant, not only wording:
   - `not-a-defect`: the finding did not survive step 0 — measurement artifact,
     race with a parallel content edit, cache, or undeployed static;
   - `reuse`: the same work is already open; append evidence to that task;
   - `reopen`: the same confirmed root cause or previously accepted invariant
     failed again; move the canonical task back to `in_progress` and append a
     dated Recurrence Log entry;
   - `create-linked`: the symptom family matches but the confirmed root cause or
     corrective owner differs; create one task related to the canonical chain;
   - `create-new`: no material historical match exists.
5. Route mutations through `$metravel-ticket-board`. Never create a competing
   card while the canonical one is in `todo`, `in_progress`, `review`,
   `testing`, or `blocked_by`.
6. Update the registry only for a confirmed new family, changed root cause,
   recurrence, or new permanent control. Do not copy ordinary progress logs into
   docs.

## Recurrence evidence

When reopening or creating a linked recurrence, append this to the canonical
task description:

```md
## Recurrence Log — YYYY-MM-DD

Problem key:
Prior task/evidence:
Observed invariant failure:
Same or different root cause:
Why the previous Done gate did not prevent recurrence:
Corrective layer:
New regression control:
```

Do not claim an exact reopen count unless the board exposes immutable status
events. `created_at` and `updated_at` alone are not status history.

## Done-gate review

For a recurring family, require all of the following before `done`:

- the root cause is marked `confirmed`, or uncertainty and follow-up owner are
  explicit;
- the permanent invariant is tested at the layer where it failed;
- deploy/API/browser/device evidence covers the target named in the contract;
- the implementation commit is reachable from canonical `main`/`origin/main`
  when integration or publication is part of the task;
- workarounds have an owner and removal condition;
- the registry records the canonical task chain and new control.

## Output

Return this before any create/update:

```md
## Problem Memory Verdict

Candidate:
Problem key:
Finding verified by:       # two independent methods + control on a healthy case
Contradicting measurement: # disagreement with a standard check and how resolved
Historical matches:
Root-cause comparison:
Decision: not-a-defect | reuse | reopen | create-linked | create-new
Canonical task:
Required links:
Registry update:
```

Keep platform and localization impact explicit. Backend remains read-only from
this workspace; backend fixes are `area=back` tasks with runtime evidence.
