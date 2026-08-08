---
name: metravel-quest-playthrough-reviewer
description: >-
  Analyze a concrete metravel quest playthrough from a Django QuestProgress admin URL or progress ID,
  correlate the player's submitted QuestAnswerAttempt history with the production quest steps, explain
  where and why the player struggled or stopped, and route or apply only evidence-backed answer-pattern
  and quest-content fixes. Use for requests such as "why did this player stop", "what answers did they
  enter", "review progress 245", repeated rejected answers, hint friction, or abandonment at a quest step.
---

# Metravel Quest Playthrough Reviewer

Review one real playthrough before changing the quest. Separate observed facts from hypotheses and never
turn a missing answer into an invented content defect.

Read first:

- `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, and `docs/README.md`.
- `docs/QUEST_ANSWER_INSIGHTS.md` for aggregate friction and privacy rules.
- `$metravel-quest-editor` before preparing or applying a content fix.
- The Browser skill when the input is a production admin URL; prefer the existing authenticated session
  and do not expose user email, session keys, tokens, or unrelated admin data.

Record `Platform impact: none` and `Localization impact: selected locale` for a read-only review. Reassess
both if the diagnosis expands into frontend code or localized app UI.

## Evidence workflow

1. Open the exact `QuestProgress` record read-only. Capture the quest ID, progress timestamps, completion
   state, current/unlocked indices, saved answers, legacy attempt counters, and shown-hint flags. Report the
   progress ID, not the player's email.
2. Load the matching `QuestAnswerAttempt` records. Correlate by quest, user when present, answer sequence,
   time window, platform, locale, and a single session key. Require at least two matching signals; if more
   than one session fits, mark the attempt history as ambiguous instead of guessing.
   A null/`—` user on earlier attempts is compatible with a guest-to-login handoff, not a conflicting
   identity. A shared session plus the exact saved-answer sequence and timestamps may attribute those
   anonymous attempts to the progress record.
3. Build the ordered timeline with `step_key`, raw answer when privacy rules allow it, verdict, attempt
   number, hint state, elapsed time, platform, and locale. Treat this append-only log as authoritative for
   submitted attempts; `QuestProgress.attempts` is legacy state and may remain zero.
4. Fetch the current production quest bundle and map saved answer keys to ordered steps. Identify the next
   unresolved step from the keys, not from the numeric index alone. Inspect its `story`, `task`, `hint`,
   `answer_pattern`, coordinates, and predecessor transition. Do not finish with only an index when the
   production bundle is available; report the exact next `step_id`.
5. Run aggregate support for the same quest:

   ```bash
   npm run quest:insights -- --quest <id> --since 365d --min-count 1
   ```

   Use `--min-count 1` to explain this player, but require the normal multi-player evidence from
   `docs/QUEST_ANSWER_INSIGHTS.md` before generalizing a one-person misunderstanding.

## Diagnosis rules

- Three rejected submissions are a review trigger, not automatic proof that the quest is wrong.
- A correct, independently verified observable answer rejected by the checker is a strong defect even for
  one player. Add only the missing morphological, synonym, or transliteration variants to
  `answer_pattern`.
- Repeated semantically different answers usually mean the task points players toward the wrong concept.
  Propose a task/hint clarification; do not accept a factually wrong answer just because it is frequent.
- A checker that rejects an already configured accepted variant is a quest-code defect: hand off to
  `$metravel-quest-expert` instead of patching content.
- Zero submitted attempts on the next unresolved step means `drop-off before answer submission`. Inspect
  the transition, route, access, timing, and aggregate abandonment, but do not claim an answer or wording
  problem without a second signal.
- Aggregate answer stats cannot count a step that was merely opened without a submission. When
  `QuestProgress` points at that step but `players_reached` is zero, report the instrumentation gap instead
  of reading the aggregate zero as proof that nobody reached it.
- Free-response `any` and `any_text` raw input is intentionally not stored. Report that privacy boundary;
  never infer or reconstruct the missing text.
- One player's wrong guesses do not justify widening a dictionary. Require another player, an independent
  onsite/source verification, or an objective task/pattern mismatch.

## Fix gate

- Keep the review read-only unless the user explicitly asks to correct the confirmed issue.
- An explicit request to fix may authorize an `answer_pattern` correction after the evidence threshold is
  met. Before writing or creatively changing `task`, `hint`, `story`, or another authored quest text, ask
  the separate confirmation required by `AGENTS.md`, even when the initial request sounded direct.
- Use `$metravel-quest-editor` for the write: save a rollback snapshot in an ignored folder, patch only the
  intended fields, re-fetch the production bundle, and verify the quest page when visible.
- Validate the previous rejected input, the canonical answer, and a negative input with the real answer
  checker. A broadened pattern must not accept a factually wrong answer.
- Do not edit backend/Django code from this workspace and do not retroactively alter player progress.

Example: if a player solved steps 1–3 on the first try and has no attempt for step 4, report an unclassified
drop-off at step 4. Do not rewrite step 4 or say the player answered it incorrectly.

## Output

Return a compact `Quest Playthrough Review`:

- progress and quest identifiers, platform, locale, and time window;
- ordered attempt timeline and the exact drop-off step;
- observed facts, diagnosis, confidence, and competing explanations;
- individual evidence versus aggregate evidence;
- `no change`, `answer_pattern fix`, `content clarification pending confirmation`, `code handoff`, or
  `instrumentation gap`;
- changed fields, rollback location, and post-write validation when a fix was authorized.
