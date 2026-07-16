---
name: metravel-domain-router
description: Route metravel feature work to the right domain context before implementation. Use when Codex works on travel, map, profile, achievements/badges, quests, travel PDF/export, new pages, design-system drift, or other feature-area changes that need file maps, owner boundaries, and domain-specific validation before using the general feature builder.
---

# Metravel Domain Router

Use this skill as a lightweight feature-owner map before `$metravel-feature-builder`, `$metravel-ui-guardrails`, `$metravel-test-writer`, or `$metravel-code-reviewer`.

Read first:

- `AGENTS.md`
- `docs/CODEX.md`
- `docs/RULES.md`
- `docs/README.md`
- A matching `docs/features/*.md` file when it exists.

## Domain Map

| Domain | Typical files | Route and rules |
| --- | --- | --- |
| Travel list/details/wizard/export | `components/travel/**`, `components/listTravel/**`, `app/travel/**`, `app/(tabs)/travel*`, `hooks/useTravel*`, `api/travel/**`, `stores/*travel*` | Use `$metravel-travel-expert` before `$metravel-feature-builder`; preserve `UnifiedTravelCard`, `ImageCardMedia`, React Query for server state, Zustand for client state, travel media rules, and save != moderate. |
| Map and places | `components/MapPage/**`, `components/map/**`, `app/map*`, `hooks/useMap*`, `screens/tabs/PlacesScreen.tsx`, `api/places.ts` | Use `$metravel-map-expert`; add `$metravel-ui-guardrails` for visible map/popups; keep web Leaflet and native map imports separated by platform files. |
| Profile and settings | `app/(tabs)/profile.tsx`, `app/(tabs)/user/[id].tsx`, `app/(tabs)/settings.tsx`, `components/profile/**`, `components/settings/**` | Use `$metravel-profile-expert`; preserve profile information architecture, tabs, counters, settings flows, auth boundaries, and integrated feature sections. |
| Achievements and badges | `api/achievements.ts`, `api/achievementsMock.ts`, `hooks/useAchievementsApi.ts`, `components/achievements/**`, `__tests__/achievements/**` | Use `$metravel-achievements-expert`; treat `api/achievements.ts` as BE contract. Keep mock fallback explicit, React Query keys stable, peer-badge optimistic updates rollback-safe, and badge media via `ImageCardMedia`. |
| Quests | `components/quests/**`, `app/(tabs)/quests/**`, `api/quests.ts`, `utils/questAdapters.ts`, `hooks/useQuestsApi.ts`, `scripts/*quest*` | Use `$metravel-quest-expert` for code, `$metravel-quest-writer` for new authored quests, `$metravel-quest-editor` for existing content, and `$metravel-quest-geo-verifier` for coordinate validation. |
| SEO/index/content | `components/seo/**`, `utils/seo/**`, article/travel rich text, `docs/GROWTH_PLAN.md` | Use `$metravel-seo-index-operator` for GSC/indexing routines and `$metravel-article-editor-agent` for article API content edits. |
| Localization | `i18n/**`, `types/i18next.d.ts`, `__tests__/i18n/**`, any user-facing copy/formatting/SEO locale | Use `$metravel-i18n-guardrails`; keep RU/BE/UK/PL/EN key parity, web SSR/hydration, native locale persistence, and API-content boundaries. |
| PDF/export | travel export/PDF components, print preview, book settings/templates | Preserve print behavior and browser verification. If the task is only visual export UI, use `$metravel-ui-guardrails`; if it is data/logic, use `$metravel-feature-builder`. |
| New page or redesign | `app/**`, screen components, `components/ui`, design tokens | Reuse existing primitives, `useResponsive`, `useThemedColors`, `DESIGN_TOKENS`, SEO helpers, and browser verification. |

## Workflow

1. Identify the domain from the changed files, route, or user wording, then
   record platform impact for desktop web/mobile web/Android and localization
   impact for RU/BE/UK/PL/EN; mobile-web and Android validation is paired.
2. Load only the matching feature docs and nearby tests/components.
3. If a board ticket is involved, read its Task Contract before editing.
4. Choose the smallest specialist set:
   - domain code: `$metravel-travel-expert`, `$metravel-map-expert`, `$metravel-profile-expert`, `$metravel-achievements-expert`, `$metravel-quest-expert`
   - quest content: `$metravel-quest-writer` for new quests, `$metravel-quest-editor` for existing copy, `$metravel-quest-geo-verifier` for coordinates
   - general code: `$metravel-feature-builder`
   - visible UI: `$metravel-ui-guardrails`
   - UI copy, locale state, formatting, SEO locale: `$metravel-i18n-guardrails`
   - tests: `$metravel-test-writer` / `$metravel-test-runner`
   - large split: `$metravel-refactor-surgeon`
   - browser verification/fix pass: `$metravel-browser-reviewer`
5. Validate with the narrowest checks that cover the domain and add browser/device
   evidence when required; add `npm run test:i18n` for localization impact.

Do not create a separate mini-architecture for a domain. Reuse existing components, hooks, query keys, stores, and API adapters unless a real duplication or boundary problem is in scope.
