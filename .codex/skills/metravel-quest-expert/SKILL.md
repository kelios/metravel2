---
name: metravel-quest-expert
description: >-
  Expert for metravel quest feature code: quest list/detail, wizard, step cards, maps, printing,
  quest API adapters, and migration scripts. Use for components/quests, quest app routes,
  api/quests.ts, utils/questAdapters.ts, hooks/useQuestsApi.ts, or scripts matching *quest*.
---

# Metravel Quest Expert

Use this skill for quest feature code, quest rendering, quest API contracts, answer checking, maps, print views, and quest migration scripts.

`AGENTS.md` is inherited. Load the matching quest feature contract and only the
API/UI/media/content-authority heading implicated by the task.

## Scope

- `components/quests/**`
- `app/(tabs)/quests/**`
- `api/quests.ts`
- `utils/questAdapters.ts`
- `hooks/useQuestsApi.ts`
- `scripts/*quest*` when the task is explicitly quest data/migration work

## Rules

- Keep quest code fixes separate from quest content editing and geochecking.
- Route new quest research and authored content to `$metravel-quest-writer`.
- Preserve `ApiQuest*` types, `adaptStep`, and `buildAnswerChecker` behavior unless the task explicitly changes the quest contract.
- Keep answer normalization stable: lowercase, space collapse, punctuation handling, and `ё` to `е` where currently used.
- Use `ImageCardMedia` for quest feature images and centralized external link helpers.
- Do not add new `any` in `api/` or `hooks/`.
- If a board ticket id is part of the task, update only that ticket: `in_progress` at start, `review` with evidence at handoff; do not move it to `done`.

## Workflow

1. Read the touched quest component/hook/adapter and nearby tests.
2. Check whether prop/type changes affect wizard, printable view, full map, and mobile layout.
3. Route new quest authoring to `$metravel-quest-writer` and existing content quality work to `$metravel-quest-editor`.
4. Route coordinate validation to `$metravel-quest-geo-verifier`.
5. Before review, validate with targeted quest code-level tests/checks; visible
   quest browser evidence is collected only in `testing`.

## Output

Return a compact `Quest Expert Handoff` with feature-code impact, validation, and blockers.
