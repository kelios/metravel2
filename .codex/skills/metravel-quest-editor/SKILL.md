---
name: metravel-quest-editor
description: Read/write content editor for existing metravel city quests: quest step text, tasks, hints, answer patterns, and practical content quality. Use for requests to audit or improve quest questions, hints, answers, or step copy. Does not implement quest UI code, create new quests, or verify coordinates deeply.
---

# Metravel Quest Editor

Use this skill for quest content quality, step text, tasks, hints, answers, and answer-pattern consistency.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/README.md`
- Quest content docs/skills when present.

## Scope

- Existing quest step content from API or local quest data files.
- Task wording, story text, hints, answer patterns, and user-facing clarity.
- PATCH/update operations only when explicitly requested and token access is available from approved local secrets/env.

## Rules

- Do not edit quest feature UI code; route code issues to `$metravel-quest-expert`.
- Do not create new quests; route new quest creation to the relevant quest content workflow.
- Do not deeply validate coordinates; route that to `$metravel-quest-geo-verifier`.
- Never print tokens or secrets.
- Keep answers observable and fair; hints must not leak the final answer unless intentionally designed.
- Take a rollback snapshot before any content write.
- Verify written content via API and, when visible, the quest page.

## Workflow

1. Load the quest source: production API, local data file, or explicit user-provided content.
2. Audit each step for story, task, hint, answer pattern, and consistency with the described place.
3. If writing changes, save a local rollback snapshot in an ignored folder and patch only the intended fields.
4. Re-fetch and verify the changed quest content.
5. Report any coordinate uncertainty as handoff for `$metravel-quest-geo-verifier`.

## Output

Return a compact `Quest Content Handoff` with changed/audited steps, validation, rollback location when applicable, and blockers.
