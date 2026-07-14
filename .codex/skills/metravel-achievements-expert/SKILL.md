---
name: metravel-achievements-expert
description: Expert for metravel achievements, badge authoring and audits, ranks, XP progress, peer badge toggles, achievement mocks, and profile/author integrations. Use for `api/achievements.ts`, `api/achievementsMock.ts`, `hooks/useAchievementsApi.ts`, `components/achievements/**`, `__tests__/achievements/**`, new badge definitions/media, full achievement UI audits, and embeds in profile, public user pages, or AuthorCard.
---

# Metravel Achievements Expert

Use this skill for achievements/badges/ranks/XP/peer badge behavior and visuals.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/README.md`
- Achievement feature docs when present.

## Scope

- `api/achievements.ts`, `api/achievementsMock.ts`, `api/queryKeys.ts`
- `hooks/useAchievementsApi.ts`
- `components/achievements/**`
- `__tests__/achievements/**`
- Embeds in `app/(tabs)/profile.tsx`, `app/(tabs)/user/[id].tsx`, and `components/travel/AuthorCard.tsx`

## Rules

- Treat `api/achievements.ts` as the backend contract source for frontend types and DTO mapping.
- Keep mock fallback explicit through `EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true` or documented dev fallback only.
- Keep peer badge mutations optimistic but rollback-safe.
- Use `ImageCardMedia` for badge images; do not invent fake image URLs.
- Do not duplicate server state in Zustand.
- Do not add new `any` in `api/` or `hooks/`.
- Backend contract gaps become board tasks, not frontend assumptions.
- For a new badge, define stable id/code, title, concise earned-state description, measurable unlock rule, rarity/category, and a real media plan. Do not invent a fake backend id or URL.
- Route generated badge art through `$metravel-visual-asset-designer`; keep backend persistence/upload as an explicit contract or board dependency.
- If a board ticket id is part of the task, update only that ticket: `in_progress` at start, `review` with evidence at handoff; do not move it to `done`.

## Workflow

1. Read achievement types, mappers, hooks, visuals, and nearby tests before editing.
2. If a type changes, check mappers, mocks, hooks, and all consumers.
3. If visuals change, check `badgeVisuals` and visual tests.
4. For visible UI, verify profile, public profile, and AuthorCard states.
5. Validate with targeted achievement tests and `npm run check:fast` for a finished local block.

For a full audit, verify rank/XP states, badge grid/detail, peer toggle rollback, empty/loading/error states, mock-vs-live behavior, profile/public-profile/AuthorCard integration, mobile layout, browser console, and relevant network requests.

## Output

Return a compact `Achievements Expert Handoff` with contract changes, UI impact, validation, and blockers.
