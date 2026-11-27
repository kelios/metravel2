---
name: metravel-local-apprentice
description: "Assign bounded real MeTravel work to a selected local model, inspect its edits and tool evidence, grade the unassisted result, and finish useful work under a teacher. Use for supervised code/test repairs, translation drafts or FLUX quest-cover trials."
---

# MeTravel Local Apprentice

Use this skill when a teacher delegates useful project work to the installed
local agent and must distinguish the student's contribution from the accepted
result. `AGENTS.md` is inherited; this skill does not grant extra tool access or
publication authority. The student role is
`.claude/agents/local-model-apprentice.md`.

## Select real work

Read the full board card, current source and relevant domain contract. Use
`metravel-problem-memory`, `metravel-task-contract` and `metravel-ticket-board`
for board changes. Keep the existing product card canonical; a separate
supervision card records the trial and links to it, without duplicating its
implementation or marking the product card done early.

Choose a small task whose failure and success can be checked independently:

| Work | Student assignment | Teacher acceptance |
| --- | --- | --- |
| Run tests | An exact existing command and expected suite; capture exit/counts | Verify actual command, nonzero test count and assertions; apply operation gates |
| Repair a failure | Reproduce, explain mechanism, edit named source paths, rerun | Establish intended behavior separately; inspect full diff and regression |
| Change a test | Only a demonstrated stale expectation or newly required behavior | Verify against the current contract; never accept weaker assertions just for green |
| Quest translation | One complete quest/locale through `quest-translator` | Canonical structural checks and a fresh independent semantic reviewer |
| Quest-cover draft | One real quest brief and local FLUX call | Owning visual skill, actual PNG, route/age/style/content and authority checks |

Do not start with broad refactors, auth, secrets, schema migration, release or
unbounded production changes. An active task belongs to its current executor;
coordinate before touching it. A high-risk card can yield a bounded read-only
analysis assignment, not implied authority to implement the whole card.

## Prepare and run

Write a compact assignment using [references/assignment-and-grade.md](references/assignment-and-grade.md).
Freeze the source revision, pre-existing changes, expected behavior and test
baseline before handing it to the student. Name exact writable paths and protected
tests; do not bake the proposed fix into the first attempt.

For code/tests add the nearest owning skill (`metravel-feature-builder`,
`metravel-test-runner` or `metravel-test-writer`) as needed. For translations
use `.claude/agents/quest-translator.md` and the complete translation guide.
For covers use `metravel-child-quest-visuals` when age-specific, otherwise the
owning quest/media skill and its approved art brief. Never substitute generic
landmarks for the real quest or infer visual correctness from a model's text.
Confirm a real art need before assigning generation: do not replace a healthy
published cover to create an exercise. A useful unrequested variant stays a
clearly labelled draft; it is not evidence that the existing cover is defective.

Launch a supervised attempt through `.aiassistant/universal/student.py` with an
assignment file, `--kind code|cover` and `--backend current|coder|gemma`. This
bounded profile keeps instruction discovery and board reads, disables the Task
role catalog and board writes, and enables FLUX only for covers. The full
PhpStorm ACP profile remains separate. Save the exact prompt and raw events in an ignored
task directory. Tool results must show the actual edits, commands and saved
assets. Record the selected backend and actual model; a nominal role name is not
proof of which model ran. Keep inference local. The supervisor must not start
a second heavy inference while the selected local model or FLUX is
using this machine.

The wrapper sends the assignment over stdin, not process arguments. Alternate
backends must already be running on their selected loopback ports under the
teacher's serialized control; it never silently falls back or starts a second
candidate. `current` reuses the normal Qwen service readiness guard.

Stay within the measured context budget: read the chosen files and instructions
on demand, not all skills or the whole repository. A denied/unavailable tool is
an explicit limitation, not permission to bypass a hook or invent its result.

## Browser QA assignments

Load [the browser QA reference](references/browser-qa.md) for a website-testing
assignment. Use its separate browser profile, actual action/image evidence and
coverage limits; the ordinary coding profile does not acquire browser tools.

## Inspect, teach and deliver

1. Preserve the student's first complete output and diff before teacher edits.
   Record failures and attempted commands even when a later attempt succeeds.
2. Inspect every changed file and the actual check output. Distinguish a code
   defect, stale test, environment failure and a flaw in the evaluation method.
   Independently confirm consequential facts and visual assets.
3. Grade the unassisted result before giving hints. Log each hint, attempt and
   teacher correction; a teacher-repaired result does not raise the first score.
4. Give a bounded corrective instruction when useful. If the student cannot
   finish, the teacher fixes the useful work and verifies it. Do not discard a
   useful draft or leave a known defect merely to preserve an evaluation.
5. Follow the existing review → Git/push → testing/deploy → acceptance flow
   for the actual product task. Content publication follows its own canonical
   pipeline; ignored translation artifacts are not fake Git changes. Code and
   content gates still apply after teacher corrections.
6. Update the supervision card with the student's grade, teacher changes,
   accepted artifact/revision, evidence and remaining product work. A failed
   trial can be fully evaluated while the parent product card remains open.

The earlier complete Qwen3.8 RU→PL quest trial failed structural and semantic checks;
that is evidence about that case, not a language-wide benchmark. Do not grant
translation autopublication or deployment autonomy from a configuration check,
one passing fixture, a numeric score or a self-review. Client permissions and
prompts are not a general shell/credential sandbox.

Report: task and real model/runtime; first score and assistance level; student
edits/checks; teacher corrections; final acceptance/publication; exact remaining
limits and next useful assignment.
