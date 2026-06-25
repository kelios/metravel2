---
name: metravel-travel-expert
description: Expert for metravel travel list, travel details, wizard, author cards, route points, and export/PDF flows. Use for work in `components/travel/**`, `components/listTravel/**`, `app/travel/**`, `app/(tabs)/travel*`, `hooks/useTravel*`, `api/travel/**`, `utils/travelDetails*`, or `stores/*travel*`.
---

# Metravel Travel Expert

Use this skill before implementation when the task is specifically about travel lists, details, editing/wizard, route points, author cards, moderation/save behavior, or travel export/PDF.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/README.md`
- `docs/TRAVEL_SAVE_MODERATION_CONTRACT.md` for travel creation/edit/save/moderation work.
- `docs/features/travel.md` when it exists.

## Scope

- `components/travel/**`, `components/listTravel/**`, `components/travel/details/**`
- `app/(tabs)/travel*`, `app/travel/**`
- `hooks/useTravel*`, `utils/travelDetails*`
- `api/travel/**` and related TanStack Query hooks
- travel-related stores and route point/photo flows

## Rules

- Preserve `UnifiedTravelCard` for travel cards and `ImageCardMedia` for feature images.
- Preserve save != moderate: autosave/content save must not be blocked by moderation completeness validation.
- Keep travel media photorealistic and real-source compliant; do not replace published travel media with SVG, screenshots, cartoons, or placeholders.
- Keep server state in React Query and client state in Zustand.
- Keep external links behind `utils/externalLinks.ts`.
- Do not add new `any` in `api/`, `hooks/`, or stores.
- If a board ticket id is part of the task, update only that ticket: `in_progress` at start, `review` with evidence at handoff; do not move it to `done`.

## Workflow

1. Read the touched travel component/hook/API file and nearby tests.
2. Check whether props, query keys, stores, or DTO mappers are shared with details, wizard, cards, and profile/author embeddings.
3. For visible UI changes, pair with `$metravel-ui-guardrails` or `$metravel-browser-reviewer`.
4. For large component splits, use `$metravel-refactor-surgeon`.
5. Validate with the narrowest reliable checks; use `npm run check:fast` for a finished local block and targeted tests when available.

## Output

Return a compact `Travel Expert Handoff` with affected surfaces, key constraints, validation run, and remaining blockers.
