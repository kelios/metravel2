---
name: metravel-profile-expert
description: Expert for metravel user profile, public profile, settings, subscriptions, profile tabs, counters, avatar/profile forms, and embedded profile features. Use for `app/(tabs)/profile.tsx`, `app/(tabs)/user/[id].tsx`, `app/(tabs)/settings.tsx`, `components/profile/**`, `components/screens/profile/**`, `components/settings/**`, profile hooks, and profile API flows.
---

# Metravel Profile Expert

Use this skill for profile, public user pages, settings, subscriptions, contact/trust surfaces, and feature embeddings in profile.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/README.md`
- `docs/features/user.md` when relevant.

## Scope

- `app/(tabs)/profile.tsx`, `app/(tabs)/user/[id].tsx`, `app/(tabs)/settings.tsx`
- `components/profile/**`, `components/screens/profile/**`, `components/settings/**`
- `hooks/useUserProfile*`, `hooks/useMyTravels`, `hooks/useSubscriptionsData`, `hooks/useAvatarUpload`, `hooks/useSettingsProfileForm`
- `api/user.ts`, `api/contactRequests.ts`, `api/telegramLink.ts`, `stores/authStore.ts`

## Rules

- Preserve compact profile identity: cover/avatar, name, verified/rank, counters, edit and overflow actions.
- Keep top-level profile tabs predictable: overview, routes, favorites, history where applicable.
- Keep subscriptions visible from profile identity/counters, not hidden only in a horizontal section.
- Preserve pagination, pull-to-refresh, auth boundaries, graceful 401/403 behavior, and own-route deletion flows.
- Use existing `components/ui`, `useResponsive`, `useThemedColors`, and `DESIGN_TOKENS`.
- Keep external links centralized in `utils/externalLinks.ts`.
- If a board ticket id is part of the task, update only that ticket: `in_progress` at start, `review` with evidence at handoff; do not move it to `done`.

## Workflow

1. Read the touched screen/component and nearby hooks/API before editing.
2. Keep web and native profile branches in parity when both exist.
3. Route achievements content to `$metravel-achievements-expert`; route travel cards/details to `$metravel-travel-expert`; route map embeds to `$metravel-map-expert`.
4. For visible UI changes, use `$metravel-ui-guardrails` and browser evidence on mobile and desktop widths.
5. Validate with targeted checks; use `npm run check:fast` for a finished local block.

## Output

Return a compact `Profile Expert Handoff` with affected profile surfaces, data/API impact, validation, and blockers.
