---
name: metravel-quest-editor
description: >-
  Read/write content editor for existing metravel city quests: quest step text, tasks, hints, answer
  patterns, age fit, story continuity, and practical content quality. Use for requests to audit or improve
  quest questions, hints, answers, step copy, or an existing children's quest. Does not implement quest UI
  code, create new quests, or verify coordinates deeply; route new authoring and substantial story/route
  rewrites to $metravel-quest-writer.
---

# Metravel Quest Editor

Use this skill for quest content quality, step text, tasks, hints, answers, and answer-pattern consistency.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/README.md`
- Quest content docs/skills when present.
- `../metravel-quest-writer/references/child-quest-design.md` when the audience includes children or families.
- `$metravel-child-quest-visuals` when the requested edit also changes a child/teen cover or image prompt.

## Scope

- Existing quest step content from API or local quest data files.
- Task wording, story text, hints, answer patterns, and user-facing clarity.
- PATCH/update operations only when explicitly requested and token access is available from approved local secrets/env.

## Rules

- Do not edit quest feature UI code; route code issues to `$metravel-quest-expert`.
- Do not create new quests; route new quest creation to `$metravel-quest-writer`.
- Do not patch a structurally weak child quest step by step when its age band is missing, its climax occurs before the last core step, or its route needs replacement; return a rewrite handoff to `$metravel-quest-writer`.
- Do not deeply validate coordinates; route that to `$metravel-quest-geo-verifier`.
- Never print tokens or secrets.
- Keep answers observable and fair; hints must not leak the final answer unless intentionally designed.
- Take a rollback snapshot before any content write.
- Verify written content via API and, when visible, the quest page.

## Workflow

1. Load the quest source: production API, local data file, or explicit user-provided content.
2. Audit each step for story, task, hint, answer pattern, and consistency with the described place. For child/family quests, also audit the declared age band, reading load, agency, escalation, final meta-payoff, safe route, adult role, and vocabulary: remove material/architecture jargon from tasks unless it is taught and essential.
3. If writing changes, save a local rollback snapshot in an ignored folder and patch only the intended fields.
4. Re-fetch and verify the changed quest content.
5. Report any coordinate uncertainty as handoff for `$metravel-quest-geo-verifier`.

## Output

Return a compact `Quest Content Handoff` with changed/audited steps, age profile when relevant, validation, rollback location when applicable, and blockers. State explicitly when the quest needs a full writer-led story or route rewrite.
